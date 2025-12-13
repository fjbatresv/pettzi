import { Duration, Stack, StackProps, CfnOutput, Tags } from 'aws-cdk-lib';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { HttpUserPoolAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { UserPool, UserPoolClient } from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';
import * as path from 'path';

export interface CatalogsApiStackProps extends StackProps {
  userPool: UserPool;
  userPoolClient: UserPoolClient;
  sharedLayer?: lambda.ILayerVersion;
  stage: string;
}

export class CatalogsApiStack extends Stack {
  public readonly httpApi: apigwv2.HttpApi;

  constructor(scope: Construct, id: string, props: CatalogsApiStackProps) {
    super(scope, id, props);

    Tags.of(this).add('project', 'pettzi');
    Tags.of(this).add('AppManagerCFNStackKey', id);

    const handlerPath = (...segments: string[]) =>
      path.resolve(__dirname, '../../../../../..', ...segments);

    const commonEnv = {
      STAGE: props.stage,
    };

    const speciesFn = this.createFn(
      'GetSpeciesHandler',
      handlerPath('libs/api-catalogs/src/handlers/get-species.handler.ts'),
      commonEnv,
      [props.sharedLayer],
    );
    const breedsFn = this.createFn(
      'GetBreedsHandler',
      handlerPath('libs/api-catalogs/src/handlers/get-breeds.handler.ts'),
      commonEnv,
      [props.sharedLayer],
    );
    const vaccinesFn = this.createFn(
      'GetVaccinesHandler',
      handlerPath('libs/api-catalogs/src/handlers/get-vaccines.handler.ts'),
      commonEnv,
      [props.sharedLayer],
    );

    const authorizer = new HttpUserPoolAuthorizer(
      'CatalogsJwtAuthorizer',
      props.userPool,
      {
        userPoolClients: [props.userPoolClient],
        identitySource: ['$request.header.Authorization'],
      },
    );

    this.httpApi = new apigwv2.HttpApi(this, 'CatalogsHttpApi', {
      apiName: `PettziCatalogsApi-${props.stage}`,
      description: `Catalogs API for Pettzi (${props.stage})`,
      defaultAuthorizer: authorizer,
      createDefaultStage: true,
    });

    this.httpApi.addRoutes({
      path: '/species',
      methods: [apigwv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration('GetSpeciesIntegration', speciesFn),
    });
    this.httpApi.addRoutes({
      path: '/breeds',
      methods: [apigwv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration('GetBreedsIntegration', breedsFn),
    });
    this.httpApi.addRoutes({
      path: '/vaccines',
      methods: [apigwv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration('GetVaccinesIntegration', vaccinesFn),
    });

    new CfnOutput(this, 'CatalogsApiUrl', {
      value: this.httpApi.apiEndpoint,
      exportName: `PettziCatalogsApiUrl-${props.stage}`,
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
    const external =
      layers.length > 0
        ? ['@pettzi/domain-model', '@pettzi/utils-dynamo', '@pettzi/shared-utils']
        : [];

    return new NodejsFunction(this, id, {
      runtime: lambda.Runtime.NODEJS_24_X,
      entry,
      handler: 'handler',
      bundling: {
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
