import 'source-map-support/register';
import { config as dotenvConfig } from 'dotenv';
import { App } from 'aws-cdk-lib';
import { CoreInfraStack } from './core-infra-stack';
import { AuthStack } from './auth-stack';
import { AuthApiStack } from './auth-api-stack';

dotenvConfig({
    path: '../../.env',
});

const stage = process.env.STAGE ?? process.env.CDK_STAGE ?? 'dev';
const profile = process.env.CDK_PROFILE ?? process.env.AWS_PROFILE ?? 'default';
const account = process.env.CDK_DEFAULT_ACCOUNT;
const region = process.env.CDK_DEFAULT_REGION ?? process.env.AWS_REGION ?? 'us-east-1';

// Ensure SDK picks the intended profile when not provided via CLI.
process.env.AWS_PROFILE = profile;

if (!account) {
  throw new Error(
    `CDK_DEFAULT_ACCOUNT is not set. Configure AWS credentials (e.g., AWS_PROFILE=${profile} or --profile ${profile}).`
  );
}

console.log('CDK using AWS account:', account || '(not set)');
console.log('CDK using AWS profile:', profile || '(not set)');
console.log('CDK using AWS region:', region || '(default)');

const app = new App();

const core = new CoreInfraStack(app, 'PetoCoreInfraStack', {
  env: { account, region },
  stage,
  stackName: `PetoCoreInfraStack`,
  description: `Peto core infrastructure (${stage})`,
});

const auth = new AuthStack(app, 'PetoAuthStack', {
  env: { account, region },
  stackName: 'PetoAuthStack',
  description: `Peto auth (${stage})`,
});

new AuthApiStack(app, 'PetoAuthApiStack', {
  env: { account, region },
  stackName: 'PetoAuthApiStack',
  description: `Peto auth API (${stage})`,
  userPool: auth.userPool,
  userPoolClient: auth.userPoolClient,
  table: core.table,
});

app.synth();
