import { RemovalPolicy, Stack, StackProps, Tags } from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export interface EmailAssetsCdnStackProps extends StackProps {
  stage: string;
  hostedZoneName: string;
  hostedZoneId?: string;
  prefix: string;
  useKms?: boolean;
}

export class EmailAssetsCdnStack extends Stack {
  public readonly assetsBucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: EmailAssetsCdnStackProps) {
    super(scope, id, props);

    const stage = props.stage.toLowerCase().replaceAll(/[^a-z0-9-]/g, '-');
    const hostedZone = props.hostedZoneId
      ? route53.HostedZone.fromHostedZoneAttributes(this, 'EmailAssetsZone', {
          hostedZoneId: props.hostedZoneId,
          zoneName: props.hostedZoneName,
        })
      : route53.HostedZone.fromLookup(this, 'EmailAssetsZoneLookup', {
          domainName: props.hostedZoneName,
        });
    const domainName =
      props.prefix === props.hostedZoneName ||
      props.prefix.endsWith(`.${props.hostedZoneName}`)
        ? props.prefix
        : `${props.prefix}.${props.hostedZoneName}`;

    Tags.of(this).add('project', 'pettzi');
    Tags.of(this).add('AppManagerCFNStackKey', id);

    const useKms = props.useKms ?? false;
    const bucketKey = useKms
      ? (() => {
          const key = new kms.Key(this, 'EmailAssetsBucketKey', {
            enableKeyRotation: true,
            description: `CMK for email assets bucket (${stage})`,
          });
          key.applyRemovalPolicy(RemovalPolicy.DESTROY);
          return key;
        })()
      : undefined;

    this.assetsBucket = new s3.Bucket(this, 'EmailAssetsBucket', {
      bucketName: `pettzi-email-assets-${stage}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: useKms ? s3.BucketEncryption.KMS : s3.BucketEncryption.S3_MANAGED,
      ...(useKms && bucketKey ? { encryptionKey: bucketKey } : {}),
      versioned: true,
      autoDeleteObjects: true,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const originAccessControl = new cloudfront.S3OriginAccessControl(
      this,
      'EmailAssetsOac',
      {
        originAccessControlName: `pettzi-email-assets-oac-${stage}`,
        signing: cloudfront.Signing.SIGV4_ALWAYS,
      }
    );

    const certificate = new acm.Certificate(this, 'EmailAssetsCertificate', {
      domainName,
      validation: acm.CertificateValidation.fromDns(hostedZone),
    });

    this.distribution = new cloudfront.Distribution(
      this,
      'EmailAssetsDistribution',
      {
        comment: `Pettzi email assets CDN (${stage})`,
        certificate,
        domainNames: [domainName],
        priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
        defaultBehavior: {
          origin: origins.S3BucketOrigin.withOriginAccessControl(
            this.assetsBucket,
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

    new route53.ARecord(this, 'EmailAssetsAliasRecord', {
      zone: hostedZone,
      recordName: domainName,
      target: route53.RecordTarget.fromAlias(
        new targets.CloudFrontTarget(this.distribution)
      ),
    });
  }
}
