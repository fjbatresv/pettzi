import { RemovalPolicy, Stack, StackProps, Tags } from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export interface CoreInfraStackProps extends StackProps {
  stage: string;
}

export class CoreInfraStack extends Stack {
  public readonly table: dynamodb.Table;
  public readonly docsBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: CoreInfraStackProps) {
    super(scope, id, props);

    const stage = props.stage.toLowerCase().replaceAll(/[^a-z0-9-]/g, '-');

    Tags.of(this).add('project', 'peto');
    Tags.of(this).add('AppManagerCFNStackKey', id);


    this.table = new dynamodb.Table(this, 'PetoTable', {
      tableName: `peto-table-${stage}`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    this.table.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
    });

    this.docsBucket = new s3.Bucket(this, 'DocsBucket', {
      bucketName: `peto-docs-${stage}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      autoDeleteObjects: true,
      removalPolicy: RemovalPolicy.DESTROY,
    });
  }
}
