import { CfnOutput, Fn, Stack, StackProps, Tags } from 'aws-cdk-lib';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as certmgr from 'aws-cdk-lib/aws-certificatemanager';
import { Construct } from 'constructs';

export interface ApiDomainStackProps extends StackProps {
  domainName: string;
  hostedZoneName: string;
  hostedZoneId?: string;
  /**
   * When false, the stack will synthesize without creating any
   * custom domain resources. Useful to gracefully disable the
   * stack when the hosted zone is not authoritative for the
   * requested domain.
   */
  enabled: boolean;
  authApi: apigwv2.HttpApi;
  petsApi: apigwv2.HttpApi;
  ownersApi: apigwv2.HttpApi;
  eventsApi: apigwv2.HttpApi;
  remindersApi: apigwv2.HttpApi;
  uploadsApi: apigwv2.HttpApi;
  catalogsApi: apigwv2.HttpApi;
}

export const AUTH_API_BASE_PATH = 'auth';

export class ApiDomainStack extends Stack {
  constructor(scope: Construct, id: string, props: ApiDomainStackProps) {
    super(scope, id, props);

    Tags.of(this).add('project', 'pettzi');
    Tags.of(this).add('AppManagerCFNStackKey', id);

    if (!props.enabled) {
      // Intentionally synthesize an "empty" stack so that any
      // previously-created resources and cross-stack references
      // from earlier deployments are cleaned up safely.
      console.warn(
        `ApiDomainStack is disabled; skipping creation of custom domain resources for "${props.domainName}".`
      );
      return;
    }

    const zone =
      props.hostedZoneId != null
        ? route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
            hostedZoneId: props.hostedZoneId,
            zoneName: props.hostedZoneName,
          })
        : route53.HostedZone.fromLookup(this, 'HostedZoneLookup', {
            domainName: props.hostedZoneName,
          });

    const certificate = new certmgr.DnsValidatedCertificate(
      this,
      'ApiDomainCertificate',
      {
        domainName: props.domainName,
        hostedZone: zone,
        region: 'us-east-1',
      }
    );

    const mappings: Array<{
      id: string;
      api: apigwv2.HttpApi;
      basePath: string;
    }> = [
      {
        id: 'AuthApiMapping',
        api: props.authApi,
        basePath: AUTH_API_BASE_PATH,
      },
      { id: 'PetsApiMapping', api: props.petsApi, basePath: 'pets' },
      { id: 'OwnersApiMapping', api: props.ownersApi, basePath: 'owners' },
      { id: 'EventsApiMapping', api: props.eventsApi, basePath: 'events' },
      {
        id: 'RemindersApiMapping',
        api: props.remindersApi,
        basePath: 'reminders',
      },
      { id: 'UploadsApiMapping', api: props.uploadsApi, basePath: 'uploads' },
      {
        id: 'CatalogsApiMapping',
        api: props.catalogsApi,
        basePath: 'catalogs',
      },
    ];

    const distribution = new cloudfront.Distribution(this, 'ApiDistribution', {
      comment: `Pettzi unified API CDN for ${props.domainName}`,
      certificate,
      domainNames: [props.domainName],
      defaultBehavior: {
        origin: this.buildHttpApiOrigin(props.authApi),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        functionAssociations: [
          {
            eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
            function: this.createPathRewriteFunction('auth', AUTH_API_BASE_PATH),
          },
        ],
      },
    });

    mappings.forEach(({ id: mappingId, api, basePath }) => {
      distribution.addBehavior(`${basePath}/*`, this.buildHttpApiOrigin(api), {
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        functionAssociations: [
          {
            eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
            function: this.createPathRewriteFunction(mappingId, basePath),
          },
        ],
      });
    });

    new route53.ARecord(this, 'ApiDomainAliasRecord', {
      zone,
      recordName: props.domainName,
      target: route53.RecordTarget.fromAlias(
        new targets.CloudFrontTarget(distribution)
      ),
    });

    new CfnOutput(this, 'ApiCustomDomainUrl', {
      value: `https://${props.domainName}`,
      exportName: `PettziApiCustomDomain-${props.domainName.replaceAll(
        /[^A-Za-z0-9-]/g,
        '-'
      )}`,
    });
  }

  private buildHttpApiOrigin(api: apigwv2.HttpApi) {
    const domainName = Fn.select(2, Fn.split('/', api.apiEndpoint));
    return new origins.HttpOrigin(domainName, {
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
    });
  }

  private createPathRewriteFunction(id: string, basePath: string) {
    const normalized = basePath.startsWith('/') ? basePath : `/${basePath}`;
    return new cloudfront.Function(this, `${id}PathRewrite`, {
      code: cloudfront.FunctionCode.fromInline(`
function handler(event) {
  var request = event.request;
  var prefix = "${normalized}";
  if (request.uri === prefix) {
    request.uri = "/";
    return request;
  }
  if (request.uri.startsWith(prefix + "/")) {
    request.uri = request.uri.substring(prefix.length);
  }
  return request;
}
      `),
    });
  }
}
