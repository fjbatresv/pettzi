import { Duration, Stack, StackProps, Tags } from 'aws-cdk-lib';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { HttpUserPoolAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import { UserPool, UserPoolClient } from 'aws-cdk-lib/aws-cognito';
import * as sns from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';
import * as path from 'path';

export interface PetsApiStackProps extends StackProps {
  table: dynamodb.Table;
  docsBucket: s3.IBucket;
  depsLayer?: lambda.ILayerVersion;
  userPool: UserPool;
  userPoolClient: UserPoolClient;
  s3Layer?: lambda.ILayerVersion;
  ddbLayer?: lambda.ILayerVersion;
  appDomain?: string;
  alarmTopic?: sns.ITopic;
}

export class PetsApiStack extends Stack {
  public readonly httpApi: apigwv2.HttpApi;
  private readonly alarmTopic?: sns.ITopic;
  private readonly stageName: string;

  constructor(scope: Construct, id: string, props: PetsApiStackProps) {
    super(scope, id, props);

    const stage =
      this.node.tryGetContext('stage') ?? process.env.STAGE ?? 'dev';
    this.stageName = stage.toLowerCase();
    Tags.of(this).add('project', 'pettzi');
    Tags.of(this).add('AppManagerCFNStackKey', id);
    this.alarmTopic = props.alarmTopic;

    const handlerPath = (...segments: string[]) =>
      path.resolve(__dirname, '../../../../../..', ...segments);

    const commonEnv = {
      PETTZI_TABLE_NAME: props.table.tableName,
      PETTZI_DOCS_BUCKET_NAME: props.docsBucket.bucketName,
      STAGE: stage,
    };

    const createPetFn = this.createFn(
      'CreatePetHandler',
      stage,
      handlerPath('libs/api-pets/src/handlers/create-pet.handler.ts'),
      commonEnv,
      [props.depsLayer, props.s3Layer, props.ddbLayer]
    );
    const listPetsFn = this.createFn(
      'ListPetsHandler',
      stage,
      handlerPath('libs/api-pets/src/handlers/list-pets.handler.ts'),
      commonEnv,
      [props.depsLayer, props.s3Layer, props.ddbLayer]
    );
    const getPetFn = this.createFn(
      'GetPetHandler',
      stage,
      handlerPath('libs/api-pets/src/handlers/get-pet.handler.ts'),
      commonEnv,
      [props.depsLayer, props.s3Layer, props.ddbLayer]
    );
    const updatePetFn = this.createFn(
      'UpdatePetHandler',
      stage,
      handlerPath('libs/api-pets/src/handlers/update-pet.handler.ts'),
      commonEnv,
      [props.depsLayer, props.s3Layer, props.ddbLayer]
    );
    const archivePetFn = this.createFn(
      'ArchivePetHandler',
      stage,
      handlerPath('libs/api-pets/src/handlers/archive-pet.handler.ts'),
      commonEnv,
      [props.depsLayer, props.s3Layer, props.ddbLayer]
    );
    const createSharedRecordFn = this.createFn(
      'CreateSharedRecordHandler',
      stage,
      handlerPath('libs/api-pets/src/handlers/create-shared-record.handler.ts'),
      commonEnv,
      [props.depsLayer, props.s3Layer, props.ddbLayer]
    );
    const getSharedRecordFn = this.createFn(
      'GetSharedRecordHandler',
      stage,
      handlerPath('libs/api-pets/src/handlers/get-shared-record.handler.ts'),
      commonEnv,
      [props.depsLayer, props.s3Layer, props.ddbLayer]
    );

    props.table.grantReadWriteData(createPetFn);
    props.table.grantReadWriteData(listPetsFn);
    props.table.grantReadWriteData(getPetFn);
    props.table.grantReadWriteData(updatePetFn);
    props.table.grantReadWriteData(archivePetFn);
    props.table.grantReadWriteData(createSharedRecordFn);
    props.table.grantReadData(getSharedRecordFn);
    props.docsBucket.grantRead(getSharedRecordFn);

    const authorizer = new HttpUserPoolAuthorizer(
      'PetsJwtAuthorizer',
      props.userPool,
      {
        userPoolClients: [props.userPoolClient],
        identitySource: ['$request.header.Authorization'],
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

    this.httpApi = new apigwv2.HttpApi(this, 'PetsHttpApi', {
      apiName: `PettziPetsApi-${stage}`,
      description: `Pets API for Pettzi (${stage})`,
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
      path: '/',
      methods: [apigwv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration(
        'CreatePetIntegration',
        createPetFn
      ),
    });
    this.httpApi.addRoutes({
      path: '/',
      methods: [apigwv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration('ListPetsIntegration', listPetsFn),
    });
    this.httpApi.addRoutes({
      path: '/{petId}',
      methods: [apigwv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration('GetPetIntegration', getPetFn),
    });
    this.httpApi.addRoutes({
      path: '/{petId}',
      methods: [apigwv2.HttpMethod.PATCH],
      integration: new HttpLambdaIntegration(
        'UpdatePetIntegration',
        updatePetFn
      ),
    });
    this.httpApi.addRoutes({
      path: '/{petId}',
      methods: [apigwv2.HttpMethod.DELETE],
      integration: new HttpLambdaIntegration(
        'ArchivePetIntegration',
        archivePetFn
      ),
    });
    this.httpApi.addRoutes({
      path: '/{petId}/shared-records',
      methods: [apigwv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration(
        'CreateSharedRecordIntegration',
        createSharedRecordFn
      ),
    });
    this.httpApi.addRoutes({
      path: '/shared-records/{token}',
      methods: [apigwv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration(
        'GetSharedRecordIntegration',
        getSharedRecordFn
      ),
      authorizer: new apigwv2.HttpNoneAuthorizer(),
    });

    this.addApiGatewayAlarm('PetsApi5xxAlarm', this.httpApi.apiId);
  }

  private createFn(
    id: string,
    stage: string,
    entry: string,
    environment: Record<string, string>,
    layersInput: Array<lambda.ILayerVersion | undefined>
  ): NodejsFunction {
    const layers = layersInput.filter((l): l is lambda.ILayerVersion =>
      Boolean(l)
    );

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
        externalModules: layers.length
          ? [
              '@aws-sdk/client-s3',
              '@aws-sdk/s3-request-presigner',
              '@aws-sdk/client-dynamodb',
              '@aws-sdk/lib-dynamodb',
            ]
          : [],
        sourcesContent: false,
        keepNames: false,
        minify: true,
      },
      timeout: Duration.seconds(10),
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
}
