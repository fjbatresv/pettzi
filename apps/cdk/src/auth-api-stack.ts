import {
  CfnOutput,
  Stack,
  StackProps,
  Duration,
  aws_iam as iam,
  Tags
} from 'aws-cdk-lib';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { HttpUserPoolAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import {
  UserPool,
  UserPoolClient,
} from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';
import * as path from 'path';

export interface AuthApiStackProps extends StackProps {
  userPool: UserPool;
  userPoolClient: UserPoolClient;
  depsLayer?: lambda.ILayerVersion;
}

export class AuthApiStack extends Stack {
  public readonly httpApi: apigwv2.HttpApi;
  public readonly authorizer: HttpUserPoolAuthorizer;

  constructor(scope: Construct, id: string, props: AuthApiStackProps) {
    super(scope, id, props);

    const stage = this.node.tryGetContext('stage') ?? process.env.STAGE ?? 'dev';
    Tags.of(this).add('project', 'peto');
    Tags.of(this).add('AppManagerCFNStackKey', id);


    const commonEnv = {
      COGNITO_USER_POOL_ID: props.userPool.userPoolId,
      COGNITO_USER_POOL_CLIENT_ID: props.userPoolClient.userPoolClientId,
      STAGE: stage,
    };

    const handlerPath = (...segments: string[]) =>
      path.resolve(__dirname, '../../../../../..', ...segments);

    this.authorizer = new HttpUserPoolAuthorizer(
      'AuthJwtAuthorizer',
      props.userPool,
      {
        userPoolClients: [props.userPoolClient],
        identitySource: ['$request.header.Authorization'],
      },
    );

    const registerFn = this.createAuthFn(
      'RegisterHandler',
      handlerPath('libs/api-auth/src/register.handler.ts'),
      commonEnv,
      props.depsLayer
    );
    const loginFn = this.createAuthFn(
      'LoginHandler',
      handlerPath('libs/api-auth/src/login.handler.ts'),
      commonEnv,
      props.depsLayer
    );
    const forgotPasswordFn = this.createAuthFn(
      'ForgotPasswordHandler',
      handlerPath('libs/api-auth/src/forgot-password.handler.ts'),
      commonEnv,
      props.depsLayer
    );
    const confirmForgotPasswordFn = this.createAuthFn(
      'ConfirmForgotPasswordHandler',
      handlerPath('libs/api-auth/src/confirm-forgot-password.handler.ts'),
      commonEnv,
      props.depsLayer
    );

    const cognitoActions = [
      'cognito-idp:SignUp',
      'cognito-idp:InitiateAuth',
      'cognito-idp:ForgotPassword',
      'cognito-idp:ConfirmForgotPassword',
    ];
    [
      registerFn,
      loginFn,
      forgotPasswordFn,
      confirmForgotPasswordFn,
    ].forEach((fn) => {
      fn.addToRolePolicy(
        new iam.PolicyStatement({
          actions: cognitoActions,
          resources: [props.userPool.userPoolArn],
        })
      );
    });

    this.httpApi = new apigwv2.HttpApi(this, 'AuthHttpApi', {
      apiName: `PetoAuthApi-${stage}`,
      description: `Auth API for Peto (${stage})`,
      defaultAuthorizer: this.authorizer,
      createDefaultStage: true,
    });

    this.httpApi.addRoutes({
      path: '/auth/register',
      methods: [apigwv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration('RegisterIntegration', registerFn),
    });
    this.httpApi.addRoutes({
      path: '/auth/login',
      methods: [apigwv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration('LoginIntegration', loginFn),
    });
    this.httpApi.addRoutes({
      path: '/auth/forgot-password',
      methods: [apigwv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration(
        'ForgotPasswordIntegration',
        forgotPasswordFn
      ),
    });
    this.httpApi.addRoutes({
      path: '/auth/confirm-forgot-password',
      methods: [apigwv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration(
        'ConfirmForgotPasswordIntegration',
        confirmForgotPasswordFn
      ),
    });

    new CfnOutput(this, 'AuthApiUrl', {
      value: this.httpApi.apiEndpoint,
      exportName: `PetoAuthApiUrl-${stage}`,
    });

  }

  private createAuthFn(
    id: string,
    entry: string,
    environment: Record<string, string>,
    depsLayer?: lambda.ILayerVersion
  ): NodejsFunction {
    const layers = depsLayer ? [depsLayer] : [];

    return new NodejsFunction(this, id, {
      runtime: lambda.Runtime.NODEJS_24_X,
      entry,
      functionName: id,
      handler: 'handler',
      bundling: {
        target: 'node24',
        format: OutputFormat.CJS,
        platform: 'node',
        externalModules: depsLayer
          ? ['@aws-sdk/client-cognito-identity-provider']
          : [],
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
