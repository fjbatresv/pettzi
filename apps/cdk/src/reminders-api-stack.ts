import { Stack, StackProps, Duration, CfnOutput, Tags, aws_iam as iam } from 'aws-cdk-lib';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { HttpUserPoolAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { UserPool, UserPoolClient } from 'aws-cdk-lib/aws-cognito';
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
}

export class RemindersApiStack extends Stack {
  public readonly httpApi: apigwv2.HttpApi;

  constructor(scope: Construct, id: string, props: RemindersApiStackProps) {
    super(scope, id, props);

    const stage = this.node.tryGetContext('stage') ?? props.stage ?? process.env.STAGE ?? 'dev';
    Tags.of(this).add('project', 'pettzi');
    Tags.of(this).add('AppManagerCFNStackKey', id);

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
      handlerPath('libs/api-reminders/src/handlers/list-reminders.handler.ts'),
      commonEnv,
      [props.sharedLayer, props.sesLayer, props.ddbLayer],
    );
    const listPetRemindersFn = this.createFn(
      'ListPetRemindersHandler',
      handlerPath('libs/api-reminders/src/handlers/list-pet-reminders.handler.ts'),
      commonEnv,
      [props.sharedLayer, props.sesLayer, props.ddbLayer],
    );
    const processDueFn = this.createFn(
      'ProcessDueRemindersHandler',
      handlerPath('libs/api-reminders/src/handlers/process-due-reminders.handler.ts'),
      commonEnv,
      [props.sharedLayer, props.sesLayer, props.ddbLayer],
    );

    props.table.grantReadWriteData(listRemindersFn);
    props.table.grantReadWriteData(listPetRemindersFn);
    props.table.grantReadWriteData(processDueFn);

    processDueFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ses:SendEmail', 'ses:SendRawEmail', 'ses:SendTemplatedEmail'],
        resources: ['*'],
      })
    );

    const authorizer = new HttpUserPoolAuthorizer(
      'RemindersJwtAuthorizer',
      props.userPool,
      {
        userPoolClients: [props.userPoolClient],
        identitySource: ['$request.header.Authorization'],
      },
    );

    this.httpApi = new apigwv2.HttpApi(this, 'RemindersHttpApi', {
      apiName: `PettziRemindersApi-${stage}`,
      description: `Reminders API for Pettzi (${stage})`,
      defaultAuthorizer: authorizer,
      createDefaultStage: true,
    });

    this.httpApi.addRoutes({
      path: '/',
      methods: [apigwv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration('ListRemindersIntegration', listRemindersFn),
    });
    this.httpApi.addRoutes({
      path: '/pets/{petId}',
      methods: [apigwv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration('ListPetRemindersIntegration', listPetRemindersFn),
    });

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
    entry: string,
    environment: Record<string, string>,
    layersInput: Array<lambda.ILayerVersion | undefined> = [],
  ): NodejsFunction {
    const layers = layersInput.filter(
      (l): l is lambda.ILayerVersion => Boolean(l)
    );
    const external =
      layers.length > 0
        ? [
            '@pettzi/domain-model',
            '@pettzi/utils-dynamo',
            '@pettzi/shared-utils',
            '@aws-sdk/client-ses',
            '@aws-sdk/client-dynamodb',
            '@aws-sdk/lib-dynamodb',
          ]
        : [];

    return new NodejsFunction(this, id, {
      runtime: lambda.Runtime.NODEJS_24_X,
      entry,
      handler: 'handler',
      tracing: lambda.Tracing.ACTIVE,
      bundling: {
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
  }
}
