import { Duration, RemovalPolicy, Stack, StackProps, Tags } from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import {
  UserPool,
  UserPoolClient,
  AccountRecovery,
  VerificationEmailStyle,
} from 'aws-cdk-lib/aws-cognito';
import * as sns from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';

export interface AuthStackProps extends StackProps {
  stage?: string;
  alarmTopic?: sns.ITopic;
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
        emailSubject: 'Confirma tu correo en PETTZI',
        emailBody:
          'Usa este código para verificar tu correo en PETTZI: {####}. Si no creaste la cuenta, ignora este mensaje.',
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

    if (props?.alarmTopic) {
      const failedSignIns = new cloudwatch.Metric({
        namespace: 'AWS/Cognito',
        metricName: 'SignInFailures',
        statistic: 'Sum',
        period: Duration.minutes(1),
        dimensionsMap: {
          UserPool: this.userPool.userPoolId,
          UserPoolClient: this.userPoolClient.userPoolClientId,
        },
      });
      const alarm = new cloudwatch.Alarm(this, 'CognitoFailedLoginAlarm', {
        metric: failedSignIns,
        threshold: 10,
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        alarmDescription: 'Cognito failed login attempts exceeded 10 per minute',
      });
      alarm.addAlarmAction(new cloudwatchActions.SnsAction(props.alarmTopic));
    }
  }
}
