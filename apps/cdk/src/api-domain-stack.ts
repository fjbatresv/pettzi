import { CfnOutput, Stack, StackProps, Tags } from 'aws-cdk-lib';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as certmgr from 'aws-cdk-lib/aws-certificatemanager';
import { Construct } from 'constructs';

export interface ApiDomainStackProps extends StackProps {
  domainName: string;
  hostedZoneName: string;
  hostedZoneId?: string;
  authApi: apigwv2.HttpApi;
  petsApi: apigwv2.HttpApi;
  ownersApi: apigwv2.HttpApi;
  eventsApi: apigwv2.HttpApi;
  remindersApi: apigwv2.HttpApi;
  uploadsApi: apigwv2.HttpApi;
  catalogsApi: apigwv2.HttpApi;
}

export class ApiDomainStack extends Stack {
  constructor(scope: Construct, id: string, props: ApiDomainStackProps) {
    super(scope, id, props);

    Tags.of(this).add('project', 'pettzi');
    Tags.of(this).add('AppManagerCFNStackKey', id);

    const zone =
      props.hostedZoneId != null
        ? route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
            hostedZoneId: props.hostedZoneId,
            zoneName: props.hostedZoneName,
          })
        : route53.HostedZone.fromLookup(this, 'HostedZoneLookup', {
            domainName: props.hostedZoneName,
          });

    const certificate = new certmgr.DnsValidatedCertificate(this, 'ApiDomainCertificate', {
      domainName: props.domainName,
      hostedZone: zone,
      region: Stack.of(this).region,
    });

    const domain = new apigwv2.DomainName(this, 'ApiDomain', {
      domainName: props.domainName,
      certificate,
    });

    const mappings: Array<{ id: string; api: apigwv2.HttpApi; basePath: string }> = [
      { id: 'AuthApiMapping', api: props.authApi, basePath: 'auth' },
      { id: 'PetsApiMapping', api: props.petsApi, basePath: 'pets' },
      { id: 'OwnersApiMapping', api: props.ownersApi, basePath: 'owners' },
      { id: 'EventsApiMapping', api: props.eventsApi, basePath: 'events' },
      { id: 'RemindersApiMapping', api: props.remindersApi, basePath: 'reminders' },
      { id: 'UploadsApiMapping', api: props.uploadsApi, basePath: 'uploads' },
      { id: 'CatalogsApiMapping', api: props.catalogsApi, basePath: 'catalogs' },
    ];

    mappings.forEach(({ id: mappingId, api, basePath }) => {
      new apigwv2.ApiMapping(this, mappingId, {
        api,
        domainName: domain,
        stage: api.defaultStage ?? api.addStage(`${basePath}Stage`, { autoDeploy: true }),
        apiMappingKey: basePath,
      });
    });

    new route53.ARecord(this, 'ApiDomainAliasRecord', {
      zone,
      recordName: props.domainName,
      target: route53.RecordTarget.fromAlias(
        new targets.ApiGatewayv2DomainProperties(
          domain.regionalDomainName,
          domain.regionalHostedZoneId
        )
      ),
    });

    new CfnOutput(this, 'ApiCustomDomainUrl', {
      value: `https://${props.domainName}`,
      exportName: `PettziApiCustomDomain-${props.domainName.replaceAll(/[^A-Za-z0-9-]/g, '-')}`,
    });
  }
}
