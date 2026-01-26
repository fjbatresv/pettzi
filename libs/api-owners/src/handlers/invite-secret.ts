import { serverError } from '@pettzi/utils-dynamo/http';
import { parseInviteToken } from './pet-invite.utils';

const parseSecretValue = (value?: string) => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    const candidate =
      (parsed['secret'] as string | undefined) ??
      (parsed['value'] as string | undefined) ??
      (parsed['PET_SHARE_INVITE_SECRET'] as string | undefined);
    return candidate ?? value;
  } catch {
    return value;
  }
};

let client: any | null = null;
let cachedCurrent: string | null | undefined;
let cachedPrevious: string | null | undefined;
let pending: Promise<{ current: string | null; previous: string | null }> | null = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

const getMessage = (error: any) => {
  const body = error?.body;
  if (typeof body !== 'string') return undefined;
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } };
    return parsed?.error?.message;
  } catch {
    return undefined;
  }
};

const fetchSecretVersion = async (
  secretId: string,
  versionStage: 'AWSCURRENT' | 'AWSPREVIOUS'
) => {
  if (!client) {
    return null;
  }
  let GetSecretValueCommand: any;
  try {
    ({ GetSecretValueCommand } = await import('@aws-sdk/client-secrets-manager'));
  } catch (err) {
    console.error('Secrets Manager SDK not available', { err });
    return null;
  }

  try {
    const response = await client.send(
      new GetSecretValueCommand({
        SecretId: secretId,
        VersionStage: versionStage,
      })
    );
    const value =
      response.SecretString ??
      (response.SecretBinary
        ? Buffer.from(response.SecretBinary as Uint8Array).toString('utf8')
        : undefined);
    return parseSecretValue(value);
  } catch (err: any) {
    if (versionStage === 'AWSCURRENT') {
      console.error('Failed to load invite secret', { err });
    }
    return null;
  }
};

export const getInviteSecrets = async () => {
  if (cachedCurrent !== undefined && cachedPrevious !== undefined) {
    if (Date.now() < cacheExpiresAt) {
      return { current: cachedCurrent, previous: cachedPrevious };
    }
    cachedCurrent = undefined;
    cachedPrevious = undefined;
  }
  if (pending) {
    return pending;
  }

  const arn = process.env.PET_SHARE_INVITE_SECRET_ARN?.trim();
  const inline = process.env.PET_SHARE_INVITE_SECRET?.trim();

  if (!arn) {
    cachedCurrent = inline || null;
    cachedPrevious = null;
    cacheExpiresAt = Date.now() + CACHE_TTL_MS;
    return { current: cachedCurrent, previous: cachedPrevious };
  }

  let SecretsManagerClient: any;
  try {
    ({ SecretsManagerClient } = await import('@aws-sdk/client-secrets-manager'));
  } catch (err) {
    console.error('Secrets Manager SDK not available', { err });
    cachedCurrent = inline || null;
    cachedPrevious = null;
    cacheExpiresAt = Date.now() + CACHE_TTL_MS;
    return { current: cachedCurrent, previous: cachedPrevious };
  }

  if (!client) {
    client = new SecretsManagerClient({});
  }

  pending = Promise.all([
    fetchSecretVersion(arn, 'AWSCURRENT'),
    fetchSecretVersion(arn, 'AWSPREVIOUS'),
  ])
    .then(([current, previous]) => {
      cachedCurrent = current ?? inline ?? null;
      cachedPrevious = previous;
      cacheExpiresAt = Date.now() + CACHE_TTL_MS;
      return { current: cachedCurrent, previous: cachedPrevious };
    })
    .catch((err) => {
      console.error('Failed to load invite secret', { err });
      cachedCurrent = inline ?? null;
      cachedPrevious = null;
      cacheExpiresAt = Date.now() + CACHE_TTL_MS;
      return { current: cachedCurrent, previous: cachedPrevious };
    })
    .finally(() => {
      pending = null;
    });

  return pending;
};

export const parseInviteTokenWithSecrets = (
  token: string,
  secrets: Array<string | null | undefined>
) => {
  const available = secrets.filter((secret): secret is string => Boolean(secret));
  if (!available.length) {
    throw serverError('Invite secret is not configured');
  }

  let lastError: any;
  for (const secret of available) {
    try {
      return parseInviteToken(token, secret);
    } catch (err: any) {
      lastError = err;
      const message = getMessage(err);
      if (message && message !== 'Invalid invite token') {
        throw err;
      }
    }
  }

  throw lastError;
};
