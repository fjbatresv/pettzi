import { Duration, Stack, StackProps, CfnOutput, Tags } from 'aws-cdk-lib';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { HttpUserPoolAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import { UserPool, UserPoolClient } from 'aws-cdk-lib/aws-cognito';
import * as sns from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';
import * as path from 'path';

export interface CatalogsApiStackProps extends StackProps {
  table: dynamodb.Table;
  userPool: UserPool;
  userPoolClient: UserPoolClient;
  sharedLayer?: lambda.ILayerVersion;
  ddbLayer?: lambda.ILayerVersion;
  stage: string;
  appDomain?: string;
  alarmTopic?: sns.ITopic;
}

export class CatalogsApiStack extends Stack {
  public readonly httpApi: apigwv2.HttpApi;
  private readonly alarmTopic?: sns.ITopic;
  private readonly stageName: string;

  constructor(scope: Construct, id: string, props: CatalogsApiStackProps) {
    super(scope, id, props);

    this.stageName = props.stage.toLowerCase();
    Tags.of(this).add('project', 'pettzi');
    Tags.of(this).add('AppManagerCFNStackKey', id);
    this.alarmTopic = props.alarmTopic;

    const handlerPath = (...segments: string[]) =>
      path.resolve(__dirname, '../../../../../..', ...segments);

    const commonEnv = {
      STAGE: props.stage,
      PETTZI_TABLE_NAME: props.table.tableName,
    };

    const speciesFn = this.createFn(
      'GetSpeciesHandler',
      props.stage,
      handlerPath('libs/api-catalogs/src/handlers/get-species.handler.ts'),
      commonEnv,
      [props.sharedLayer, props.ddbLayer]
    );
    const breedsFn = this.createFn(
      'GetBreedsHandler',
      props.stage,
      handlerPath('libs/api-catalogs/src/handlers/get-breeds.handler.ts'),
      commonEnv,
      [props.sharedLayer, props.ddbLayer]
    );
    const vaccinesFn = this.createFn(
      'GetVaccinesHandler',
      props.stage,
      handlerPath('libs/api-catalogs/src/handlers/get-vaccines.handler.ts'),
      commonEnv,
      [props.sharedLayer, props.ddbLayer]
    );

    const authorizer = new HttpUserPoolAuthorizer(
      'CatalogsJwtAuthorizer',
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

    this.httpApi = new apigwv2.HttpApi(this, 'CatalogsHttpApi', {
      apiName: `PettziCatalogsApi-${props.stage}`,
      description: `Catalogs API for Pettzi (${props.stage})`,
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
      path: '/species',
      methods: [apigwv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration(
        'GetSpeciesIntegration',
        speciesFn
      ),
      authorizer: new apigwv2.HttpNoneAuthorizer(),
    });
    this.httpApi.addRoutes({
      path: '/breeds',
      methods: [apigwv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration('GetBreedsIntegration', breedsFn),
      authorizer: new apigwv2.HttpNoneAuthorizer(),
    });
    this.httpApi.addRoutes({
      path: '/vaccines',
      methods: [apigwv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration(
        'GetVaccinesIntegration',
        vaccinesFn
      ),
      authorizer: new apigwv2.HttpNoneAuthorizer(),
    });

    props.table.grantReadData(speciesFn);
    props.table.grantReadData(breedsFn);
    props.table.grantReadData(vaccinesFn);

    this.addApiGatewayAlarm('CatalogsApi5xxAlarm', this.httpApi.apiId);

    new CfnOutput(this, 'CatalogsApiUrl', {
      value: this.httpApi.apiEndpoint,
      exportName: `PettziCatalogsApiUrl-${props.stage}`,
    });
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
    const external = layers.length > 0 ? [] : [];

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
