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
import { RoutinesApiStack } from './routines-api-stack';
import { UploadsApiStack } from './uploads-api-stack';
import { OwnersApiStack } from './owners-api-stack';
import { CatalogsApiStack } from './catalogs-api-stack';
import { ApiDomainStack, AUTH_API_BASE_PATH } from './api-domain-stack';
import { SesTemplatesStack } from './ses-templates-stack';
import { EmailAssetsCdnStack } from './email-assets-cdn-stack';
import { MonitoringStack } from './monitoring-stack';
import { FrontendStack } from './frontend-stack';

dotenvConfig({
  path: '../../.env',
});

const parseBooleanEnv = (value?: string): boolean | undefined => {
  if (value == null) return undefined;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return undefined;
};

const stage = process.env.STAGE ?? process.env.CDK_STAGE ?? 'dev';
const stageName = stage.toLowerCase();
const profile = process.env.CDK_PROFILE ?? process.env.AWS_PROFILE ?? 'default';
const account = process.env.CDK_DEFAULT_ACCOUNT;
const region =
  process.env.CDK_DEFAULT_REGION ?? process.env.AWS_REGION ?? 'us-east-1';
const minimalCostMode =
  parseBooleanEnv(process.env.MINIMAL_COST_MODE) ?? stageName !== 'prod';
const enableInfraAlarms =
  parseBooleanEnv(process.env.ENABLE_INFRA_ALARMS) ?? !minimalCostMode;
const enableMonitoringAlarms =
  parseBooleanEnv(process.env.ENABLE_MONITORING_ALARMS) ?? true;
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
const appDomainName = (() => {
  const explicit = process.env.APP_DOMAIN_NAME?.trim();
  if (explicit) return explicit;

  const prefix = process.env.APP_PREFIX?.trim();
  const zone = apiHostedZoneName;
  if (!prefix || !zone) return undefined;

  return prefix === zone || prefix.endsWith(`.${zone}`)
    ? prefix
    : `${prefix}.${zone}`;
})();
const dsnPrefix = process.env.DSN_PREFIX?.trim();
const sesFromEmail = process.env.SES_FROM_EMAIL ?? 'no-reply@example.com';
const useKms =
  process.env.KMS_ENABLED != null
    ? ['true', '1', 'yes'].includes(process.env.KMS_ENABLED.trim().toLowerCase())
    : stageName === 'prod';
const emailVerificationBaseUrl =
  process.env.EMAIL_VERIFY_BASE_URL ??
  (apiDomainName
    ? `https://app.example.com/email-confirm`
    : undefined);
const passwordResetBaseUrl =
  process.env.PASSWORD_RESET_BASE_URL ??
  (apiDomainName
    ? `https://${apiDomainName}/${AUTH_API_BASE_PATH}/reset-password`
    : undefined);
const petShareInviteBaseUrl =
  process.env.PET_SHARE_INVITE_BASE_URL ?? 'https://app.example.com/accept-invite';

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

new LayersStack(app, 'PettziLayersStack', {
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
  appDomain: appDomainName,
  enableOperationalAlarms: enableInfraAlarms,
});

const auth = new AuthStack(app, 'PettziAuthStack', {
  env: { account, region },
  stackName: 'PettziAuthStack',
  description: `Pettzi auth (${stage})`,
  alarmTopic: undefined,
});

  const authApi = new AuthApiStack(app, 'PettziAuthApiStack', {
  env: { account, region },
  stackName: 'PettziAuthApiStack',
  description: `Pettzi auth API (${stage})`,
  userPool: auth.userPool,
  userPoolClient: auth.userPoolClient,
  table: core.table,
  docsBucket: core.docsBucket,
    depsLayerSsmParamName: LayersStack.cognitoLayerArnParam(stageName),
    sesLayerSsmParamName: LayersStack.sesLayerArnParam(stageName),
    ddbLayerSsmParamName: LayersStack.ddbLayerArnParam(stageName),
  sesFromEmail,
  welcomeTemplateNameEs: SesTemplatesStack.WELCOME_TEMPLATE_ES,
  welcomeTemplateNameEn: SesTemplatesStack.WELCOME_TEMPLATE_EN,
  resetTemplateNameEs: SesTemplatesStack.RESET_TEMPLATE_ES,
  resetTemplateNameEn: SesTemplatesStack.RESET_TEMPLATE_EN,
  verificationBaseUrl: emailVerificationBaseUrl,
  passwordResetBaseUrl,
  appDomain: appDomainName,
  alarmTopic: undefined,
});

  const petsApi = new PetsApiStack(app, 'PettziPetsApiStack', {
  env: { account, region },
  stackName: 'PettziPetsApiStack',
  description: `Pettzi pets API (${stage})`,
  table: core.table,
  docsBucket: core.docsBucket,
    depsLayerSsmParamName: LayersStack.cognitoLayerArnParam(stageName),
  userPool: auth.userPool,
  userPoolClient: auth.userPoolClient,
    s3LayerSsmParamName: LayersStack.s3LayerArnParam(stageName),
    ddbLayerSsmParamName: LayersStack.ddbLayerArnParam(stageName),
    appDomain: appDomainName,
  alarmTopic: undefined,
});

  const eventsApi = new EventsApiStack(app, 'PettziEventsApiStack', {
  env: { account, region },
  stackName: 'PettziEventsApiStack',
  description: `Pettzi events API (${stage})`,
  table: core.table,
  docsBucket: core.docsBucket,
    sharedLayerSsmParamName: LayersStack.cognitoLayerArnParam(stageName),
  userPool: auth.userPool,
  userPoolClient: auth.userPoolClient,
  stage,
  appDomain: appDomainName,
  alarmTopic: undefined,
});

  const remindersApi = new RemindersApiStack(app, 'PettziRemindersApiStack', {
  env: { account, region },
  stackName: 'PettziRemindersApiStack',
  description: `Pettzi reminders API (${stage})`,
  table: core.table,
    sharedLayerSsmParamName: LayersStack.cognitoLayerArnParam(stageName),
    sesLayerSsmParamName: LayersStack.sesLayerArnParam(stageName),
    ddbLayerSsmParamName: LayersStack.ddbLayerArnParam(stageName),
  userPool: auth.userPool,
  userPoolClient: auth.userPoolClient,
  stage,
  remindersEmailFrom: process.env.REMINDERS_EMAIL_FROM ?? 'no-reply@example.com',
  reminderTemplateName: SesTemplatesStack.REMINDER_TEMPLATE_ES,
  appDomain: appDomainName,
  alarmTopic: undefined,
});

  const routinesApi = new RoutinesApiStack(app, 'PettziRoutinesApiStack', {
  env: { account, region },
  stackName: 'PettziRoutinesApiStack',
  description: `Pettzi routines API (${stage})`,
  table: core.table,
    sharedLayerSsmParamName: LayersStack.cognitoLayerArnParam(stageName),
  userPool: auth.userPool,
  userPoolClient: auth.userPoolClient,
  stage,
  appDomain: appDomainName,
  alarmTopic: undefined,
});

  const uploadsApi = new UploadsApiStack(app, 'PettziUploadsApiStack', {
  env: { account, region },
  stackName: 'PettziUploadsApiStack',
  description: `Pettzi uploads API (${stage})`,
  table: core.table,
  docsBucket: core.docsBucket,
  userPool: auth.userPool,
  userPoolClient: auth.userPoolClient,
    sharedLayerSsmParamName: LayersStack.cognitoLayerArnParam(stageName),
    s3LayerSsmParamName: LayersStack.s3LayerArnParam(stageName),
    ddbLayerSsmParamName: LayersStack.ddbLayerArnParam(stageName),
  stage,
  appDomain: appDomainName,
  alarmTopic: undefined,
});

  const ownersApi = new OwnersApiStack(app, 'PettziOwnersApiStack', {
  env: { account, region },
  stackName: 'PettziOwnersApiStack',
  description: `Pettzi owners API (${stage})`,
  table: core.table,
  docsBucket: core.docsBucket,
  userPool: auth.userPool,
  userPoolClient: auth.userPoolClient,
    sharedLayerSsmParamName: LayersStack.cognitoLayerArnParam(stageName),
    s3LayerSsmParamName: LayersStack.s3LayerArnParam(stageName),
    sesLayerSsmParamName: LayersStack.sesLayerArnParam(stageName),
    ddbLayerSsmParamName: LayersStack.ddbLayerArnParam(stageName),
  sesFromEmail,
  sharePetInviteTemplateNameEs: SesTemplatesStack.SHARE_PET_INVITE_TEMPLATE_ES,
  sharePetInviteTemplateNameEn: SesTemplatesStack.SHARE_PET_INVITE_TEMPLATE_EN,
  inviteBaseUrl: petShareInviteBaseUrl,
  stage,
  appDomain: appDomainName,
  alarmTopic: undefined,
});

  const catalogsApi = new CatalogsApiStack(app, 'PettziCatalogsApiStack', {
  env: { account, region },
  stackName: 'PettziCatalogsApiStack',
  description: `Pettzi catalogs API (${stage})`,
  table: core.table,
  userPool: auth.userPool,
  userPoolClient: auth.userPoolClient,
    sharedLayerSsmParamName: LayersStack.cognitoLayerArnParam(stageName),
    ddbLayerSsmParamName: LayersStack.ddbLayerArnParam(stageName),
  stage,
  appDomain: appDomainName,
  alarmTopic: undefined,
});

new MonitoringStack(app, 'PettziMonitoringStack', {
  env: { account, region },
  stackName: 'PettziMonitoringStack',
  description: `Pettzi monitoring (${stage})`,
  stage,
  alarmTopic: enableMonitoringAlarms ? core.alarmTopic : undefined,
  table: core.table,
  docsBucket: core.docsBucket,
  userPool: auth.userPool,
  userPoolClient: auth.userPoolClient,
  apis: {
    auth: authApi.httpApi,
    pets: petsApi.httpApi,
    owners: ownersApi.httpApi,
    events: eventsApi.httpApi,
    reminders: remindersApi.httpApi,
    routines: routinesApi.httpApi,
    uploads: uploadsApi.httpApi,
    catalogs: catalogsApi.httpApi,
  },
});

if (appDomainName && apiHostedZoneName) {
  const inHostedZone =
    appDomainName === apiHostedZoneName ||
    appDomainName.endsWith(`.${apiHostedZoneName}`);

  if (!inHostedZone) {
    console.warn(
      `FrontendStack will be deployed in disabled mode: hosted zone "${apiHostedZoneName}" is not authoritative for domain "${appDomainName}".`
    );
  }

  if (inHostedZone) {
    new FrontendStack(app, 'PettziFrontendStack', {
      env: { account, region },
      stackName: 'PettziFrontendStack',
      description: `Pettzi frontend (${stage})`,
      stage,
      domainName: appDomainName,
      hostedZoneName: apiHostedZoneName,
      hostedZoneId: apiHostedZoneId,
      useKms,
    });
  }
}

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
    stage,
    enabled: inHostedZone,
    authApi: authApi.httpApi,
    petsApi: petsApi.httpApi,
    ownersApi: ownersApi.httpApi,
    eventsApi: eventsApi.httpApi,
    remindersApi: remindersApi.httpApi,
    routinesApi: routinesApi.httpApi,
    uploadsApi: uploadsApi.httpApi,
    catalogsApi: catalogsApi.httpApi,
  });
}

app.synth();
