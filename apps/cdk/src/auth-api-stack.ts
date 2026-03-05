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
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as ssm from 'aws-cdk-lib/aws-ssm';
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
  depsLayerSsmParamName?: string;
  sesLayerSsmParamName?: string;
  ddbLayerSsmParamName?: string;
  sesFromEmail?: string;
  welcomeTemplateName?: string;
  welcomeTemplateNameEs?: string;
  welcomeTemplateNameEn?: string;
  resetTemplateName?: string;
  resetTemplateNameEs?: string;
  resetTemplateNameEn?: string;
  verificationBaseUrl?: string;
  passwordResetBaseUrl?: string;
  appDomain?: string;
  alarmTopic?: sns.ITopic;
}

export class AuthApiStack extends Stack {
  public readonly httpApi: apigwv2.HttpApi;
  public readonly authorizer: HttpUserPoolAuthorizer;
  private readonly alarmTopic?: sns.ITopic;
  private readonly stageName: string;

  constructor(scope: Construct, id: string, props: AuthApiStackProps) {
    super(scope, id, props);

    const stage =
      this.node.tryGetContext('stage') ?? process.env.STAGE ?? 'dev';
    this.stageName = stage.toLowerCase();
    Tags.of(this).add('project', 'pettzi');
    Tags.of(this).add('AppManagerCFNStackKey', id);
    this.alarmTopic = props.alarmTopic;

    const emailVerifySecret = new secretsmanager.Secret(this, 'EmailVerifySecret', {
      description: `Email verification HMAC secret (${stage})`,
      generateSecretString: {
        passwordLength: 64,
        excludePunctuation: true,
      },
    });

    const commonEnv = {
      COGNITO_USER_POOL_ID: props.userPool.userPoolId,
      COGNITO_USER_POOL_CLIENT_ID: props.userPoolClient.userPoolClientId,
      PETTZI_TABLE_NAME: props.table.tableName,
      PETTZI_DOCS_BUCKET_NAME: props.docsBucket.bucketName,
      STAGE: stage,
      EMAIL_VERIFY_SECRET_ARN: emailVerifySecret.secretArn,
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
      ...(props.passwordResetBaseUrl
        ? { PASSWORD_RESET_BASE_URL: props.passwordResetBaseUrl }
        : {}),
    };

    const handlerPath = (...segments: string[]) =>
      path.resolve(__dirname, '../../../../../..', ...segments);

    const depsLayer = this.resolveLayer(
      props.depsLayer,
      props.depsLayerSsmParamName,
      'DepsLayer'
    );
    const sesLayer = this.resolveLayer(
      props.sesLayer,
      props.sesLayerSsmParamName,
      'SesLayer'
    );
    const ddbLayer = this.resolveLayer(
      props.ddbLayer,
      props.ddbLayerSsmParamName,
      'DdbLayer'
    );

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
      depsLayer,
      sesLayer,
      ddbLayer
    );
    const confirmEmailFn = this.createAuthFn(
      'ConfirmEmailHandler',
      stage,
      handlerPath('libs/api-auth/src/confirm-email.handler.ts'),
      commonEnv,
      depsLayer,
      sesLayer,
      ddbLayer
    );
    const loginFn = this.createAuthFn(
      'LoginHandler',
      stage,
      handlerPath('libs/api-auth/src/login.handler.ts'),
      commonEnv,
      depsLayer,
      sesLayer,
      ddbLayer
    );
    const refreshTokenFn = this.createAuthFn(
      'RefreshTokenHandler',
      stage,
      handlerPath('libs/api-auth/src/refresh-token.handler.ts'),
      commonEnv,
      depsLayer,
      sesLayer,
      ddbLayer
    );
    const forgotPasswordFn = this.createAuthFn(
      'ForgotPasswordHandler',
      stage,
      handlerPath('libs/api-auth/src/forgot-password.handler.ts'),
      commonEnv,
      depsLayer,
      sesLayer,
      ddbLayer
    );
    const completeNewPasswordFn = this.createAuthFn(
      'CompleteNewPasswordHandler',
      stage,
      handlerPath('libs/api-auth/src/complete-new-password.handler.ts'),
      commonEnv,
      depsLayer,
      sesLayer,
      ddbLayer
    );
    const getUserProfileFn = this.createAuthFn(
      'GetUserProfileHandler',
      stage,
      handlerPath('libs/api-auth/src/handlers/get-user-profile.handler.ts'),
      commonEnv,
      depsLayer,
      sesLayer,
      ddbLayer
    );
    const getUserSettingsFn = this.createAuthFn(
      'GetUserSettingsHandler',
      stage,
      handlerPath('libs/api-auth/src/handlers/get-user-settings.handler.ts'),
      commonEnv,
      depsLayer,
      sesLayer,
      ddbLayer
    );
    const updateUserProfileFn = this.createAuthFn(
      'UpdateUserProfileHandler',
      stage,
      handlerPath('libs/api-auth/src/handlers/update-user-profile.handler.ts'),
      commonEnv,
      depsLayer,
      sesLayer,
      ddbLayer
    );
    const updateUserSettingsFn = this.createAuthFn(
      'UpdateUserSettingsHandler',
      stage,
      handlerPath('libs/api-auth/src/handlers/update-user-settings.handler.ts'),
      commonEnv,
      depsLayer,
      sesLayer,
      ddbLayer
    );
    const deleteUserFn = this.createAuthFn(
      'DeleteUserHandler',
      stage,
      handlerPath('libs/api-auth/src/handlers/delete-user.handler.ts'),
      commonEnv,
      depsLayer,
      sesLayer,
      ddbLayer
    );

    const authFns = [
      registerFn,
      confirmEmailFn,
      loginFn,
      refreshTokenFn,
      forgotPasswordFn,
      completeNewPasswordFn,
      getUserProfileFn,
      getUserSettingsFn,
      updateUserProfileFn,
      updateUserSettingsFn,
      deleteUserFn,
    ];
    authFns.forEach((fn) => emailVerifySecret.grantRead(fn));

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

    const corsOrigins = new Set(['http://localhost:4200', 'https://app.pettzi.net']);
    if (props.appDomain) {
      corsOrigins.add(
        props.appDomain.startsWith('http')
          ? props.appDomain
          : `https://${props.appDomain}`
      );
    }

    this.httpApi = new apigwv2.HttpApi(this, 'AuthHttpApi', {
      apiName: `PettziAuthApi-${stage}`,
      description: `Auth API for Pettzi (${stage})`,
      createDefaultStage: true,
      corsPreflight: {
        allowOrigins: Array.from(corsOrigins),
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
              '@aws-sdk/client-cognito-identity-provider',
              '@aws-sdk/client-ses',
              '@aws-sdk/client-secrets-manager',
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
