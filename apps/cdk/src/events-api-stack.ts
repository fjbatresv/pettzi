import { Stack, StackProps, Duration, CfnOutput, Tags } from 'aws-cdk-lib';
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

export interface EventsApiStackProps extends StackProps {
  table: dynamodb.Table;
  docsBucket: s3.Bucket;
  userPool: UserPool;
  userPoolClient: UserPoolClient;
  sharedLayer?: lambda.ILayerVersion;
  stage?: string;
  appDomain?: string;
  alarmTopic?: sns.ITopic;
}

export class EventsApiStack extends Stack {
  public readonly httpApi: apigwv2.HttpApi;
  private readonly alarmTopic?: sns.ITopic;

  constructor(scope: Construct, id: string, props: EventsApiStackProps) {
    super(scope, id, props);

    const stage =
      this.node.tryGetContext('stage') ??
      props.stage ??
      process.env.STAGE ??
      'dev';
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

    const createEventFn = this.createFn(
      'CreatePetEventHandler',
      stage,
      handlerPath('libs/api-events/src/handlers/create-event.handler.ts'),
      commonEnv,
      props.sharedLayer
    );
    const listEventsFn = this.createFn(
      'ListPetEventsHandler',
      stage,
      handlerPath('libs/api-events/src/handlers/list-events.handler.ts'),
      commonEnv,
      props.sharedLayer
    );
    const getEventFn = this.createFn(
      'GetPetEventHandler',
      stage,
      handlerPath('libs/api-events/src/handlers/get-event.handler.ts'),
      commonEnv,
      props.sharedLayer
    );
    const getEventDetailFn = this.createFn(
      'GetPetEventDetailHandler',
      stage,
      handlerPath('libs/api-events/src/handlers/get-event-detail.handler.ts'),
      commonEnv,
      props.sharedLayer
    );
    const updateEventFn = this.createFn(
      'UpdatePetEventHandler',
      stage,
      handlerPath('libs/api-events/src/handlers/update-event.handler.ts'),
      commonEnv,
      props.sharedLayer
    );
    const deleteEventFn = this.createFn(
      'DeletePetEventHandler',
      stage,
      handlerPath('libs/api-events/src/handlers/delete-event.handler.ts'),
      commonEnv,
      props.sharedLayer
    );

    props.table.grantReadWriteData(createEventFn);
    props.table.grantReadWriteData(listEventsFn);
    props.table.grantReadWriteData(getEventFn);
    props.table.grantReadWriteData(getEventDetailFn);
    props.table.grantReadWriteData(updateEventFn);
    props.table.grantReadWriteData(deleteEventFn);
    props.docsBucket.grantRead(getEventDetailFn);

    const authorizer = new HttpUserPoolAuthorizer(
      'EventsJwtAuthorizer',
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

    this.httpApi = new apigwv2.HttpApi(this, 'EventsHttpApi', {
      apiName: `PettziEventsApi-${stage}`,
      description: `Events API for Pettzi (${stage})`,
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
      path: '/pets/{petId}',
      methods: [apigwv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration(
        'CreateEventIntegration',
        createEventFn
      ),
    });
    this.httpApi.addRoutes({
      path: '/pets/{petId}',
      methods: [apigwv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration(
        'ListEventsIntegration',
        listEventsFn
      ),
    });
    this.httpApi.addRoutes({
      path: '/pets/{petId}/{eventId}',
      methods: [apigwv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration('GetEventIntegration', getEventFn),
    });
    this.httpApi.addRoutes({
      path: '/pets/{petId}/{eventId}/detail',
      methods: [apigwv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration(
        'GetEventDetailIntegration',
        getEventDetailFn
      ),
    });
    this.httpApi.addRoutes({
      path: '/pets/{petId}/{eventId}',
      methods: [apigwv2.HttpMethod.PATCH],
      integration: new HttpLambdaIntegration(
        'UpdateEventIntegration',
        updateEventFn
      ),
    });
    this.httpApi.addRoutes({
      path: '/pets/{petId}/{eventId}',
      methods: [apigwv2.HttpMethod.DELETE],
      integration: new HttpLambdaIntegration(
        'DeleteEventIntegration',
        deleteEventFn
      ),
    });

    this.addApiGatewayAlarm('EventsApi5xxAlarm', this.httpApi.apiId);

    new CfnOutput(this, 'EventsApiUrl', {
      value: this.httpApi.apiEndpoint,
      exportName: `PettziEventsApiUrl-${stage}`,
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

  private addLambdaAlarms(id: string, fn: lambda.Function) {
    if (!this.alarmTopic) {
      return;
    }
    const period = Duration.minutes(5);
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
  }

  private addApiGatewayAlarm(id: string, apiId: string) {
    if (!this.alarmTopic) {
      return;
    }
    const period = Duration.minutes(5);
    const dimensionsMap = { ApiId: apiId, Stage: '$default' };
    const errors = new cloudwatch.Metric({
      namespace: 'AWS/ApiGateway',
      metricName: '5xx',
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
      threshold: 0.5,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: 'API Gateway 5xx error rate above 0.5%',
    });
    alarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alarmTopic));
  }
}
