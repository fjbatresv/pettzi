import 'source-map-support/register';
import { config as dotenvConfig } from 'dotenv';
import { App } from 'aws-cdk-lib';
import { CoreInfraStack } from './core-infra-stack';
import { LayersStack } from './layers-stack';
import { AuthStack } from './auth-stack';
import { AuthApiStack } from './auth-api-stack';
import { PetsApiStack } from './pets-api-stack';
import { EventsApiStack } from './events-api-stack';
import { RemindersApiStack } from './reminders-api-stack';
import { UploadsApiStack } from './uploads-api-stack';
import { OwnersApiStack } from './owners-api-stack';
import { CatalogsApiStack } from './catalogs-api-stack';

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

const layers = new LayersStack(app, 'PetoLayersStack', {
  env: { account, region },
  stackName: 'PetoLayersStack',
  description: `Peto shared layers (${stage})`,
  stage,
});

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
  depsLayer: layers.cognitoDepsLayer,
});

new PetsApiStack(app, 'PetoPetsApiStack', {
  env: { account, region },
  stackName: 'PetoPetsApiStack',
  description: `Peto pets API (${stage})`,
  table: core.table,
  depsLayer: layers.cognitoDepsLayer,
  userPool: auth.userPool,
  userPoolClient: auth.userPoolClient,
});

new EventsApiStack(app, 'PetoEventsApiStack', {
  env: { account, region },
  stackName: 'PetoEventsApiStack',
  description: `Peto events API (${stage})`,
  table: core.table,
  sharedLayer: layers.cognitoDepsLayer,
  userPool: auth.userPool,
  userPoolClient: auth.userPoolClient,
  stage,
});

new RemindersApiStack(app, 'PetoRemindersApiStack', {
  env: { account, region },
  stackName: 'PetoRemindersApiStack',
  description: `Peto reminders API (${stage})`,
  table: core.table,
  sharedLayer: layers.cognitoDepsLayer,
  sesLayer: layers.sesDepsLayer,
  ddbLayer: layers.ddbDepsLayer,
  userPool: auth.userPool,
  userPoolClient: auth.userPoolClient,
  stage,
  remindersEmailFrom: process.env.REMINDERS_EMAIL_FROM ?? 'no-reply@peto.dev',
});

new UploadsApiStack(app, 'PetoUploadsApiStack', {
  env: { account, region },
  stackName: 'PetoUploadsApiStack',
  description: `Peto uploads API (${stage})`,
  table: core.table,
  docsBucket: core.docsBucket,
  userPool: auth.userPool,
  userPoolClient: auth.userPoolClient,
  sharedLayer: layers.cognitoDepsLayer,
  s3Layer: layers.s3DepsLayer,
  ddbLayer: layers.ddbDepsLayer,
  stage,
});

new OwnersApiStack(app, 'PetoOwnersApiStack', {
  env: { account, region },
  stackName: 'PetoOwnersApiStack',
  description: `Peto owners API (${stage})`,
  table: core.table,
  userPool: auth.userPool,
  userPoolClient: auth.userPoolClient,
  sharedLayer: layers.cognitoDepsLayer,
  ddbLayer: layers.ddbDepsLayer,
  stage,
});

new CatalogsApiStack(app, 'PetoCatalogsApiStack', {
  env: { account, region },
  stackName: 'PetoCatalogsApiStack',
  description: `Peto catalogs API (${stage})`,
  userPool: auth.userPool,
  userPoolClient: auth.userPoolClient,
  sharedLayer: layers.cognitoDepsLayer,
  stage,
});

app.synth();
