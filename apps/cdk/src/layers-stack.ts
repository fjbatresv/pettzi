import { RemovalPolicy, Stack, StackProps, Tags } from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import * as path from 'path';

export interface LayersStackProps extends StackProps {
  stage?: string;
}

export class LayersStack extends Stack {
  public static cognitoLayerArnParam(stage: string): string {
    return `/pettzi/${stage}/layers/cognito/arn`;
  }

  public static s3LayerArnParam(stage: string): string {
    return `/pettzi/${stage}/layers/s3/arn`;
  }

  public static sesLayerArnParam(stage: string): string {
    return `/pettzi/${stage}/layers/ses/arn`;
  }

  public static ddbLayerArnParam(stage: string): string {
    return `/pettzi/${stage}/layers/ddb/arn`;
  }

  public readonly cognitoDepsLayer: lambda.LayerVersion;
  public readonly s3DepsLayer: lambda.LayerVersion;
  public readonly sesDepsLayer: lambda.LayerVersion;
  public readonly ddbDepsLayer: lambda.LayerVersion;

  constructor(scope: Construct, id: string, props?: LayersStackProps) {
    super(scope, id, props);

    Tags.of(this).add('project', 'pettzi');
    Tags.of(this).add('AppManagerCFNStackKey', id);


    const stage = (props?.stage ?? process.env.STAGE ?? 'dev')
      .toLowerCase()
      .replaceAll(/[^a-z0-9-]/g, '-');

    const layerRoot = path.resolve(process.cwd(), '../../layers');

    this.cognitoDepsLayer = this.createLayer(
      'CognitoDepsLayer',
      path.join(layerRoot, 'cognito-deps'),
      `cognito SDK deps (${stage})`,
      `pettzi-cognito-deps-${stage}`,
    );

    this.s3DepsLayer = this.createLayer(
      'S3DepsLayer',
      path.join(layerRoot, 's3-deps'),
      `S3 SDK deps (${stage})`,
      `pettzi-s3-deps-${stage}`,
    );

    this.sesDepsLayer = this.createLayer(
      'SesDepsLayer',
      path.join(layerRoot, 'ses-deps'),
      `SES SDK deps (${stage})`,
      `pettzi-ses-deps-${stage}`,
    );

    this.ddbDepsLayer = this.createLayer(
      'DdbDepsLayer',
      path.join(layerRoot, 'ddb-deps'),
      `DDB SDK deps (${stage})`,
      `pettzi-ddb-deps-${stage}`,
    );

    new ssm.StringParameter(this, 'CognitoLayerArnParameter', {
      parameterName: LayersStack.cognitoLayerArnParam(stage),
      stringValue: this.cognitoDepsLayer.layerVersionArn,
    });
    new ssm.StringParameter(this, 'S3LayerArnParameter', {
      parameterName: LayersStack.s3LayerArnParam(stage),
      stringValue: this.s3DepsLayer.layerVersionArn,
    });
    new ssm.StringParameter(this, 'SesLayerArnParameter', {
      parameterName: LayersStack.sesLayerArnParam(stage),
      stringValue: this.sesDepsLayer.layerVersionArn,
    });
    new ssm.StringParameter(this, 'DdbLayerArnParameter', {
      parameterName: LayersStack.ddbLayerArnParam(stage),
      stringValue: this.ddbDepsLayer.layerVersionArn,
    });
  }

  private createLayer(
    id: string,
    assetPath: string,
    description: string,
    layerVersionName: string,
  ): lambda.LayerVersion {
    return new lambda.LayerVersion(this, id, {
      code: lambda.Code.fromAsset(assetPath),
      compatibleRuntimes: [lambda.Runtime.NODEJS_24_X],
      description,
      layerVersionName,
      compatibleArchitectures: [lambda.Architecture.ARM_64, lambda.Architecture.X86_64],
      removalPolicy: RemovalPolicy.RETAIN,
    });
  }
}
