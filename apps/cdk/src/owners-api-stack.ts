import { Duration, Stack, StackProps, CfnOutput, Tags } from 'aws-cdk-lib';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { HttpUserPoolAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { UserPool, UserPoolClient } from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';
import * as path from 'path';

export interface OwnersApiStackProps extends StackProps {
  table: dynamodb.Table;
  userPool: UserPool;
  userPoolClient: UserPoolClient;
  sharedLayer?: lambda.ILayerVersion;
  ddbLayer?: lambda.ILayerVersion;
  stage: string;
}

export class OwnersApiStack extends Stack {
  public readonly httpApi: apigwv2.HttpApi;

  constructor(scope: Construct, id: string, props: OwnersApiStackProps) {
    super(scope, id, props);

    Tags.of(this).add('project', 'pettzi');
    Tags.of(this).add('AppManagerCFNStackKey', id);

    const handlerPath = (...segments: string[]) =>
      path.resolve(__dirname, '../../../../../..', ...segments);

    const commonEnv = {
      PETTZI_TABLE_NAME: props.table.tableName,
      STAGE: props.stage,
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

    props.table.grantReadWriteData(getMeFn);
    props.table.grantReadWriteData(listOwnersFn);
    props.table.grantReadWriteData(addOwnerFn);
    props.table.grantReadWriteData(removeOwnerFn);

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
            '@aws-sdk/client-dynamodb',
            '@aws-sdk/lib-dynamodb',
          ]
        : [];

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
