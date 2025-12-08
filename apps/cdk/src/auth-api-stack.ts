import {
  CfnOutput,
  Stack,
  StackProps,
  Duration,
  aws_iam as iam,
} from 'aws-cdk-lib';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import {
  HttpLambdaIntegration,
} from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { HttpUserPoolAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
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
  table: dynamodb.Table;
}

export class AuthApiStack extends Stack {
  public readonly httpApi: apigwv2.HttpApi;

  constructor(scope: Construct, id: string, props: AuthApiStackProps) {
    super(scope, id, props);

    const stage = this.node.tryGetContext('stage') ?? process.env.STAGE ?? 'dev';

    const commonEnv = {
      COGNITO_USER_POOL_ID: props.userPool.userPoolId,
      COGNITO_USER_POOL_CLIENT_ID: props.userPoolClient.userPoolClientId,
      STAGE: stage,
    };

    const registerFn = this.createAuthFn(
      'RegisterHandler',
      path.resolve(__dirname, '../../../../libs/api-auth/src/register.handler.ts'),
      commonEnv
    );
    const loginFn = this.createAuthFn(
      'LoginHandler',
      path.resolve(__dirname, '../../../../libs/api-auth/src/login.handler.ts'),
      commonEnv
    );
    const forgotPasswordFn = this.createAuthFn(
      'ForgotPasswordHandler',
      path.resolve(
        __dirname,
        '../../../../libs/api-auth/src/forgot-password.handler.ts'
      ),
      commonEnv
    );
    const confirmForgotPasswordFn = this.createAuthFn(
      'ConfirmForgotPasswordHandler',
      path.resolve(
        __dirname,
        '../../../../libs/api-auth/src/confirm-forgot-password.handler.ts'
      ),
      commonEnv
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

    const authorizer = new HttpUserPoolAuthorizer(
      'AuthJwtAuthorizer',
      props.userPool,
      {
        userPoolClients: [props.userPoolClient],
        identitySource: ['$request.header.Authorization'],
      }
    );

    this.httpApi = new apigwv2.HttpApi(this, 'AuthHttpApi', {
      apiName: `PetoAuthApi-${stage}`,
      description: `Auth API for Peto (${stage})`,
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
    environment: Record<string, string>
  ): NodejsFunction {
    return new NodejsFunction(this, id, {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry,
      handler: 'handler',
      bundling: {
        target: 'node20',
        format: OutputFormat.CJS,
        platform: 'node',
        sourcesContent: false,
        keepNames: true,
      },
      timeout: Duration.seconds(10),
      environment,
    });
  }
}
