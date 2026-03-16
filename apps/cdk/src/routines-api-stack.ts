import { Stack, StackProps, Duration, CfnOutput, Tags } from 'aws-cdk-lib';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { HttpUserPoolAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { UserPool, UserPoolClient } from 'aws-cdk-lib/aws-cognito';
import * as sns from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';
import * as path from 'path';

export interface RoutinesApiStackProps extends StackProps {
  table: dynamodb.Table;
  userPool: UserPool;
  userPoolClient: UserPoolClient;
  sharedLayer?: lambda.ILayerVersion;
  sharedLayerSsmParamName?: string;
  stage?: string;
  appDomain?: string;
  alarmTopic?: sns.ITopic;
}

export class RoutinesApiStack extends Stack {
  public readonly httpApi: apigwv2.HttpApi;
  private readonly alarmTopic?: sns.ITopic;
  private readonly stageName: string;

  constructor(scope: Construct, id: string, props: RoutinesApiStackProps) {
    super(scope, id, props);

    const stage =
      this.node.tryGetContext('stage') ??
      props.stage ??
      process.env.STAGE ??
      'dev';
    this.stageName = stage.toLowerCase();
    Tags.of(this).add('project', 'pettzi');
    Tags.of(this).add('AppManagerCFNStackKey', id);
    this.alarmTopic = props.alarmTopic;

    const handlerPath = (...segments: string[]) =>
      path.resolve(__dirname, '../../../../../..', ...segments);

    const commonEnv = {
      PETTZI_TABLE_NAME: props.table.tableName,
      STAGE: stage,
    };
    const sharedLayer = this.resolveLayer(
      props.sharedLayer,
      props.sharedLayerSsmParamName,
      'SharedLayer'
    );

    const handlers = {
      get: this.createFn(
        'GetPetRoutineHandler',
        stage,
        handlerPath('libs/api-routines/src/handlers/get-pet-routine.handler.ts'),
        commonEnv,
        sharedLayer
      ),
      upsert: this.createFn(
        'UpsertPetRoutineHandler',
        stage,
        handlerPath('libs/api-routines/src/handlers/upsert-pet-routine.handler.ts'),
        commonEnv,
        sharedLayer
      ),
      createActivity: this.createFn(
        'CreateRoutineActivityHandler',
        stage,
        handlerPath('libs/api-routines/src/handlers/create-routine-activity.handler.ts'),
        commonEnv,
        sharedLayer
      ),
      updateActivity: this.createFn(
        'UpdateRoutineActivityHandler',
        stage,
        handlerPath('libs/api-routines/src/handlers/update-routine-activity.handler.ts'),
        commonEnv,
        sharedLayer
      ),
      removeActivity: this.createFn(
        'DeleteRoutineActivityHandler',
        stage,
        handlerPath('libs/api-routines/src/handlers/delete-routine-activity.handler.ts'),
        commonEnv,
        sharedLayer
      ),
      today: this.createFn(
        'ListRoutineTodayHandler',
        stage,
        handlerPath('libs/api-routines/src/handlers/list-routine-today.handler.ts'),
        commonEnv,
        sharedLayer
      ),
      history: this.createFn(
        'ListRoutineHistoryHandler',
        stage,
        handlerPath(
          'libs/api-routines/src/handlers/list-routine-history.handler.ts'
        ),
        commonEnv,
        sharedLayer
      ),
      complete: this.createFn(
        'CompleteRoutineOccurrenceHandler',
        stage,
        handlerPath(
          'libs/api-routines/src/handlers/complete-routine-occurrence.handler.ts'
        ),
        commonEnv,
        sharedLayer
      ),
      skip: this.createFn(
        'SkipRoutineOccurrenceHandler',
        stage,
        handlerPath(
          'libs/api-routines/src/handlers/skip-routine-occurrence.handler.ts'
        ),
        commonEnv,
        sharedLayer
      ),
    };

    Object.values(handlers).forEach((fn) => props.table.grantReadWriteData(fn));

    const authorizer = new HttpUserPoolAuthorizer(
      'RoutinesJwtAuthorizer',
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

    this.httpApi = new apigwv2.HttpApi(this, 'RoutinesHttpApi', {
      apiName: `PettziRoutinesApi-${stage}`,
      description: `Routines API for Pettzi (${stage})`,
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
      path: '/pets/{petId}/routine',
      methods: [apigwv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration('GetPetRoutineIntegration', handlers.get),
    });
    this.httpApi.addRoutes({
      path: '/pets/{petId}/routine',
      methods: [apigwv2.HttpMethod.PUT],
      integration: new HttpLambdaIntegration('UpsertPetRoutineIntegration', handlers.upsert),
    });
    this.httpApi.addRoutes({
      path: '/pets/{petId}/routine/activities',
      methods: [apigwv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration('CreateRoutineActivityIntegration', handlers.createActivity),
    });
    this.httpApi.addRoutes({
      path: '/pets/{petId}/routine/activities/{activityId}',
      methods: [apigwv2.HttpMethod.PATCH],
      integration: new HttpLambdaIntegration('UpdateRoutineActivityIntegration', handlers.updateActivity),
    });
    this.httpApi.addRoutes({
      path: '/pets/{petId}/routine/activities/{activityId}',
      methods: [apigwv2.HttpMethod.DELETE],
      integration: new HttpLambdaIntegration('DeleteRoutineActivityIntegration', handlers.removeActivity),
    });
    this.httpApi.addRoutes({
      path: '/pets/{petId}/routine/today',
      methods: [apigwv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration('ListRoutineTodayIntegration', handlers.today),
    });
    this.httpApi.addRoutes({
      path: '/pets/{petId}/routine/history',
      methods: [apigwv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration('ListRoutineHistoryIntegration', handlers.history),
    });
    this.httpApi.addRoutes({
      path: '/pets/{petId}/routine/occurrences/{occurrenceId}/complete',
      methods: [apigwv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration('CompleteRoutineOccurrenceIntegration', handlers.complete),
    });
    this.httpApi.addRoutes({
      path: '/pets/{petId}/routine/occurrences/{occurrenceId}/skip',
      methods: [apigwv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration('SkipRoutineOccurrenceIntegration', handlers.skip),
    });

    this.addApiGatewayAlarm('RoutinesApi5xxAlarm', this.httpApi.apiId);

    new CfnOutput(this, 'RoutinesApiUrl', {
      value: this.httpApi.apiEndpoint,
      exportName: `PettziRoutinesApiUrl-${stage}`,
    });
  }

  private createFn(
    id: string,
    stage: string,
    entry: string,
    environment: Record<string, string>,
    depsLayer?: lambda.ILayerVersion
  ): NodejsFunction {
    const layers = depsLayer ? [depsLayer] : [];
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
        externalModules: [],
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

  private resolveLayer(
    providedLayer: lambda.ILayerVersion | undefined,
    layerSsmParamName: string | undefined,
    id: string
  ) {
    if (providedLayer) {
      return providedLayer;
    }
    if (!layerSsmParamName) {
      return undefined;
    }
    const layerArn = ssm.StringParameter.valueForStringParameter(
      this,
      layerSsmParamName
    );
    return lambda.LayerVersion.fromLayerVersionArn(this, id, layerArn);
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
    const clientErrorRate = new cloudwatch.MathExpression({
      expression: '100 * clientErrors / IF(requests > 0, requests, 1)',
      usingMetrics: { clientErrors, requests },
      period,
    });

    const serverAlarm = new cloudwatch.Alarm(this, `${id}ServerErrorRateAlarm`, {
      metric: errorRate,
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: 'API 5xx rate above 1%',
    });
    serverAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alarmTopic));

    const clientAlarm = new cloudwatch.Alarm(this, `${id}ClientErrorRateAlarm`, {
      metric: clientErrorRate,
      threshold: isProd ? 10 : 20,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: 'API 4xx rate unusually high',
    });
    clientAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alarmTopic));
  }
}
