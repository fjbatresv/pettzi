import { Duration, Stack, StackProps, CfnOutput, Tags } from 'aws-cdk-lib';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { HttpUserPoolAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { UserPool, UserPoolClient } from 'aws-cdk-lib/aws-cognito';
import * as sns from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';
import * as path from 'path';

export interface UploadsApiStackProps extends StackProps {
  table: dynamodb.Table;
  docsBucket: s3.Bucket;
  userPool: UserPool;
  userPoolClient: UserPoolClient;
  sharedLayer?: lambda.ILayerVersion;
  s3Layer?: lambda.ILayerVersion;
  ddbLayer?: lambda.ILayerVersion;
  sharedLayerSsmParamName?: string;
  s3LayerSsmParamName?: string;
  ddbLayerSsmParamName?: string;
  stage: string;
  appDomain?: string;
  alarmTopic?: sns.ITopic;
}

export class UploadsApiStack extends Stack {
  public readonly httpApi: apigwv2.HttpApi;
  private readonly alarmTopic?: sns.ITopic;
  private readonly stageName: string;

  constructor(scope: Construct, id: string, props: UploadsApiStackProps) {
    super(scope, id, props);

    this.stageName = props.stage.toLowerCase();
    Tags.of(this).add('project', 'pettzi');
    Tags.of(this).add('AppManagerCFNStackKey', id);
    this.alarmTopic = props.alarmTopic;

    const handlerPath = (...segments: string[]) =>
      path.resolve(__dirname, '../../../../../..', ...segments);

    const commonEnv = {
      PETTZI_TABLE_NAME: props.table.tableName,
      PETTZI_DOCS_BUCKET_NAME: props.docsBucket.bucketName,
      STAGE: props.stage,
    };
    const sharedLayer = this.resolveLayer(
      props.sharedLayer,
      props.sharedLayerSsmParamName,
      'SharedLayer'
    );
    const s3Layer = this.resolveLayer(
      props.s3Layer,
      props.s3LayerSsmParamName,
      'S3Layer'
    );
    const ddbLayer = this.resolveLayer(
      props.ddbLayer,
      props.ddbLayerSsmParamName,
      'DdbLayer'
    );

    const photoUploadFn = this.createFn(
      'GeneratePhotoUploadUrlHandler',
      props.stage,
      handlerPath(
        'libs/api-uploads/src/handlers/generate-photo-upload-url.handler.ts'
      ),
      commonEnv,
      [sharedLayer, s3Layer, ddbLayer]
    );
    const docUploadFn = this.createFn(
      'GenerateDocumentUploadUrlHandler',
      props.stage,
      handlerPath(
        'libs/api-uploads/src/handlers/generate-document-upload-url.handler.ts'
      ),
      commonEnv,
      [sharedLayer, s3Layer, ddbLayer]
    );
    const profilePhotoUploadFn = this.createFn(
      'GenerateProfilePhotoUploadUrlHandler',
      props.stage,
      handlerPath(
        'libs/api-uploads/src/handlers/generate-profile-photo-upload-url.handler.ts'
      ),
      commonEnv,
      [sharedLayer, s3Layer, ddbLayer]
    );
    const listFilesFn = this.createFn(
      'ListPetFilesHandler',
      props.stage,
      handlerPath('libs/api-uploads/src/handlers/list-pet-files.handler.ts'),
      commonEnv,
      [sharedLayer, s3Layer, ddbLayer]
    );
    const downloadUrlFn = this.createFn(
      'GenerateDownloadUrlHandler',
      props.stage,
      handlerPath(
        'libs/api-uploads/src/handlers/generate-download-url.handler.ts'
      ),
      commonEnv,
      [sharedLayer, s3Layer, ddbLayer]
    );
    const profileDownloadUrlFn = this.createFn(
      'GenerateProfileDownloadUrlHandler',
      props.stage,
      handlerPath(
        'libs/api-uploads/src/handlers/generate-profile-download-url.handler.ts'
      ),
      commonEnv,
      [sharedLayer, s3Layer, ddbLayer]
    );
    const deleteFileFn = this.createFn(
      'DeleteFileHandler',
      props.stage,
      handlerPath('libs/api-uploads/src/handlers/delete-file.handler.ts'),
      commonEnv,
      [sharedLayer, s3Layer, ddbLayer]
    );
    const thumbnailFn = this.createFn(
      'GenerateThumbnailHandler',
      props.stage,
      handlerPath('libs/api-uploads/src/handlers/generate-thumbnail.handler.ts'),
      commonEnv,
      [sharedLayer, s3Layer, ddbLayer],
      ['sharp', 'heic-convert'],
      Duration.seconds(30),
      true
    );

    props.table.grantReadData(photoUploadFn);
    props.table.grantReadData(docUploadFn);
    props.table.grantReadData(profilePhotoUploadFn);
    props.table.grantReadData(listFilesFn);
    props.table.grantReadData(downloadUrlFn);
    props.table.grantReadData(profileDownloadUrlFn);
    props.table.grantReadData(deleteFileFn);
    props.table.grantReadWriteData(thumbnailFn);

    props.docsBucket.grantReadWrite(photoUploadFn);
    props.docsBucket.grantReadWrite(docUploadFn);
    props.docsBucket.grantReadWrite(profilePhotoUploadFn);
    props.docsBucket.grantReadWrite(listFilesFn);
    props.docsBucket.grantReadWrite(downloadUrlFn);
    props.docsBucket.grantReadWrite(profileDownloadUrlFn);
    props.docsBucket.grantReadWrite(deleteFileFn);
    props.docsBucket.grantReadWrite(thumbnailFn);

    const authorizer = new HttpUserPoolAuthorizer(
      'UploadsJwtAuthorizer',
      props.userPool,
      {
        identitySource: ['$request.header.Authorization'],
        userPoolClients: [props.userPoolClient],
      }
    );

    const corsOrigins = new Set(['http://localhost:4200']);
    if (props.appDomain) {
      corsOrigins.add(
        props.appDomain.startsWith('http')
          ? props.appDomain
          : `https://${props.appDomain}`
      );
    }

    this.httpApi = new apigwv2.HttpApi(this, 'UploadsHttpApi', {
      apiName: `PettziUploadsApi-${props.stage}`,
      description: `Uploads API for Pettzi (${props.stage})`,
      defaultAuthorizer: authorizer,
      createDefaultStage: true,
      corsPreflight: {
        allowOrigins: Array.from(corsOrigins),
        allowMethods: [apigwv2.CorsHttpMethod.ANY],
        allowHeaders: ['authorization', 'content-type'],
        allowCredentials: true,
      },
    });

    this.httpApi.addRoutes({
      path: '/pets/{petId}/photo',
      methods: [apigwv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration(
        'PhotoUploadIntegration',
        photoUploadFn
      ),
    });
    this.httpApi.addRoutes({
      path: '/profile/photo',
      methods: [apigwv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration(
        'ProfilePhotoUploadIntegration',
        profilePhotoUploadFn
      ),
    });
    this.httpApi.addRoutes({
      path: '/pets/{petId}/document',
      methods: [apigwv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration(
        'DocumentUploadIntegration',
        docUploadFn
      ),
    });
    this.httpApi.addRoutes({
      path: '/pets/{petId}',
      methods: [apigwv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration(
        'ListFilesIntegration',
        listFilesFn
      ),
    });
    this.httpApi.addRoutes({
      path: '/pets/{petId}/download-url',
      methods: [apigwv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration(
        'DownloadUrlIntegration',
        downloadUrlFn
      ),
    });
    this.httpApi.addRoutes({
      path: '/profile/download-url',
      methods: [apigwv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration(
        'ProfileDownloadUrlIntegration',
        profileDownloadUrlFn
      ),
    });
    this.httpApi.addRoutes({
      path: '/pets/{petId}',
      methods: [apigwv2.HttpMethod.DELETE],
      integration: new HttpLambdaIntegration(
        'DeleteFileIntegration',
        deleteFileFn
      ),
    });

    this.addApiGatewayAlarm('UploadsApi5xxAlarm', this.httpApi.apiId);

    const thumbnailRule = new events.Rule(this, 'ThumbnailOnUploadRule', {
      eventPattern: {
        source: ['aws.s3'],
        detailType: ['Object Created'],
        detail: {
          bucket: {
            name: [props.docsBucket.bucketName],
          },
          object: {
            key: [{ prefix: 'pets/' }],
          },
        },
      },
    });
    thumbnailRule.addTarget(new targets.LambdaFunction(thumbnailFn));

    new CfnOutput(this, 'UploadsApiUrl', {
      value: this.httpApi.apiEndpoint,
      exportName: `PettziUploadsApiUrl-${props.stage}`,
    });
  }

  private createFn(
    id: string,
    stage: string,
    entry: string,
    environment: Record<string, string>,
    layersInput: Array<lambda.ILayerVersion | undefined> = [],
    nodeModules: string[] = [],
    timeout: Duration = Duration.seconds(10),
    forceDockerBundling = false
  ): NodejsFunction {
    const layers = layersInput.filter((l): l is lambda.ILayerVersion =>
      Boolean(l)
    );
    const external =
      layers.length > 0
        ? [
            '@aws-sdk/client-s3',
            '@aws-sdk/s3-request-presigner',
            '@aws-sdk/client-dynamodb',
            '@aws-sdk/lib-dynamodb',
          ]
        : [];

    const logGroupName = `/aws/lambda/${id}-${stage}`;
    const logGroup = logs.LogGroup.fromLogGroupName(this, `${id}LogGroup`, logGroupName);
    new logs.LogRetention(this, `${id}LogRetention`, {
      logGroupName,
      retention: logs.RetentionDays.ONE_MONTH,
    });

    const fn = new NodejsFunction(this, id, {
      runtime: lambda.Runtime.NODEJS_24_X,
      entry,
      handler: 'handler',
      functionName: `${id}-${stage}`,
      tracing: lambda.Tracing.ACTIVE,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 256,
      logGroup,
      bundling: {
        tsconfig: path.resolve(__dirname, '../../../../../..', 'tsconfig.base.json'),
        target: 'node24',
        format: OutputFormat.CJS,
        platform: 'node',
        externalModules: external,
        nodeModules,
        sourcesContent: false,
        keepNames: false,
        minify: true,
        forceDockerBundling,
      },
      timeout,
      environment,
      layers,
    });
    this.addLambdaAlarms(id, fn);
    return fn;
  }

  private addLambdaAlarms(id: string, fn: lambda.Function) {
    if (!this.alarmTopic) {
      return;
    }
    const period = Duration.minutes(5);
    const isProd = this.stageName === 'prod';
    const errors = fn.metricErrors({ statistic: 'Sum', period });
    const invocations = fn.metricInvocations({ statistic: 'Sum', period });
    const errorRate = new cloudwatch.MathExpression({
      expression: '100 * errors / IF(invocations > 0, invocations, 1)',
      usingMetrics: { errors, invocations },
      period,
    });
    const errorAlarm = new cloudwatch.Alarm(this, `${id}ErrorRateAlarm`, {
      metric: errorRate,
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: 'Lambda error rate above 1%',
    });
    errorAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alarmTopic));

    const durationAlarm = new cloudwatch.Alarm(this, `${id}DurationAlarm`, {
      metric: fn.metricDuration({ statistic: 'Average', period }),
      threshold: 5000,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: 'Lambda duration above 5 seconds',
    });
    durationAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alarmTopic));

    const throttlesAlarm = new cloudwatch.Alarm(this, `${id}ThrottleAlarm`, {
      metric: fn.metricThrottles({ statistic: 'Sum', period }),
      threshold: 0,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: 'Lambda throttles detected',
    });
    throttlesAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alarmTopic));

    const concurrencyAlarm = new cloudwatch.Alarm(this, `${id}ConcurrencyAlarm`, {
      metric: fn.metric('ConcurrentExecutions', { statistic: 'Maximum', period }),
      threshold: isProd ? 700 : 300,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: 'Lambda concurrent executions near account limit',
    });
    concurrencyAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alarmTopic));
  }

  private addApiGatewayAlarm(id: string, apiId: string) {
    if (!this.alarmTopic) {
      return;
    }
    const period = Duration.minutes(5);
    const isProd = this.stageName === 'prod';
    const dimensionsMap = { ApiId: apiId, Stage: '$default' };
    const errors = new cloudwatch.Metric({
      namespace: 'AWS/ApiGateway',
      metricName: '5xx',
      statistic: 'Sum',
      period,
      dimensionsMap,
    });
    const clientErrors = new cloudwatch.Metric({
      namespace: 'AWS/ApiGateway',
      metricName: '4xx',
      statistic: 'Sum',
      period,
      dimensionsMap,
    });
    const requests = new cloudwatch.Metric({
      namespace: 'AWS/ApiGateway',
      metricName: 'Count',
      statistic: 'Sum',
      period,
      dimensionsMap,
    });
    const errorRate = new cloudwatch.MathExpression({
      expression: '100 * errors / IF(requests > 0, requests, 1)',
      usingMetrics: { errors, requests },
      period,
    });
    const alarm = new cloudwatch.Alarm(this, id, {
      metric: errorRate,
      threshold: isProd ? 0.5 : 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: 'API Gateway 5xx error rate above 0.5%',
    });
    alarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alarmTopic));

    const clientErrorRate = new cloudwatch.MathExpression({
      expression: '100 * errors / IF(requests > 0, requests, 1)',
      usingMetrics: { errors: clientErrors, requests },
      period,
    });
    const clientAlarm = new cloudwatch.Alarm(this, `${id}4xxRate`, {
      metric: clientErrorRate,
      threshold: isProd ? 5 : 10,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: 'API Gateway 4xx error rate above 5%',
    });
    clientAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alarmTopic));
  }

  private resolveLayer(
    direct: lambda.ILayerVersion | undefined,
    ssmParamName: string | undefined,
    idPrefix: string
  ): lambda.ILayerVersion | undefined {
    if (direct) return direct;
    if (!ssmParamName) return undefined;
    const arn = ssm.StringParameter.valueForStringParameter(this, ssmParamName);
    return lambda.LayerVersion.fromLayerVersionArn(this, `${idPrefix}Imported`, arn);
  }
}
