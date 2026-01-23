import { Duration, Stack, StackProps, CfnOutput, Tags } from 'aws-cdk-lib';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { HttpUserPoolAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import { UserPool, UserPoolClient } from 'aws-cdk-lib/aws-cognito';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import * as path from 'path';

export interface OwnersApiStackProps extends StackProps {
  table: dynamodb.Table;
  docsBucket: s3.Bucket;
  userPool: UserPool;
  userPoolClient: UserPoolClient;
  sharedLayer?: lambda.ILayerVersion;
  s3Layer?: lambda.ILayerVersion;
  sesLayer?: lambda.ILayerVersion;
  ddbLayer?: lambda.ILayerVersion;
  stage: string;
  sesFromEmail?: string;
  sharePetInviteTemplateNameEs?: string;
  sharePetInviteTemplateNameEn?: string;
  inviteBaseUrl?: string;
  inviteTokenSecret?: string;
  alarmTopic?: sns.ITopic;
}

export class OwnersApiStack extends Stack {
  public readonly httpApi: apigwv2.HttpApi;
  private readonly alarmTopic?: sns.ITopic;

  constructor(scope: Construct, id: string, props: OwnersApiStackProps) {
    super(scope, id, props);

    Tags.of(this).add('project', 'pettzi');
    Tags.of(this).add('AppManagerCFNStackKey', id);
    this.alarmTopic = props.alarmTopic;

    const handlerPath = (...segments: string[]) =>
      path.resolve(__dirname, '../../../../../..', ...segments);

    const commonEnv = {
      PETTZI_TABLE_NAME: props.table.tableName,
      PETTZI_DOCS_BUCKET_NAME: props.docsBucket.bucketName,
      STAGE: props.stage,
      ...(props.sesFromEmail ? { SES_FROM_EMAIL: props.sesFromEmail } : {}),
      ...(props.sharePetInviteTemplateNameEs
        ? { SES_SHARE_PET_INVITE_TEMPLATE_NAME_ES: props.sharePetInviteTemplateNameEs }
        : {}),
      ...(props.sharePetInviteTemplateNameEn
        ? { SES_SHARE_PET_INVITE_TEMPLATE_NAME_EN: props.sharePetInviteTemplateNameEn }
        : {}),
      ...(props.inviteBaseUrl ? { PET_SHARE_INVITE_BASE_URL: props.inviteBaseUrl } : {}),
      ...(props.inviteTokenSecret ? { PET_SHARE_INVITE_SECRET: props.inviteTokenSecret } : {}),
    };

    const getMeFn = this.createFn(
      'GetCurrentOwnerHandler',
      props.stage,
      handlerPath('libs/api-owners/src/handlers/get-current-owner.handler.ts'),
      commonEnv,
      [props.sharedLayer, props.ddbLayer]
    );
    const listOwnersFn = this.createFn(
      'ListPetOwnersHandler',
      props.stage,
      handlerPath('libs/api-owners/src/handlers/list-pet-owners.handler.ts'),
      commonEnv,
      [props.sharedLayer, props.ddbLayer]
    );
    const addOwnerFn = this.createFn(
      'AddPetOwnerHandler',
      props.stage,
      handlerPath('libs/api-owners/src/handlers/add-pet-owner.handler.ts'),
      commonEnv,
      [props.sharedLayer, props.ddbLayer]
    );
    const removeOwnerFn = this.createFn(
      'RemovePetOwnerHandler',
      props.stage,
      handlerPath('libs/api-owners/src/handlers/remove-pet-owner.handler.ts'),
      commonEnv,
      [props.sharedLayer, props.ddbLayer]
    );
    const inviteOwnerFn = this.createFn(
      'InvitePetOwnerHandler',
      props.stage,
      handlerPath('libs/api-owners/src/handlers/invite-pet-owner.handler.ts'),
      commonEnv,
      [props.sharedLayer, props.s3Layer, props.sesLayer, props.ddbLayer]
    );
    const previewInviteFn = this.createFn(
      'PreviewPetInviteHandler',
      props.stage,
      handlerPath('libs/api-owners/src/handlers/preview-pet-invite.handler.ts'),
      commonEnv,
      [props.sharedLayer, props.s3Layer, props.ddbLayer]
    );
    const acceptInviteFn = this.createFn(
      'AcceptPetInviteHandler',
      props.stage,
      handlerPath('libs/api-owners/src/handlers/accept-pet-invite.handler.ts'),
      commonEnv,
      [props.sharedLayer, props.s3Layer, props.ddbLayer]
    );

    props.table.grantReadWriteData(getMeFn);
    props.table.grantReadWriteData(listOwnersFn);
    props.table.grantReadWriteData(addOwnerFn);
    props.table.grantReadWriteData(removeOwnerFn);
    props.table.grantReadData(inviteOwnerFn);
    props.table.grantReadData(previewInviteFn);
    props.table.grantReadWriteData(acceptInviteFn);
    props.docsBucket.grantRead(inviteOwnerFn);
    props.docsBucket.grantRead(previewInviteFn);
    props.docsBucket.grantRead(acceptInviteFn);
    inviteOwnerFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ses:SendTemplatedEmail'],
        resources: ['*'],
      })
    );

    const authorizer = new HttpUserPoolAuthorizer(
      'OwnersJwtAuthorizer',
      props.userPool,
      {
        identitySource: ['$request.header.Authorization'],
        userPoolClients: [props.userPoolClient],
      }
    );

    this.httpApi = new apigwv2.HttpApi(this, 'OwnersHttpApi', {
      apiName: `PettziOwnersApi-${props.stage}`,
      description: `Owners API for Pettzi (${props.stage})`,
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
      path: '/me',
      methods: [apigwv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration('GetMeIntegration', getMeFn),
    });
    this.httpApi.addRoutes({
      path: '/pets/{petId}/owners',
      methods: [apigwv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration(
        'ListOwnersIntegration',
        listOwnersFn
      ),
    });
    this.httpApi.addRoutes({
      path: '/pets/{petId}/owners',
      methods: [apigwv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration('AddOwnerIntegration', addOwnerFn),
    });
    this.httpApi.addRoutes({
      path: '/pets/{petId}/owners/{ownerId}',
      methods: [apigwv2.HttpMethod.DELETE],
      integration: new HttpLambdaIntegration(
        'RemoveOwnerIntegration',
        removeOwnerFn
      ),
    });
    this.httpApi.addRoutes({
      path: '/pets/{petId}/owners/invite',
      methods: [apigwv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration(
        'InviteOwnerIntegration',
        inviteOwnerFn
      ),
    });
    this.httpApi.addRoutes({
      path: '/pet-invites/preview',
      methods: [apigwv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration(
        'PreviewPetInviteIntegration',
        previewInviteFn
      ),
      authorizer: new apigwv2.HttpNoneAuthorizer(),
    });
    this.httpApi.addRoutes({
      path: '/pet-invites/accept',
      methods: [apigwv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration(
        'AcceptPetInviteIntegration',
        acceptInviteFn
      ),
    });

    this.addApiGatewayAlarm('OwnersApi5xxAlarm', this.httpApi.apiId);

    new CfnOutput(this, 'OwnersApiUrl', {
      value: this.httpApi.apiEndpoint,
      exportName: `PettziOwnersApiUrl-${props.stage}`,
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
    const external =
      layers.length > 0
        ? [
            '@aws-sdk/client-s3',
            '@aws-sdk/s3-request-presigner',
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
