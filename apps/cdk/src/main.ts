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
import { ApiDomainStack } from './api-domain-stack';
import { SesTemplatesStack } from './ses-templates-stack';

dotenvConfig({
    path: '../../.env',
});

const stage = process.env.STAGE ?? process.env.CDK_STAGE ?? 'dev';
const profile = process.env.CDK_PROFILE ?? process.env.AWS_PROFILE ?? 'default';
const account = process.env.CDK_DEFAULT_ACCOUNT;
const region = process.env.CDK_DEFAULT_REGION ?? process.env.AWS_REGION ?? 'us-east-1';
const apiDomainName = process.env.API_DOMAIN_NAME;
const apiHostedZoneName = process.env.API_HOSTED_ZONE_NAME;
const apiHostedZoneId = process.env.API_HOSTED_ZONE_ID;
const sesFromEmail = process.env.SES_FROM_EMAIL ?? 'no-reply@peto.app';

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

new SesTemplatesStack(app, 'PetoSesTemplatesStack', {
  env: { account, region },
  stackName: 'PetoSesTemplatesStack',
  description: `Peto SES templates (${stage})`,
  fromEmail: sesFromEmail,
});

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

const authApi = new AuthApiStack(app, 'PetoAuthApiStack', {
  env: { account, region },
  stackName: 'PetoAuthApiStack',
  description: `Peto auth API (${stage})`,
  userPool: auth.userPool,
  userPoolClient: auth.userPoolClient,
  depsLayer: layers.cognitoDepsLayer,
  sesLayer: layers.sesDepsLayer,
  sesFromEmail,
  welcomeTemplateName: SesTemplatesStack.WELCOME_TEMPLATE,
  resetTemplateName: SesTemplatesStack.RESET_TEMPLATE,
});

const petsApi = new PetsApiStack(app, 'PetoPetsApiStack', {
  env: { account, region },
  stackName: 'PetoPetsApiStack',
  description: `Peto pets API (${stage})`,
  table: core.table,
  depsLayer: layers.cognitoDepsLayer,
  userPool: auth.userPool,
  userPoolClient: auth.userPoolClient,
});

const eventsApi = new EventsApiStack(app, 'PetoEventsApiStack', {
  env: { account, region },
  stackName: 'PetoEventsApiStack',
  description: `Peto events API (${stage})`,
  table: core.table,
  sharedLayer: layers.cognitoDepsLayer,
  userPool: auth.userPool,
  userPoolClient: auth.userPoolClient,
  stage,
});

const remindersApi = new RemindersApiStack(app, 'PetoRemindersApiStack', {
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
  reminderTemplateName: SesTemplatesStack.REMINDER_TEMPLATE,
});

const uploadsApi = new UploadsApiStack(app, 'PetoUploadsApiStack', {
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

const ownersApi = new OwnersApiStack(app, 'PetoOwnersApiStack', {
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

const catalogsApi = new CatalogsApiStack(app, 'PetoCatalogsApiStack', {
  env: { account, region },
  stackName: 'PetoCatalogsApiStack',
  description: `Peto catalogs API (${stage})`,
  userPool: auth.userPool,
  userPoolClient: auth.userPoolClient,
  sharedLayer: layers.cognitoDepsLayer,
  stage,
});

if (apiDomainName && apiHostedZoneName) {
  new ApiDomainStack(app, 'PetoApiDomainStack', {
    env: { account, region },
    stackName: 'PetoApiDomainStack',
    description: `Peto API custom domain (${stage})`,
    domainName: apiDomainName,
    hostedZoneName: apiHostedZoneName,
    hostedZoneId: apiHostedZoneId,
    authApi: authApi.httpApi,
    petsApi: petsApi.httpApi,
    ownersApi: ownersApi.httpApi,
    eventsApi: eventsApi.httpApi,
    remindersApi: remindersApi.httpApi,
    uploadsApi: uploadsApi.httpApi,
    catalogsApi: catalogsApi.httpApi,
  });
}

app.synth();
