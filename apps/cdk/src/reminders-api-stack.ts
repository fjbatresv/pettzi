import {
  Stack,
  StackProps,
  Duration,
  CfnOutput,
  Tags,
  aws_iam as iam,
} from 'aws-cdk-lib';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { HttpUserPoolAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as logs from 'aws-cdk-lib/aws-logs';
import { UserPool, UserPoolClient } from 'aws-cdk-lib/aws-cognito';
import * as sns from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';
import * as path from 'path';

export interface RemindersApiStackProps extends StackProps {
  table: dynamodb.Table;
  userPool: UserPool;
  userPoolClient: UserPoolClient;
  sharedLayer?: lambda.ILayerVersion;
  sesLayer?: lambda.ILayerVersion;
  ddbLayer?: lambda.ILayerVersion;
  stage?: string;
  remindersEmailFrom: string;
  reminderTemplateName?: string;
  alarmTopic?: sns.ITopic;
}

export class RemindersApiStack extends Stack {
  public readonly httpApi: apigwv2.HttpApi;
  private readonly alarmTopic?: sns.ITopic;

  constructor(scope: Construct, id: string, props: RemindersApiStackProps) {
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
      STAGE: stage,
      REMINDERS_EMAIL_FROM: props.remindersEmailFrom,
      ...(props.reminderTemplateName
        ? { SES_REMINDER_TEMPLATE_NAME: props.reminderTemplateName }
        : {}),
    };

    const listRemindersFn = this.createFn(
      'ListRemindersHandler',
      stage,
      handlerPath('libs/api-reminders/src/handlers/list-reminders.handler.ts'),
      commonEnv,
      [props.sharedLayer, props.sesLayer, props.ddbLayer]
    );
    const listPetRemindersFn = this.createFn(
      'ListPetRemindersHandler',
      stage,
      handlerPath(
        'libs/api-reminders/src/handlers/list-pet-reminders.handler.ts'
      ),
      commonEnv,
      [props.sharedLayer, props.sesLayer, props.ddbLayer]
    );
    const createReminderFn = this.createFn(
      'CreateReminderHandler',
      stage,
      handlerPath(
        'libs/api-reminders/src/handlers/create-reminder.handler.ts'
      ),
      commonEnv,
      [props.sharedLayer, props.sesLayer, props.ddbLayer]
    );
    const deleteReminderFn = this.createFn(
      'DeleteReminderHandler',
      stage,
      handlerPath(
        'libs/api-reminders/src/handlers/delete-reminder.handler.ts'
      ),
      commonEnv,
      [props.sharedLayer, props.sesLayer, props.ddbLayer]
    );
    const processDueFn = this.createFn(
      'ProcessDueRemindersHandler',
      stage,
      handlerPath(
        'libs/api-reminders/src/handlers/process-due-reminders.handler.ts'
      ),
      commonEnv,
      [props.sharedLayer, props.sesLayer, props.ddbLayer]
    );

    props.table.grantReadWriteData(listRemindersFn);
    props.table.grantReadWriteData(listPetRemindersFn);
    props.table.grantReadWriteData(createReminderFn);
    props.table.grantReadWriteData(deleteReminderFn);
    props.table.grantReadWriteData(processDueFn);

    processDueFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          'ses:SendEmail',
          'ses:SendRawEmail',
          'ses:SendTemplatedEmail',
        ],
        resources: ['*'],
      })
    );

    const authorizer = new HttpUserPoolAuthorizer(
      'RemindersJwtAuthorizer',
      props.userPool,
      {
        userPoolClients: [props.userPoolClient],
        identitySource: ['$request.header.Authorization'],
      }
    );

    this.httpApi = new apigwv2.HttpApi(this, 'RemindersHttpApi', {
      apiName: `PettziRemindersApi-${stage}`,
      description: `Reminders API for Pettzi (${stage})`,
      defaultAuthorizer: authorizer,
      createDefaultStage: true,
      corsPreflight: {
        allowOrigins: ['http://localhost:4200'],
        allowMethods: [apigwv2.CorsHttpMethod.ANY],
        allowHeaders: ['authorization', 'content-type'],
        allowCredentials: true,
      },
    });

    this.httpApi.addRoutes({
      path: '/',
      methods: [apigwv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration(
        'ListRemindersIntegration',
        listRemindersFn
      ),
    });
    this.httpApi.addRoutes({
      path: '/pets/{petId}',
      methods: [apigwv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration(
        'ListPetRemindersIntegration',
        listPetRemindersFn
      ),
    });
    this.httpApi.addRoutes({
      path: '/pets/{petId}',
      methods: [apigwv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration(
        'CreateReminderIntegration',
        createReminderFn
      ),
    });
    this.httpApi.addRoutes({
      path: '/pets/{petId}/{reminderId}',
      methods: [apigwv2.HttpMethod.DELETE],
      integration: new HttpLambdaIntegration(
        'DeleteReminderIntegration',
        deleteReminderFn
      ),
    });

    this.addApiGatewayAlarm('RemindersApi5xxAlarm', this.httpApi.apiId);

    new events.Rule(this, 'DueRemindersRule', {
      schedule: events.Schedule.rate(Duration.days(1)),
      targets: [new targets.LambdaFunction(processDueFn)],
    });

    new CfnOutput(this, 'RemindersApiUrl', {
      value: this.httpApi.apiEndpoint,
      exportName: `PettziRemindersApiUrl-${stage}`,
    });
  }

  private createFn(
    id: string,
    stage: string,
    entry: string,
    environment: Record<string, string>,
    layersInput: Array<lambda.ILayerVersion | undefined> = []
  ): NodejsFunction {
    const layers = layersInput.filter((l): l is lambda.ILayerVersion =>
      Boolean(l)
    );
    const external =
      layers.length > 0
        ? [
            '@aws-sdk/client-ses',
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
