import { Duration, Stack, StackProps, CfnOutput, Tags } from 'aws-cdk-lib';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { HttpUserPoolAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { UserPool, UserPoolClient } from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';
import * as path from 'path';

export interface UploadsApiStackProps extends StackProps {
  table: dynamodb.Table;
  docsBucket: s3.Bucket;
  userPool: UserPool;
  userPoolClient: UserPoolClient;
  sharedLayer?: lambda.ILayerVersion;
  s3Layer?: lambda.ILayerVersion;
  ddbLayer?: lambda.ILayerVersion;
  stage: string;
}

export class UploadsApiStack extends Stack {
  public readonly httpApi: apigwv2.HttpApi;

  constructor(scope: Construct, id: string, props: UploadsApiStackProps) {
    super(scope, id, props);

    Tags.of(this).add('project', 'pettzi');
    Tags.of(this).add('AppManagerCFNStackKey', id);

    const handlerPath = (...segments: string[]) =>
      path.resolve(__dirname, '../../../../../..', ...segments);

    const commonEnv = {
      PETTZI_TABLE_NAME: props.table.tableName,
      PETTZI_DOCS_BUCKET_NAME: props.docsBucket.bucketName,
      STAGE: props.stage,
    };

    const photoUploadFn = this.createFn(
      'GeneratePhotoUploadUrlHandler',
      props.stage,
      handlerPath(
        'libs/api-uploads/src/handlers/generate-photo-upload-url.handler.ts'
      ),
      commonEnv,
      [props.sharedLayer, props.s3Layer, props.ddbLayer]
    );
    const docUploadFn = this.createFn(
      'GenerateDocumentUploadUrlHandler',
      props.stage,
      handlerPath(
        'libs/api-uploads/src/handlers/generate-document-upload-url.handler.ts'
      ),
      commonEnv,
      [props.sharedLayer, props.s3Layer, props.ddbLayer]
    );
    const listFilesFn = this.createFn(
      'ListPetFilesHandler',
      props.stage,
      handlerPath('libs/api-uploads/src/handlers/list-pet-files.handler.ts'),
      commonEnv,
      [props.sharedLayer, props.s3Layer, props.ddbLayer]
    );
    const downloadUrlFn = this.createFn(
      'GenerateDownloadUrlHandler',
      props.stage,
      handlerPath(
        'libs/api-uploads/src/handlers/generate-download-url.handler.ts'
      ),
      commonEnv,
      [props.sharedLayer, props.s3Layer, props.ddbLayer]
    );
    const deleteFileFn = this.createFn(
      'DeleteFileHandler',
      props.stage,
      handlerPath('libs/api-uploads/src/handlers/delete-file.handler.ts'),
      commonEnv,
      [props.sharedLayer, props.s3Layer, props.ddbLayer]
    );

    props.table.grantReadData(photoUploadFn);
    props.table.grantReadData(docUploadFn);
    props.table.grantReadData(listFilesFn);
    props.table.grantReadData(downloadUrlFn);
    props.table.grantReadData(deleteFileFn);

    props.docsBucket.grantReadWrite(photoUploadFn);
    props.docsBucket.grantReadWrite(docUploadFn);
    props.docsBucket.grantReadWrite(listFilesFn);
    props.docsBucket.grantReadWrite(downloadUrlFn);
    props.docsBucket.grantReadWrite(deleteFileFn);

    const authorizer = new HttpUserPoolAuthorizer(
      'UploadsJwtAuthorizer',
      props.userPool,
      {
        identitySource: ['$request.header.Authorization'],
        userPoolClients: [props.userPoolClient],
      }
    );

    this.httpApi = new apigwv2.HttpApi(this, 'UploadsHttpApi', {
      apiName: `PettziUploadsApi-${props.stage}`,
      description: `Uploads API for Pettzi (${props.stage})`,
      defaultAuthorizer: authorizer,
      createDefaultStage: true,
    });

    this.httpApi.addRoutes({
      path: '/pets/{petId}/photo',
      methods: [apigwv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration(
        'PhotoUploadIntegration',
        photoUploadFn
      ),
    });
    this.httpApi.addRoutes({
      path: '/pets/{petId}/document',
      methods: [apigwv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration(
        'DocumentUploadIntegration',
        docUploadFn
      ),
    });
    this.httpApi.addRoutes({
      path: '/pets/{petId}',
      methods: [apigwv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration(
        'ListFilesIntegration',
        listFilesFn
      ),
    });
    this.httpApi.addRoutes({
      path: '/pets/{petId}/{fileKey}/download-url',
      methods: [apigwv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration(
        'DownloadUrlIntegration',
        downloadUrlFn
      ),
    });
    this.httpApi.addRoutes({
      path: '/pets/{petId}/{fileKey}',
      methods: [apigwv2.HttpMethod.DELETE],
      integration: new HttpLambdaIntegration(
        'DeleteFileIntegration',
        deleteFileFn
      ),
    });

    new CfnOutput(this, 'UploadsApiUrl', {
      value: this.httpApi.apiEndpoint,
      exportName: `PettziUploadsApiUrl-${props.stage}`,
    });
  }

  private createFn(
    id: string,
    stage: string,
    entry: string,
    environment: Record<string, string>,
    layersInput: Array<lambda.ILayerVersion | undefined> = []
  ): NodejsFunction {
    const layers = layersInput.filter((l): l is lambda.ILayerVersion =>
      Boolean(l)
    );
    const external =
      layers.length > 0
        ? [
            '@pettzi/domain-model',
            '@pettzi/utils-dynamo',
            '@pettzi/shared-utils',
            '@aws-sdk/client-s3',
            '@aws-sdk/s3-request-presigner',
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
