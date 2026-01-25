import { Duration, Stack, StackProps, Tags } from 'aws-cdk-lib';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sns from 'aws-cdk-lib/aws-sns';
import { UserPool, UserPoolClient } from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';

export interface MonitoringStackProps extends StackProps {
  stage: string;
  alarmTopic?: sns.ITopic;
  table: dynamodb.Table;
  docsBucket: s3.Bucket;
  userPool: UserPool;
  userPoolClient: UserPoolClient;
  apis: Record<string, apigwv2.HttpApi>;
}

export class MonitoringStack extends Stack {
  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);

    const stage = props.stage.toLowerCase().replaceAll(/[^a-z0-9-]/g, '-');
    Tags.of(this).add('project', 'pettzi');
    Tags.of(this).add('AppManagerCFNStackKey', id);

    const dashboard = new cloudwatch.Dashboard(this, 'PettziDashboard', {
      dashboardName: `pettzi-${stage}-dashboard`,
    });

    const apiWidgets = this.buildApiWidgets(props.apis);
    const lambdaWidgets = this.buildLambdaWidgets();
    const dynamoWidgets = this.buildDynamoWidgets(props.table);
    const s3Widgets = this.buildS3Widgets(props.docsBucket);
    const cognitoWidgets = this.buildCognitoWidgets(props.userPool, props.userPoolClient);
    const sesWidgets = this.buildSesWidgets();
    const businessWidgets = this.buildBusinessWidgets(stage);

    dashboard.addWidgets(
      ...apiWidgets,
      ...lambdaWidgets,
      ...dynamoWidgets,
      ...s3Widgets,
      ...cognitoWidgets,
      ...sesWidgets,
      ...businessWidgets
    );

    if (props.alarmTopic) {
      this.addApiRateAlarms(props.apis, props.alarmTopic);
    }
  }

  private buildApiWidgets(apis: Record<string, apigwv2.HttpApi>) {
    const period = Duration.minutes(5);
    const requestMetrics: cloudwatch.IMetric[] = [];
    const latencyMetrics: cloudwatch.IMetric[] = [];
    const errorRateMetrics: cloudwatch.IMetric[] = [];

    Object.entries(apis).forEach(([key, api]) => {
      const dimensionsMap = { ApiId: api.apiId, Stage: '$default' };
      requestMetrics.push(
        new cloudwatch.Metric({
          namespace: 'AWS/ApiGateway',
          metricName: 'Count',
          statistic: 'Sum',
          period,
          dimensionsMap,
          label: `${key} requests`,
          id: `${key}Requests`,
        })
      );
      latencyMetrics.push(
        new cloudwatch.Metric({
          namespace: 'AWS/ApiGateway',
          metricName: 'Latency',
          statistic: 'Average',
          period,
          dimensionsMap,
          label: `${key} latency`,
          id: `${key}Latency`,
        })
      );
      const errors5xx = new cloudwatch.Metric({
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
      const errorsId = `${key}Errors`;
      const requestsId = `${key}Requests`;
      errorRateMetrics.push(
        new cloudwatch.MathExpression({
          expression: `100 * ${errorsId} / IF(${requestsId} > 0, ${requestsId}, 1)`,
          usingMetrics: { [errorsId]: errors5xx, [requestsId]: requests },
          period,
          label: `${key} 5xx %`,
        })
      );
    });

    return [
      new cloudwatch.GraphWidget({
        title: 'API Gateway Requests',
        left: requestMetrics,
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: 'API Gateway Latency (avg)',
        left: latencyMetrics,
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: 'API Gateway 5xx Error Rate',
        left: errorRateMetrics,
        width: 12,
      }),
    ];
  }

  private buildLambdaWidgets() {
    const period = Duration.minutes(5);
    return [
      new cloudwatch.GraphWidget({
        title: 'Lambda Errors (sum)',
        left: [
          new cloudwatch.MathExpression({
            expression:
              "SEARCH('{AWS/Lambda,FunctionName} MetricName=\"Errors\"', 'Sum', 300)",
            label: 'Lambda Errors',
            period,
          }),
        ],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: 'Lambda Duration (p90 ms)',
        left: [
          new cloudwatch.MathExpression({
            expression:
              "SEARCH('{AWS/Lambda,FunctionName} MetricName=\"Duration\"', 'p90', 300)",
            label: 'Lambda Duration p90',
            period,
          }),
        ],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: 'Lambda Throttles',
        left: [
          new cloudwatch.MathExpression({
            expression:
              "SEARCH('{AWS/Lambda,FunctionName} MetricName=\"Throttles\"', 'Sum', 300)",
            label: 'Lambda Throttles',
            period,
          }),
        ],
        width: 12,
      }),
    ];
  }

  private buildDynamoWidgets(table: dynamodb.Table) {
    const period = Duration.minutes(5);
    return [
      new cloudwatch.GraphWidget({
        title: 'DynamoDB Consumed Capacity',
        left: [
          table.metricConsumedReadCapacityUnits({ statistic: 'Sum', period }),
          table.metricConsumedWriteCapacityUnits({ statistic: 'Sum', period }),
        ],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: 'DynamoDB Throttles',
        left: [
          table.metric('ReadThrottledEvents', { statistic: 'Sum', period }),
          table.metric('WriteThrottledEvents', { statistic: 'Sum', period }),
        ],
        width: 12,
      }),
    ];
  }

  private buildS3Widgets(bucket: s3.Bucket) {
    const period = Duration.minutes(5);
    const dimensionsMap = { BucketName: bucket.bucketName, FilterId: 'AllRequests' };
    return [
      new cloudwatch.GraphWidget({
        title: 'S3 Upload Errors',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/S3',
            metricName: '4xxErrors',
            statistic: 'Sum',
            period,
            dimensionsMap,
            label: '4xxErrors',
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/S3',
            metricName: '5xxErrors',
            statistic: 'Sum',
            period,
            dimensionsMap,
            label: '5xxErrors',
          }),
        ],
        width: 12,
      }),
    ];
  }

  private buildCognitoWidgets(userPool: UserPool, userPoolClient: UserPoolClient) {
    const period = Duration.minutes(5);
    const dimensionsMap = {
      UserPool: userPool.userPoolId,
      UserPoolClient: userPoolClient.userPoolClientId,
    };
    return [
      new cloudwatch.GraphWidget({
        title: 'Cognito Sign-ups & Failed Logins',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/Cognito',
            metricName: 'SignUpSuccesses',
            statistic: 'Sum',
            period,
            dimensionsMap,
            label: 'SignUps',
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/Cognito',
            metricName: 'SignInFailures',
            statistic: 'Sum',
            period,
            dimensionsMap,
            label: 'SignInFailures',
          }),
        ],
        width: 12,
      }),
    ];
  }

  private buildSesWidgets() {
    const period = Duration.minutes(5);
    return [
      new cloudwatch.GraphWidget({
        title: 'SES Reputation',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/SES',
            metricName: 'Reputation.BounceRate',
            statistic: 'Average',
            period,
            label: 'BounceRate',
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/SES',
            metricName: 'Reputation.ComplaintRate',
            statistic: 'Average',
            period,
            label: 'ComplaintRate',
          }),
        ],
        width: 12,
      }),
    ];
  }

  private buildBusinessWidgets(stage: string) {
    const period = Duration.minutes(5);
    return [
      new cloudwatch.GraphWidget({
        title: 'Business KPIs',
        left: [
          new cloudwatch.Metric({
            namespace: 'Pettzi/Business',
            metricName: 'PetRegistrations',
            dimensionsMap: { Environment: stage },
            statistic: 'Sum',
            period,
            label: 'Pet Registrations',
          }),
        ],
        width: 12,
      }),
    ];
  }

  private addApiRateAlarms(apis: Record<string, apigwv2.HttpApi>, topic: sns.ITopic) {
    const period = Duration.minutes(5);
    Object.entries(apis).forEach(([key, api]) => {
      const dimensionsMap = { ApiId: api.apiId, Stage: '$default' };
      const errors4xx = new cloudwatch.Metric({
        namespace: 'AWS/ApiGateway',
        metricName: '4xx',
        statistic: 'Sum',
        period,
        dimensionsMap,
      });
      const errors5xx = new cloudwatch.Metric({
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
      const errorRate4xx = new cloudwatch.MathExpression({
        expression: '100 * errors / IF(requests > 0, requests, 1)',
        usingMetrics: { errors: errors4xx, requests },
        period,
        label: `${key} 4xx %`,
      });
      const errorRate5xx = new cloudwatch.MathExpression({
        expression: '100 * errors / IF(requests > 0, requests, 1)',
        usingMetrics: { errors: errors5xx, requests },
        period,
        label: `${key} 5xx %`,
      });
      const alarm4xx = new cloudwatch.Alarm(this, `${key}Api4xxRateAlarm`, {
        metric: errorRate4xx,
        threshold: 5,
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        alarmDescription: `API Gateway 4xx error rate above 5% (${key})`,
      });
      alarm4xx.addAlarmAction(new cloudwatchActions.SnsAction(topic));
      const alarm5xx = new cloudwatch.Alarm(this, `${key}Api5xxRateAlarm`, {
        metric: errorRate5xx,
        threshold: 0.5,
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        alarmDescription: `API Gateway 5xx error rate above 0.5% (${key})`,
      });
      alarm5xx.addAlarmAction(new cloudwatchActions.SnsAction(topic));
    });
  }
}
