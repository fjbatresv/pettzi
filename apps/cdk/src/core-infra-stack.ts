import { RemovalPolicy, Stack, StackProps, Tags } from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export interface CoreInfraStackProps extends StackProps {
  stage: string;
}

export class CoreInfraStack extends Stack {
  public readonly table: dynamodb.Table;
  public readonly docsBucket: s3.Bucket;
  public readonly logsBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: CoreInfraStackProps) {
    super(scope, id, props);

    const stage = props.stage.toLowerCase().replaceAll(/[^a-z0-9-]/g, '-');

    Tags.of(this).add('project', 'pettzi');
    Tags.of(this).add('AppManagerCFNStackKey', id);

    this.logsBucket = new s3.Bucket(this, 'DocsAccessLogsBucket', {
      bucketName: `pettzi-docs-logs-${stage}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
      autoDeleteObjects: true,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const tableKey = new kms.Key(this, 'PettziTableKey', {
      enableKeyRotation: true,
      description: `CMK for Pettzi DynamoDB table (${stage})`,
    });
    tableKey.applyRemovalPolicy(RemovalPolicy.DESTROY);

    this.table = new dynamodb.Table(this, 'PettziTable', {
      tableName: `pettzi-table-${stage}`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: tableKey,
      pointInTimeRecovery: true,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    this.table.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
    });

    this.docsBucket = new s3.Bucket(this, 'DocsBucket', {
      bucketName: `pettzi-docs-${stage}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
      serverAccessLogsBucket: this.logsBucket,
      serverAccessLogsPrefix: 'access-logs/',
      autoDeleteObjects: true,
      removalPolicy: RemovalPolicy.DESTROY,
    });
  }
}
