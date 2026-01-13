import { Stack, StackProps, Duration, CfnOutput, Tags } from 'aws-cdk-lib';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { HttpUserPoolAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { UserPool, UserPoolClient } from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';
import * as path from 'path';

export interface EventsApiStackProps extends StackProps {
  table: dynamodb.Table;
  userPool: UserPool;
  userPoolClient: UserPoolClient;
  sharedLayer?: lambda.ILayerVersion;
  stage?: string;
}

export class EventsApiStack extends Stack {
  public readonly httpApi: apigwv2.HttpApi;

  constructor(scope: Construct, id: string, props: EventsApiStackProps) {
    super(scope, id, props);

    const stage =
      this.node.tryGetContext('stage') ??
      props.stage ??
      process.env.STAGE ??
      'dev';
    Tags.of(this).add('project', 'pettzi');
    Tags.of(this).add('AppManagerCFNStackKey', id);

    const handlerPath = (...segments: string[]) =>
      path.resolve(__dirname, '../../../../../..', ...segments);

    const commonEnv = {
      PETTZI_TABLE_NAME: props.table.tableName,
      STAGE: stage,
    };

    const createEventFn = this.createFn(
      'CreatePetEventHandler',
      stage,
      handlerPath('libs/api-events/src/handlers/create-event.handler.ts'),
      commonEnv,
      props.sharedLayer
    );
    const listEventsFn = this.createFn(
      'ListPetEventsHandler',
      stage,
      handlerPath('libs/api-events/src/handlers/list-events.handler.ts'),
      commonEnv,
      props.sharedLayer
    );
    const getEventFn = this.createFn(
      'GetPetEventHandler',
      stage,
      handlerPath('libs/api-events/src/handlers/get-event.handler.ts'),
      commonEnv,
      props.sharedLayer
    );
    const updateEventFn = this.createFn(
      'UpdatePetEventHandler',
      stage,
      handlerPath('libs/api-events/src/handlers/update-event.handler.ts'),
      commonEnv,
      props.sharedLayer
    );
    const deleteEventFn = this.createFn(
      'DeletePetEventHandler',
      stage,
      handlerPath('libs/api-events/src/handlers/delete-event.handler.ts'),
      commonEnv,
      props.sharedLayer
    );

    props.table.grantReadWriteData(createEventFn);
    props.table.grantReadWriteData(listEventsFn);
    props.table.grantReadWriteData(getEventFn);
    props.table.grantReadWriteData(updateEventFn);
    props.table.grantReadWriteData(deleteEventFn);

    const authorizer = new HttpUserPoolAuthorizer(
      'EventsJwtAuthorizer',
      props.userPool,
      {
        userPoolClients: [props.userPoolClient],
        identitySource: ['$request.header.Authorization'],
      }
    );

    this.httpApi = new apigwv2.HttpApi(this, 'EventsHttpApi', {
      apiName: `PettziEventsApi-${stage}`,
      description: `Events API for Pettzi (${stage})`,
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
      path: '/pets/{petId}',
      methods: [apigwv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration(
        'CreateEventIntegration',
        createEventFn
      ),
    });
    this.httpApi.addRoutes({
      path: '/pets/{petId}',
      methods: [apigwv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration(
        'ListEventsIntegration',
        listEventsFn
      ),
    });
    this.httpApi.addRoutes({
      path: '/pets/{petId}/{eventId}',
      methods: [apigwv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration('GetEventIntegration', getEventFn),
    });
    this.httpApi.addRoutes({
      path: '/pets/{petId}/{eventId}',
      methods: [apigwv2.HttpMethod.PATCH],
      integration: new HttpLambdaIntegration(
        'UpdateEventIntegration',
        updateEventFn
      ),
    });
    this.httpApi.addRoutes({
      path: '/pets/{petId}/{eventId}',
      methods: [apigwv2.HttpMethod.DELETE],
      integration: new HttpLambdaIntegration(
        'DeleteEventIntegration',
        deleteEventFn
      ),
    });

    new CfnOutput(this, 'EventsApiUrl', {
      value: this.httpApi.apiEndpoint,
      exportName: `PettziEventsApiUrl-${stage}`,
    });
  }

  private createFn(
    id: string,
    stage: string,
    entry: string,
    environment: Record<string, string>,
    depsLayer?: lambda.ILayerVersion
  ): NodejsFunction {
    const layers = depsLayer ? [depsLayer] : [];

    return new NodejsFunction(this, id, {
      runtime: lambda.Runtime.NODEJS_24_X,
      entry,
      handler: 'handler',
      functionName: `${id}-${stage}`,
      tracing: lambda.Tracing.ACTIVE,
      bundling: {
        tsconfig: path.resolve(__dirname, '../../../../../..', 'tsconfig.base.json'),
        target: 'node24',
        format: OutputFormat.CJS,
        platform: 'node',
        externalModules: [],
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
