import { RemovalPolicy, Stack, StackProps, Tags } from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import * as path from 'path';

export interface LayersStackProps extends StackProps {
  stage?: string;
}

export class LayersStack extends Stack {
  public readonly cognitoDepsLayer: lambda.LayerVersion;

  constructor(scope: Construct, id: string, props?: LayersStackProps) {
    super(scope, id, props);

    Tags.of(this).add('project', 'peto');

    const stage = (props?.stage ?? process.env.STAGE ?? 'dev')
      .toLowerCase()
      .replaceAll(/[^a-z0-9-]/g, '-');

    const layerAssetPath = path.resolve(process.cwd(), '../../layers/cognito-deps');

    this.cognitoDepsLayer = new lambda.LayerVersion(
      this,
      'CognitoDepsLayer',
      {
        code: lambda.Code.fromAsset(layerAssetPath),
        compatibleRuntimes: [lambda.Runtime.NODEJS_24_X],
        description: `Cognito SDK deps for auth lambdas (${stage})`,
        layerVersionName: `peto-cognito-deps-${stage}`,
        removalPolicy: RemovalPolicy.DESTROY,
      }
    );
  }
}
