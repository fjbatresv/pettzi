import { Duration, RemovalPolicy, Stack, StackProps, Tags } from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import { Construct } from 'constructs';

export interface FrontendStackProps extends StackProps {
  stage: string;
  domainName: string;
  hostedZoneName: string;
  hostedZoneId?: string;
  useKms?: boolean;
}

export class FrontendStack extends Stack {
  public readonly siteBucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: FrontendStackProps) {
    super(scope, id, props);

    const stage = props.stage.toLowerCase().replaceAll(/[^a-z0-9-]/g, '-');
    const hostedZone = props.hostedZoneId
      ? route53.HostedZone.fromHostedZoneAttributes(this, 'FrontendZone', {
          hostedZoneId: props.hostedZoneId,
          zoneName: props.hostedZoneName,
        })
      : route53.HostedZone.fromLookup(this, 'FrontendZoneLookup', {
          domainName: props.hostedZoneName,
        });

    Tags.of(this).add('project', 'pettzi');
    Tags.of(this).add('AppManagerCFNStackKey', id);

    const useKms = props.useKms ?? false;
    const bucketKey = useKms
      ? (() => {
          const key = new kms.Key(this, 'FrontendBucketKey', {
            enableKeyRotation: true,
            description: `CMK for frontend bucket (${stage})`,
          });
          key.applyRemovalPolicy(RemovalPolicy.DESTROY);
          return key;
        })()
      : undefined;

    this.siteBucket = new s3.Bucket(this, 'FrontendBucket', {
      bucketName: `pettzi-frontend-${stage}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: useKms ? s3.BucketEncryption.KMS : s3.BucketEncryption.S3_MANAGED,
      ...(useKms && bucketKey ? { encryptionKey: bucketKey } : {}),
      versioned: false,
      autoDeleteObjects: true,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const originAccessControl = new cloudfront.S3OriginAccessControl(
      this,
      'FrontendOac',
      {
        originAccessControlName: `pettzi-frontend-oac-${stage}`,
        signing: cloudfront.Signing.SIGV4_ALWAYS,
      }
    );

    const certificate = new acm.Certificate(this, 'FrontendCertificate', {
      domainName: props.domainName,
      validation: acm.CertificateValidation.fromDns(hostedZone),
    });

    const rateLimit = stage === 'prod' ? 1000 : 2000;
    const webAcl = new wafv2.CfnWebACL(this, 'FrontendWebAcl', {
      scope: 'CLOUDFRONT',
      defaultAction: { allow: {} },
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: `pettzi-frontend-${stage}`,
        sampledRequestsEnabled: true,
      },
      rules: [
        {
          name: 'RateLimit',
          priority: 0,
          action: { block: {} },
          statement: {
            rateBasedStatement: {
              limit: rateLimit,
              aggregateKeyType: 'IP',
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: `pettzi-frontend-rate-${stage}`,
            sampledRequestsEnabled: true,
          },
        },
        {
          name: 'AWSManagedCommon',
          priority: 1,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesCommonRuleSet',
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: `pettzi-frontend-common-${stage}`,
            sampledRequestsEnabled: true,
          },
        },
        {
          name: 'AWSManagedKnownBadInputs',
          priority: 2,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesKnownBadInputsRuleSet',
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: `pettzi-frontend-badinputs-${stage}`,
            sampledRequestsEnabled: true,
          },
        },
        {
          name: 'AWSManagedSQLi',
          priority: 3,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesSQLiRuleSet',
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: `pettzi-frontend-sqli-${stage}`,
            sampledRequestsEnabled: true,
          },
        },
        {
          name: 'AWSManagedIPReputation',
          priority: 4,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesAmazonIpReputationList',
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: `pettzi-frontend-iprep-${stage}`,
            sampledRequestsEnabled: true,
          },
        },
        {
          name: 'AWSManagedAnonymousIP',
          priority: 5,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesAnonymousIpList',
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: `pettzi-frontend-anonip-${stage}`,
            sampledRequestsEnabled: true,
          },
        },
      ],
    });

    this.distribution = new cloudfront.Distribution(
      this,
      'FrontendDistribution',
      {
        comment: `Pettzi frontend CDN (${stage})`,
        certificate,
        domainNames: [props.domainName],
        priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
        defaultRootObject: 'index.html',
        webAclId: webAcl.attrArn,
        errorResponses: [
          {
            httpStatus: 403,
            responseHttpStatus: 200,
            responsePagePath: '/index.html',
            ttl: Duration.seconds(0),
          },
          {
            httpStatus: 404,
            responseHttpStatus: 200,
            responsePagePath: '/index.html',
            ttl: Duration.seconds(0),
          },
        ],
        defaultBehavior: {
          origin: origins.S3BucketOrigin.withOriginAccessControl(
            this.siteBucket,
            {
              originAccessControl,
            }
          ),
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        },
      }
    );

    new route53.ARecord(this, 'FrontendAliasRecord', {
      zone: hostedZone,
      recordName: props.domainName,
      target: route53.RecordTarget.fromAlias(
        new targets.CloudFrontTarget(this.distribution)
      ),
    });
  }
}
