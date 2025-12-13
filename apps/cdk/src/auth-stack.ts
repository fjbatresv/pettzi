import { RemovalPolicy, Stack, StackProps, Tags } from 'aws-cdk-lib';
import {
  UserPool,
  UserPoolClient,
  AccountRecovery,
  VerificationEmailStyle,
} from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';

export interface AuthStackProps extends StackProps {
  stage?: string;
}

export class AuthStack extends Stack {
  public readonly userPool: UserPool;
  public readonly userPoolClient: UserPoolClient;

  constructor(scope: Construct, id: string, props?: AuthStackProps) {
    super(scope, id, props);

    Tags.of(this).add('project', 'pettzi');
    Tags.of(this).add('AppManagerCFNStackKey', id);


    this.userPool = new UserPool(this, 'PettziUserPool', {
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
        username: false,
        phone: false,
        preferredUsername: false,
      },
      autoVerify: {
        email: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: false,
        },
      },
      passwordPolicy: {
        minLength: 8,
        requireDigits: true,
        requireLowercase: true,
        requireUppercase: false,
        requireSymbols: false,
      },
      accountRecovery: AccountRecovery.EMAIL_ONLY,
      removalPolicy: RemovalPolicy.DESTROY,
      userVerification: {
        emailStyle: VerificationEmailStyle.CODE,
      },
    });

    this.userPoolClient = new UserPoolClient(this, 'PettziWebClient', {
      userPool: this.userPool,
      generateSecret: false,
      authFlows: {
        userPassword: true,
        userSrp: false,
        adminUserPassword: false,
        custom: false,
      },
    });
  }
}
