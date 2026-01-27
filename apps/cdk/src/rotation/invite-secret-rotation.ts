import {
  DescribeSecretCommand,
  GetRandomPasswordCommand,
  GetSecretValueCommand,
  PutSecretValueCommand,
  SecretsManagerClient,
  UpdateSecretVersionStageCommand,
} from '@aws-sdk/client-secrets-manager';

type RotationStep = 'createSecret' | 'setSecret' | 'testSecret' | 'finishSecret';

interface RotationEvent {
  SecretId?: string;
  ClientRequestToken?: string;
  Step?: RotationStep;
}

const client = new SecretsManagerClient({});

const ensurePendingSecret = async (
  secretId: string,
  clientRequestToken: string
) => {
  try {
    await client.send(
      new GetSecretValueCommand({
        SecretId: secretId,
        VersionId: clientRequestToken,
        VersionStage: 'AWSPENDING',
      })
    );
    return;
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err?.name !== 'ResourceNotFoundException') {
      throw error;
    }
  }

  const password = await client.send(
    new GetRandomPasswordCommand({
      PasswordLength: 64,
      ExcludePunctuation: true,
    })
  );
  const secretValue = JSON.stringify({
    secret: password.RandomPassword ?? '',
  });

  await client.send(
    new PutSecretValueCommand({
      SecretId: secretId,
      ClientRequestToken: clientRequestToken,
      SecretString: secretValue,
      VersionStages: ['AWSPENDING'],
    })
  );
};

const getCurrentVersion = (versions?: Record<string, string[]>) => {
  if (!versions) return undefined;
  return Object.entries(versions).find(([, stages]) =>
    stages.includes('AWSCURRENT')
  )?.[0];
};

export const handler = async (event: RotationEvent) => {
  const secretId = event.SecretId;
  const clientRequestToken = event.ClientRequestToken;
  const step = event.Step;

  if (!secretId || !clientRequestToken || !step) {
    throw new Error('Missing rotation parameters');
  }

  const metadata = await client.send(
    new DescribeSecretCommand({ SecretId: secretId })
  );
  if (!metadata.RotationEnabled) {
    throw new Error(`Secret ${secretId} is not enabled for rotation`);
  }

  const versions = metadata.VersionIdsToStages ?? {};
  const versionStages = versions[clientRequestToken];
  if (!versionStages) {
    throw new Error('Secret version not staged for rotation');
  }
  if (versionStages.includes('AWSCURRENT')) {
    return;
  }

  switch (step) {
    case 'createSecret':
      await ensurePendingSecret(secretId, clientRequestToken);
      return;
    case 'setSecret':
      return;
    case 'testSecret':
      return;
    case 'finishSecret': {
      const currentVersion = getCurrentVersion(versions);
      if (currentVersion === clientRequestToken) {
        return;
      }
      await client.send(
        new UpdateSecretVersionStageCommand({
          SecretId: secretId,
          VersionStage: 'AWSCURRENT',
          MoveToVersionId: clientRequestToken,
          ...(currentVersion ? { RemoveFromVersionId: currentVersion } : {}),
        })
      );
      return;
    }
    default:
      throw new Error(`Unknown rotation step: ${step}`);
  }
};
