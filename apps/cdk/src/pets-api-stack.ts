import { Duration, Stack, StackProps, Tags } from 'aws-cdk-lib';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { HttpUserPoolAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { UserPool, UserPoolClient } from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';
import * as path from 'path';

export interface PetsApiStackProps extends StackProps {
  table: dynamodb.Table;
  depsLayer?: lambda.ILayerVersion;
  userPool: UserPool;
  userPoolClient: UserPoolClient;
  s3Layer?: lambda.ILayerVersion;
  ddbLayer?: lambda.ILayerVersion;
}

export class PetsApiStack extends Stack {
  public readonly httpApi: apigwv2.HttpApi;

  constructor(scope: Construct, id: string, props: PetsApiStackProps) {
    super(scope, id, props);

    const stage = this.node.tryGetContext('stage') ?? process.env.STAGE ?? 'dev';
    Tags.of(this).add('project', 'peto');
    Tags.of(this).add('AppManagerCFNStackKey', id);

    const handlerPath = (...segments: string[]) =>
      path.resolve(__dirname, '../../../../../..', ...segments);

    const commonEnv = {
      PETO_TABLE_NAME: props.table.tableName,
      STAGE: stage,
    };

    const createPetFn = this.createFn(
      'CreatePetHandler',
      handlerPath('libs/api-pets/src/handlers/create-pet.handler.ts'),
      commonEnv,
      [props.depsLayer, props.s3Layer, props.ddbLayer],
    );
    const listPetsFn = this.createFn(
      'ListPetsHandler',
      handlerPath('libs/api-pets/src/handlers/list-pets.handler.ts'),
      commonEnv,
      [props.depsLayer, props.s3Layer, props.ddbLayer],
    );
    const getPetFn = this.createFn(
      'GetPetHandler',
      handlerPath('libs/api-pets/src/handlers/get-pet.handler.ts'),
      commonEnv,
      [props.depsLayer, props.s3Layer, props.ddbLayer],
    );
    const updatePetFn = this.createFn(
      'UpdatePetHandler',
      handlerPath('libs/api-pets/src/handlers/update-pet.handler.ts'),
      commonEnv,
      [props.depsLayer, props.s3Layer, props.ddbLayer],
    );
    const archivePetFn = this.createFn(
      'ArchivePetHandler',
      handlerPath('libs/api-pets/src/handlers/archive-pet.handler.ts'),
      commonEnv,
      [props.depsLayer, props.s3Layer, props.ddbLayer],
    );

    props.table.grantReadWriteData(createPetFn);
    props.table.grantReadWriteData(listPetsFn);
    props.table.grantReadWriteData(getPetFn);
    props.table.grantReadWriteData(updatePetFn);
    props.table.grantReadWriteData(archivePetFn);

    const authorizer = new HttpUserPoolAuthorizer(
      'PetsJwtAuthorizer',
      props.userPool,
      {
        userPoolClients: [props.userPoolClient],
        identitySource: ['$request.header.Authorization'],
      },
    );

    this.httpApi = new apigwv2.HttpApi(this, 'PetsHttpApi', {
      apiName: `PetoPetsApi-${stage}`,
      description: `Pets API for Peto (${stage})`,
      defaultAuthorizer: authorizer,
      createDefaultStage: true,
    });

    this.httpApi.addRoutes({
      path: '/pets',
      methods: [apigwv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration('CreatePetIntegration', createPetFn),
    });
    this.httpApi.addRoutes({
      path: '/pets',
      methods: [apigwv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration('ListPetsIntegration', listPetsFn),
    });
    this.httpApi.addRoutes({
      path: '/pets/{petId}',
      methods: [apigwv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration('GetPetIntegration', getPetFn),
    });
    this.httpApi.addRoutes({
      path: '/pets/{petId}',
      methods: [apigwv2.HttpMethod.PATCH],
      integration: new HttpLambdaIntegration('UpdatePetIntegration', updatePetFn),
    });
    this.httpApi.addRoutes({
      path: '/pets/{petId}',
      methods: [apigwv2.HttpMethod.DELETE],
      integration: new HttpLambdaIntegration('ArchivePetIntegration', archivePetFn),
    });
  }

  private createFn(
    id: string,
    entry: string,
    environment: Record<string, string>,
    layersInput: Array<lambda.ILayerVersion | undefined>,
  ): NodejsFunction {
    const layers = layersInput.filter(
      (l): l is lambda.ILayerVersion => Boolean(l)
    );

    return new NodejsFunction(this, id, {
      runtime: lambda.Runtime.NODEJS_24_X,
      entry,
      handler: 'handler',
      bundling: {
        target: 'node24',
        format: OutputFormat.CJS,
        platform: 'node',
        externalModules: layers.length
          ? [
              '@peto/domain-model',
              '@peto/utils-dynamo',
              '@peto/shared-utils',
              '@aws-sdk/client-s3',
              '@aws-sdk/s3-request-presigner',
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
  }
}
