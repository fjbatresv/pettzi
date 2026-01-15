import {
  CfnOutput,
  Stack,
  StackProps,
  Duration,
  aws_iam as iam,
  Tags,
} from 'aws-cdk-lib';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { HttpUserPoolAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import { UserPool, UserPoolClient } from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sns from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';
import * as path from 'path';

export interface AuthApiStackProps extends StackProps {
  userPool: UserPool;
  userPoolClient: UserPoolClient;
  table: dynamodb.Table;
  docsBucket: s3.Bucket;
  depsLayer?: lambda.ILayerVersion;
  sesLayer?: lambda.ILayerVersion;
  ddbLayer?: lambda.ILayerVersion;
  sesFromEmail?: string;
  welcomeTemplateName?: string;
  welcomeTemplateNameEs?: string;
  welcomeTemplateNameEn?: string;
  resetTemplateName?: string;
  resetTemplateNameEs?: string;
  resetTemplateNameEn?: string;
  verificationBaseUrl?: string;
  verificationSecret?: string;
  passwordResetBaseUrl?: string;
  alarmTopic?: sns.ITopic;
}

export class AuthApiStack extends Stack {
  public readonly httpApi: apigwv2.HttpApi;
  public readonly authorizer: HttpUserPoolAuthorizer;
  private readonly alarmTopic?: sns.ITopic;

  constructor(scope: Construct, id: string, props: AuthApiStackProps) {
    super(scope, id, props);

    const stage =
      this.node.tryGetContext('stage') ?? process.env.STAGE ?? 'dev';
    Tags.of(this).add('project', 'pettzi');
    Tags.of(this).add('AppManagerCFNStackKey', id);
    this.alarmTopic = props.alarmTopic;

    const commonEnv = {
      COGNITO_USER_POOL_ID: props.userPool.userPoolId,
      COGNITO_USER_POOL_CLIENT_ID: props.userPoolClient.userPoolClientId,
      PETTZI_TABLE_NAME: props.table.tableName,
      PETTZI_DOCS_BUCKET_NAME: props.docsBucket.bucketName,
      STAGE: stage,
      ...(props.sesFromEmail ? { SES_FROM_EMAIL: props.sesFromEmail } : {}),
      ...(props.welcomeTemplateName
        ? { SES_WELCOME_TEMPLATE_NAME: props.welcomeTemplateName }
        : {}),
      ...(props.welcomeTemplateNameEs
        ? { SES_WELCOME_TEMPLATE_NAME_ES: props.welcomeTemplateNameEs }
        : {}),
      ...(props.welcomeTemplateNameEn
        ? { SES_WELCOME_TEMPLATE_NAME_EN: props.welcomeTemplateNameEn }
        : {}),
      ...(props.resetTemplateName
        ? { SES_RESET_TEMPLATE_NAME: props.resetTemplateName }
        : {}),
      ...(props.resetTemplateNameEs
        ? { SES_RESET_TEMPLATE_NAME_ES: props.resetTemplateNameEs }
        : {}),
      ...(props.resetTemplateNameEn
        ? { SES_RESET_TEMPLATE_NAME_EN: props.resetTemplateNameEn }
        : {}),
      ...(props.verificationBaseUrl
        ? { EMAIL_VERIFY_BASE_URL: props.verificationBaseUrl }
        : {}),
      ...(props.verificationSecret
        ? { EMAIL_VERIFY_SECRET: props.verificationSecret }
        : {}),
      ...(props.passwordResetBaseUrl
        ? { PASSWORD_RESET_BASE_URL: props.passwordResetBaseUrl }
        : {}),
    };

    const handlerPath = (...segments: string[]) =>
      path.resolve(__dirname, '../../../../../..', ...segments);

    this.authorizer = new HttpUserPoolAuthorizer(
      'AuthJwtAuthorizer',
      props.userPool,
      {
        userPoolClients: [props.userPoolClient],
        identitySource: ['$request.header.Authorization'],
      }
    );

    const registerFn = this.createAuthFn(
      'RegisterHandler',
      stage,
      handlerPath('libs/api-auth/src/register.handler.ts'),
      commonEnv,
      props.depsLayer,
      props.sesLayer,
      props.ddbLayer
    );
    const confirmEmailFn = this.createAuthFn(
      'ConfirmEmailHandler',
      stage,
      handlerPath('libs/api-auth/src/confirm-email.handler.ts'),
      commonEnv,
      props.depsLayer,
      props.sesLayer,
      props.ddbLayer
    );
    const loginFn = this.createAuthFn(
      'LoginHandler',
      stage,
      handlerPath('libs/api-auth/src/login.handler.ts'),
      commonEnv,
      props.depsLayer,
      props.sesLayer,
      props.ddbLayer
    );
    const refreshTokenFn = this.createAuthFn(
      'RefreshTokenHandler',
      stage,
      handlerPath('libs/api-auth/src/refresh-token.handler.ts'),
      commonEnv,
      props.depsLayer,
      props.sesLayer,
      props.ddbLayer
    );
    const forgotPasswordFn = this.createAuthFn(
      'ForgotPasswordHandler',
      stage,
      handlerPath('libs/api-auth/src/forgot-password.handler.ts'),
      commonEnv,
      props.depsLayer,
      props.sesLayer,
      props.ddbLayer
    );
    const completeNewPasswordFn = this.createAuthFn(
      'CompleteNewPasswordHandler',
      stage,
      handlerPath('libs/api-auth/src/complete-new-password.handler.ts'),
      commonEnv,
      props.depsLayer,
      props.sesLayer,
      props.ddbLayer
    );
    const getUserProfileFn = this.createAuthFn(
      'GetUserProfileHandler',
      stage,
      handlerPath('libs/api-auth/src/handlers/get-user-profile.handler.ts'),
      commonEnv,
      props.depsLayer,
      props.sesLayer,
      props.ddbLayer
    );
    const getUserSettingsFn = this.createAuthFn(
      'GetUserSettingsHandler',
      stage,
      handlerPath('libs/api-auth/src/handlers/get-user-settings.handler.ts'),
      commonEnv,
      props.depsLayer,
      props.sesLayer,
      props.ddbLayer
    );
    const updateUserProfileFn = this.createAuthFn(
      'UpdateUserProfileHandler',
      stage,
      handlerPath('libs/api-auth/src/handlers/update-user-profile.handler.ts'),
      commonEnv,
      props.depsLayer,
      props.sesLayer,
      props.ddbLayer
    );
    const updateUserSettingsFn = this.createAuthFn(
      'UpdateUserSettingsHandler',
      stage,
      handlerPath('libs/api-auth/src/handlers/update-user-settings.handler.ts'),
      commonEnv,
      props.depsLayer,
      props.sesLayer,
      props.ddbLayer
    );
    const deleteUserFn = this.createAuthFn(
      'DeleteUserHandler',
      stage,
      handlerPath('libs/api-auth/src/handlers/delete-user.handler.ts'),
      commonEnv,
      props.depsLayer,
      props.sesLayer,
      props.ddbLayer
    );

    const cognitoActions = [
      'cognito-idp:AdminCreateUser',
      'cognito-idp:AdminSetUserPassword',
      'cognito-idp:AdminConfirmSignUp',
      'cognito-idp:AdminUpdateUserAttributes',
      'cognito-idp:AdminDeleteUser',
      'cognito-idp:InitiateAuth',
      'cognito-idp:RespondToAuthChallenge',
      'cognito-idp:ForgotPassword',
    ];
    [
      registerFn,
      confirmEmailFn,
      loginFn,
      refreshTokenFn,
      forgotPasswordFn,
      completeNewPasswordFn,
      deleteUserFn,
    ].forEach((fn) => {
      fn.addToRolePolicy(
        new iam.PolicyStatement({
          actions: cognitoActions,
          resources: [props.userPool.userPoolArn],
        })
      );
      if (props.sesFromEmail) {
        fn.addToRolePolicy(
          new iam.PolicyStatement({
            actions: [
              'ses:SendEmail',
              'ses:SendTemplatedEmail',
              'ses:SendRawEmail',
            ],
            resources: ['*'],
          })
        );
      }
    });

    props.table.grantReadWriteData(registerFn);
    props.table.grantReadData(getUserProfileFn);
    props.table.grantReadData(getUserSettingsFn);
    props.table.grantReadWriteData(updateUserProfileFn);
    props.table.grantReadWriteData(updateUserSettingsFn);
    props.table.grantReadWriteData(deleteUserFn);
    props.docsBucket.grantReadWrite(deleteUserFn);

    this.httpApi = new apigwv2.HttpApi(this, 'AuthHttpApi', {
      apiName: `PettziAuthApi-${stage}`,
      description: `Auth API for Pettzi (${stage})`,
      createDefaultStage: true,
      corsPreflight: {
        allowOrigins: ['http://localhost:4200', 'https://app.pettzi.net'],
        allowMethods: [
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.POST,
          apigwv2.CorsHttpMethod.PATCH,
          apigwv2.CorsHttpMethod.DELETE,
          apigwv2.CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: ['authorization', 'content-type'],
        allowCredentials: true,
      },
    });

    this.addApiGatewayAlarm('AuthApi5xxAlarm', this.httpApi.apiId);

    this.httpApi.addRoutes({
      path: '/register',
      methods: [apigwv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration('RegisterIntegration', registerFn),
    });

    // TODO: Convert to post when frontend can make the
    this.httpApi.addRoutes({
      path: '/confirm-email',
      methods: [apigwv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration(
        'ConfirmEmailIntegration',
        confirmEmailFn
      ),
    });
    this.httpApi.addRoutes({
      path: '/login',
      methods: [apigwv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration('LoginIntegration', loginFn),
    });
    this.httpApi.addRoutes({
      path: '/refresh',
      methods: [apigwv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration(
        'RefreshTokenIntegration',
        refreshTokenFn
      ),
    });
    this.httpApi.addRoutes({
      path: '/forgot-password',
      methods: [apigwv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration(
        'ForgotPasswordIntegration',
        forgotPasswordFn
      ),
    });
    this.httpApi.addRoutes({
      path: '/complete-new-password',
      methods: [apigwv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration(
        'CompleteNewPasswordIntegration',
        completeNewPasswordFn
      ),
    });
    this.httpApi.addRoutes({
      path: '/me',
      methods: [apigwv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration(
        'GetUserProfileIntegration',
        getUserProfileFn
      ),
      authorizer: this.authorizer,
    });
    this.httpApi.addRoutes({
      path: '/settings',
      methods: [apigwv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration(
        'GetUserSettingsIntegration',
        getUserSettingsFn
      ),
      authorizer: this.authorizer,
    });
    this.httpApi.addRoutes({
      path: '/me',
      methods: [apigwv2.HttpMethod.PATCH],
      integration: new HttpLambdaIntegration(
        'UpdateUserProfileIntegration',
        updateUserProfileFn
      ),
      authorizer: this.authorizer,
    });
    this.httpApi.addRoutes({
      path: '/settings',
      methods: [apigwv2.HttpMethod.PATCH],
      integration: new HttpLambdaIntegration(
        'UpdateUserSettingsIntegration',
        updateUserSettingsFn
      ),
      authorizer: this.authorizer,
    });
    this.httpApi.addRoutes({
      path: '/me',
      methods: [apigwv2.HttpMethod.DELETE],
      integration: new HttpLambdaIntegration(
        'DeleteUserIntegration',
        deleteUserFn
      ),
      authorizer: this.authorizer,
    });

    new CfnOutput(this, 'AuthApiUrl', {
      value: this.httpApi.apiEndpoint,
      exportName: `PettziAuthApiUrl-${stage}`,
    });
  }

  private createAuthFn(
    id: string,
    stage: string,
    entry: string,
    environment: Record<string, string>,
    depsLayer?: lambda.ILayerVersion,
    sesLayer?: lambda.ILayerVersion,
    ddbLayer?: lambda.ILayerVersion
  ): NodejsFunction {
    const layers = [depsLayer, sesLayer, ddbLayer].filter(
      (l): l is lambda.ILayerVersion => Boolean(l)
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
      functionName: `${id}-${stage}`,
      handler: 'handler',
      tracing: lambda.Tracing.ACTIVE,
      memorySize: 256,
      logGroup,
      bundling: {
        tsconfig: path.resolve(__dirname, '../../../../../..', 'tsconfig.base.json'),
        target: 'node24',
        format: OutputFormat.CJS,
        platform: 'node',
        externalModules: layers.length
          ? [
              '@aws-sdk/client-cognito-identity-provider',
              '@aws-sdk/client-ses',
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
