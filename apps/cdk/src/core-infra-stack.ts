import { Duration, RemovalPolicy, Stack, StackProps, Tags } from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as cloudtrail from 'aws-cdk-lib/aws-cloudtrail';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sns from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';

export interface CoreInfraStackProps extends StackProps {
  stage: string;
  useKms?: boolean;
}

export class CoreInfraStack extends Stack {
  public readonly table: dynamodb.Table;
  public readonly docsBucket: s3.Bucket;
  public readonly logsBucket: s3.Bucket;
  public readonly alarmTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: CoreInfraStackProps) {
    super(scope, id, props);

    const stage = props.stage.toLowerCase().replaceAll(/[^a-z0-9-]/g, '-');
    const useKms = props.useKms ?? false;

    Tags.of(this).add('project', 'pettzi');
    Tags.of(this).add('AppManagerCFNStackKey', id);

    this.alarmTopic = new sns.Topic(this, 'PettziAlarmTopic', {
      topicName: `pettzi-alarms-${stage}`,
    });

    const s3Key = useKms
      ? (() => {
          const key = new kms.Key(this, 'PettziS3Key', {
            enableKeyRotation: true,
            description: `CMK for Pettzi S3 buckets (${stage})`,
          });
          key.applyRemovalPolicy(RemovalPolicy.DESTROY);
          return key;
        })()
      : undefined;

    this.logsBucket = new s3.Bucket(this, 'DocsAccessLogsBucket', {
      bucketName: `pettzi-docs-logs-${stage}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: useKms ? s3.BucketEncryption.KMS : s3.BucketEncryption.S3_MANAGED,
      ...(useKms && s3Key ? { encryptionKey: s3Key } : {}),
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_PREFERRED,
      accessControl: s3.BucketAccessControl.LOG_DELIVERY_WRITE,
      versioned: true,
      lifecycleRules: [
        {
          expiration: Duration.days(60),
        },
      ],
      autoDeleteObjects: true,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    this.logsBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'AWSCloudTrailAclCheck',
        actions: ['s3:GetBucketAcl'],
        principals: [new iam.ServicePrincipal('cloudtrail.amazonaws.com')],
        resources: [this.logsBucket.bucketArn],
      })
    );

    this.logsBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'AWSCloudTrailWrite',
        actions: ['s3:PutObject'],
        principals: [new iam.ServicePrincipal('cloudtrail.amazonaws.com')],
        resources: [
          `${this.logsBucket.bucketArn}/cloudtrail/AWSLogs/${this.account}/*`,
        ],
        conditions: {
          StringEquals: { 's3:x-amz-acl': 'bucket-owner-full-control' },
        },
      })
    );

    const tableKey = useKms
      ? (() => {
          const key = new kms.Key(this, 'PettziTableKey', {
            enableKeyRotation: true,
            description: `CMK for Pettzi DynamoDB table (${stage})`,
          });
          key.applyRemovalPolicy(RemovalPolicy.DESTROY);
          return key;
        })()
      : undefined;

    this.table = new dynamodb.Table(this, 'PettziTable', {
      tableName: `pettzi-table-${stage}`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: useKms
        ? dynamodb.TableEncryption.CUSTOMER_MANAGED
        : dynamodb.TableEncryption.AWS_MANAGED,
      ...(useKms && tableKey ? { encryptionKey: tableKey } : {}),
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
      encryption: useKms ? s3.BucketEncryption.KMS : s3.BucketEncryption.S3_MANAGED,
      ...(useKms && s3Key ? { encryptionKey: s3Key } : {}),
      versioned: true,
      eventBridgeEnabled: true,
      serverAccessLogsBucket: this.logsBucket,
      serverAccessLogsPrefix: 'access-logs/',
      lifecycleRules: [
        {
          transitions: [
            {
              storageClass: s3.StorageClass.INTELLIGENT_TIERING,
              transitionAfter: Duration.days(30),
            },
          ],
        },
      ],
      autoDeleteObjects: true,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    this.docsBucket.addCorsRule({
      allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.GET, s3.HttpMethods.HEAD],
      allowedOrigins: ['http://localhost:4200'],
      allowedHeaders: ['*'],
      exposedHeaders: ['ETag'],
    });

    const billingMetric = new cloudwatch.Metric({
      namespace: 'AWS/Billing',
      metricName: 'EstimatedCharges',
      dimensionsMap: { Currency: 'USD' },
      statistic: 'Maximum',
      period: Duration.hours(6),
      region: 'us-east-1',
    });

    const billingAlarm = new cloudwatch.Alarm(this, 'BillingAlarm', {
      metric: billingMetric,
      threshold: 30,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: 'Monthly AWS estimated charges exceeded $30',
    });
    billingAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alarmTopic));

    const throttlesMetric = this.table.metric('ThrottledRequests', {
      statistic: 'Sum',
      period: Duration.minutes(5),
    });
    const throttlesAlarm = new cloudwatch.Alarm(this, 'DynamoThrottlesAlarm', {
      metric: throttlesMetric,
      threshold: 0,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: 'DynamoDB throttled requests detected',
    });
    throttlesAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alarmTopic));

    const trail = new cloudtrail.Trail(this, 'DocsAccessTrail', {
      bucket: this.logsBucket,
      s3KeyPrefix: 'cloudtrail/',
      includeGlobalServiceEvents: false,
      isMultiRegionTrail: false,
      managementEvents: cloudtrail.ReadWriteType.NONE,
      sendToCloudWatchLogs: true,
      cloudWatchLogsRetention: logs.RetentionDays.ONE_MONTH,
    });

    trail.addS3EventSelector(
      [
        { bucket: this.docsBucket },
        { bucket: this.logsBucket },
      ],
      {
        readWriteType: cloudtrail.ReadWriteType.ALL,
        includeManagementEvents: false,
      }
    );

    const trailLogGroup = trail.logGroup;
    if (trailLogGroup) {
      const unauthorizedMetric = new logs.MetricFilter(this, 'S3UnauthorizedMetric', {
        logGroup: trailLogGroup,
        metricNamespace: 'Pettzi/Security',
        metricName: 'S3UnauthorizedAccess',
        filterPattern: logs.FilterPattern.all(
          logs.FilterPattern.stringValue('$.eventSource', '=', 's3.amazonaws.com'),
          logs.FilterPattern.stringValue('$.errorCode', '=', 'AccessDenied')
        ),
        metricValue: '1',
      });

      const unauthorizedAlarm = new cloudwatch.Alarm(
        this,
        'S3UnauthorizedAccessAlarm',
        {
          metric: unauthorizedMetric.metric({
            statistic: 'Sum',
            period: Duration.minutes(5),
          }),
          threshold: 0,
          evaluationPeriods: 1,
          comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
          alarmDescription: 'Unauthorized S3 access detected for docs/logs buckets',
        }
      );
      unauthorizedAlarm.addAlarmAction(
        new cloudwatchActions.SnsAction(this.alarmTopic)
      );
    }
  }
}
