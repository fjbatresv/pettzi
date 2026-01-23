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
import { ApiDomainStack, AUTH_API_BASE_PATH } from './api-domain-stack';
import { SesTemplatesStack } from './ses-templates-stack';
import { EmailAssetsCdnStack } from './email-assets-cdn-stack';

dotenvConfig({
  path: '../../.env',
});

const stage = process.env.STAGE ?? process.env.CDK_STAGE ?? 'dev';
const profile = process.env.CDK_PROFILE ?? process.env.AWS_PROFILE ?? 'default';
const account = process.env.CDK_DEFAULT_ACCOUNT;
const region =
  process.env.CDK_DEFAULT_REGION ?? process.env.AWS_REGION ?? 'us-east-1';
const apiDomainName = (() => {
  const explicit = process.env.API_DOMAIN_NAME?.trim();
  if (explicit) return explicit;

  const prefix = process.env.API_PREFIX?.trim();
  const zone = process.env.API_HOSTED_ZONE_NAME?.trim();
  if (!prefix || !zone) return undefined;

  // If the prefix already contains the zone, reuse it; otherwise compose prefix + zone.
  return prefix === zone || prefix.endsWith(`.${zone}`)
    ? prefix
    : `${prefix}.${zone}`;
})();
const apiHostedZoneName = process.env.API_HOSTED_ZONE_NAME?.trim();
const apiHostedZoneId = process.env.API_HOSTED_ZONE_ID?.trim();
const dsnPrefix = process.env.DSN_PREFIX?.trim();
const sesFromEmail = process.env.SES_FROM_EMAIL ?? 'no-reply@pettzi.app';
const useKms =
  process.env.KMS_ENABLED != null
    ? ['true', '1', 'yes'].includes(process.env.KMS_ENABLED.trim().toLowerCase())
    : stage === 'prod';
const emailVerificationBaseUrl =
  process.env.EMAIL_VERIFY_BASE_URL ??
  (apiDomainName
    ? `https://app.pettzi.net/email-confirm`
    : undefined);
const emailVerificationSecret = process.env.EMAIL_VERIFY_SECRET;
if (
  (emailVerificationBaseUrl && !emailVerificationSecret) ||
  (!emailVerificationBaseUrl && emailVerificationSecret)
) {
  throw new Error(
    `EMAIL_VERIFY_BASE_URL and EMAIL_VERIFY_SECRET must both be set together (missing ${
      emailVerificationBaseUrl ? 'EMAIL_VERIFY_SECRET' : 'EMAIL_VERIFY_BASE_URL'
    }).`
  );
}
const passwordResetBaseUrl =
  process.env.PASSWORD_RESET_BASE_URL ??
  (apiDomainName
    ? `https://${apiDomainName}/${AUTH_API_BASE_PATH}/reset-password`
    : undefined);
const petShareInviteBaseUrl =
  process.env.PET_SHARE_INVITE_BASE_URL ?? 'https://app.pettzi.net/accept-invite';
const petShareInviteSecret =
  process.env.PET_SHARE_INVITE_SECRET ?? emailVerificationSecret;

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

new SesTemplatesStack(app, 'PettziSesTemplatesStack', {
  env: { account, region },
  stackName: 'PettziSesTemplatesStack',
  description: `Pettzi SES templates (${stage})`,
  fromEmail: sesFromEmail,
  hostedZoneName: apiHostedZoneName,
  hostedZoneId: apiHostedZoneId,
});

if (dsnPrefix && apiHostedZoneName) {
  const domainName =
    dsnPrefix === apiHostedZoneName ||
    dsnPrefix.endsWith(`.${apiHostedZoneName}`)
      ? dsnPrefix
      : `${dsnPrefix}.${apiHostedZoneName}`;
  const inHostedZone =
    domainName === apiHostedZoneName ||
    domainName.endsWith(`.${apiHostedZoneName}`);

  if (!inHostedZone) {
    console.warn(
      `EmailAssetsCdnStack will be deployed in disabled mode: hosted zone "${apiHostedZoneName}" is not authoritative for domain "${domainName}".`
    );
  }

  if (inHostedZone) {
    new EmailAssetsCdnStack(app, 'PettziEmailAssetsCdnStack', {
      env: { account, region },
      stackName: 'PettziEmailAssetsCdnStack',
      description: `Pettzi email assets CDN (${stage})`,
      stage,
      prefix: domainName,
      hostedZoneName: apiHostedZoneName,
      hostedZoneId: apiHostedZoneId,
      useKms,
    });
  }
}

const layers = new LayersStack(app, 'PettziLayersStack', {
  env: { account, region },
  stackName: 'PettziLayersStack',
  description: `Pettzi shared layers (${stage})`,
  stage,
});

const core = new CoreInfraStack(app, 'PettziCoreInfraStack', {
  env: { account, region },
  stage,
  stackName: `PettziCoreInfraStack`,
  description: `Pettzi core infrastructure (${stage})`,
  useKms,
});

const auth = new AuthStack(app, 'PettziAuthStack', {
  env: { account, region },
  stackName: 'PettziAuthStack',
  description: `Pettzi auth (${stage})`,
  alarmTopic: core.alarmTopic,
});

const authApi = new AuthApiStack(app, 'PettziAuthApiStack', {
  env: { account, region },
  stackName: 'PettziAuthApiStack',
  description: `Pettzi auth API (${stage})`,
  userPool: auth.userPool,
  userPoolClient: auth.userPoolClient,
  table: core.table,
  docsBucket: core.docsBucket,
  depsLayer: layers.cognitoDepsLayer,
  sesLayer: layers.sesDepsLayer,
  ddbLayer: layers.ddbDepsLayer,
  sesFromEmail,
  welcomeTemplateNameEs: SesTemplatesStack.WELCOME_TEMPLATE_ES,
  welcomeTemplateNameEn: SesTemplatesStack.WELCOME_TEMPLATE_EN,
  resetTemplateNameEs: SesTemplatesStack.RESET_TEMPLATE_ES,
  resetTemplateNameEn: SesTemplatesStack.RESET_TEMPLATE_EN,
  verificationBaseUrl: emailVerificationBaseUrl,
  verificationSecret: emailVerificationSecret,
  passwordResetBaseUrl,
  alarmTopic: core.alarmTopic,
});

const petsApi = new PetsApiStack(app, 'PettziPetsApiStack', {
  env: { account, region },
  stackName: 'PettziPetsApiStack',
  description: `Pettzi pets API (${stage})`,
  table: core.table,
  docsBucket: core.docsBucket,
  depsLayer: layers.cognitoDepsLayer,
  userPool: auth.userPool,
  userPoolClient: auth.userPoolClient,
  alarmTopic: core.alarmTopic,
});

const eventsApi = new EventsApiStack(app, 'PettziEventsApiStack', {
  env: { account, region },
  stackName: 'PettziEventsApiStack',
  description: `Pettzi events API (${stage})`,
  table: core.table,
  sharedLayer: layers.cognitoDepsLayer,
  userPool: auth.userPool,
  userPoolClient: auth.userPoolClient,
  stage,
  alarmTopic: core.alarmTopic,
});

const remindersApi = new RemindersApiStack(app, 'PettziRemindersApiStack', {
  env: { account, region },
  stackName: 'PettziRemindersApiStack',
  description: `Pettzi reminders API (${stage})`,
  table: core.table,
  sharedLayer: layers.cognitoDepsLayer,
  sesLayer: layers.sesDepsLayer,
  ddbLayer: layers.ddbDepsLayer,
  userPool: auth.userPool,
  userPoolClient: auth.userPoolClient,
  stage,
  remindersEmailFrom: process.env.REMINDERS_EMAIL_FROM ?? 'no-reply@pettzi.dev',
  reminderTemplateName: SesTemplatesStack.REMINDER_TEMPLATE_ES,
  alarmTopic: core.alarmTopic,
});

const uploadsApi = new UploadsApiStack(app, 'PettziUploadsApiStack', {
  env: { account, region },
  stackName: 'PettziUploadsApiStack',
  description: `Pettzi uploads API (${stage})`,
  table: core.table,
  docsBucket: core.docsBucket,
  userPool: auth.userPool,
  userPoolClient: auth.userPoolClient,
  sharedLayer: layers.cognitoDepsLayer,
  s3Layer: layers.s3DepsLayer,
  ddbLayer: layers.ddbDepsLayer,
  stage,
  alarmTopic: core.alarmTopic,
});

const ownersApi = new OwnersApiStack(app, 'PettziOwnersApiStack', {
  env: { account, region },
  stackName: 'PettziOwnersApiStack',
  description: `Pettzi owners API (${stage})`,
  table: core.table,
  docsBucket: core.docsBucket,
  userPool: auth.userPool,
  userPoolClient: auth.userPoolClient,
  sharedLayer: layers.cognitoDepsLayer,
  s3Layer: layers.s3DepsLayer,
  sesLayer: layers.sesDepsLayer,
  ddbLayer: layers.ddbDepsLayer,
  sesFromEmail,
  sharePetInviteTemplateNameEs: SesTemplatesStack.SHARE_PET_INVITE_TEMPLATE_ES,
  sharePetInviteTemplateNameEn: SesTemplatesStack.SHARE_PET_INVITE_TEMPLATE_EN,
  inviteBaseUrl: petShareInviteBaseUrl,
  inviteTokenSecret: petShareInviteSecret,
  stage,
  alarmTopic: core.alarmTopic,
});

const catalogsApi = new CatalogsApiStack(app, 'PettziCatalogsApiStack', {
  env: { account, region },
  stackName: 'PettziCatalogsApiStack',
  description: `Pettzi catalogs API (${stage})`,
  userPool: auth.userPool,
  userPoolClient: auth.userPoolClient,
  sharedLayer: layers.cognitoDepsLayer,
  stage,
  alarmTopic: core.alarmTopic,
});

if (apiDomainName && apiHostedZoneName) {
  const inHostedZone =
    apiDomainName === apiHostedZoneName ||
    apiDomainName.endsWith(`.${apiHostedZoneName}`);

  if (!inHostedZone) {
    console.warn(
      `ApiDomainStack will be deployed in disabled mode: hosted zone "${apiHostedZoneName}" is not authoritative for domain "${apiDomainName}".`
    );
  }

  new ApiDomainStack(app, 'PettziApiDomainStack', {
    env: { account, region },
    stackName: 'PettziApiDomainStack',
    description: `Pettzi API custom domain (${stage})`,
    domainName: apiDomainName,
    hostedZoneName: apiHostedZoneName,
    hostedZoneId: apiHostedZoneId,
    enabled: inHostedZone,
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
