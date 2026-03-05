let client: any | null = null;
let cachedSecret: string | null | undefined;
let pending: Promise<string | null> | null = null;

const parseSecretValue = (value?: string) => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    const candidate =
      (parsed['secret'] as string | undefined) ??
      (parsed['value'] as string | undefined) ??
      (parsed['EMAIL_VERIFY_SECRET'] as string | undefined);
    return candidate ?? value;
  } catch {
    return value;
  }
};

export const getEmailVerifySecret = async (): Promise<string | null> => {
  if (cachedSecret !== undefined) {
    return cachedSecret;
  }
  if (pending) {
    return pending;
  }

  const arn = process.env.EMAIL_VERIFY_SECRET_ARN;
  if (!arn) {
    if (process.env.EMAIL_VERIFY_SECRET && process.env.NODE_ENV === 'test') {
      cachedSecret = process.env.EMAIL_VERIFY_SECRET;
      return cachedSecret;
    }
    cachedSecret = null;
    return cachedSecret;
  }

  let SecretsManagerClient: any;
  let GetSecretValueCommand: any;
  try {
    ({ SecretsManagerClient, GetSecretValueCommand } = await import('@aws-sdk/client-secrets-manager'));
  } catch (err) {
    console.error('Secrets Manager SDK not available', { err });
    cachedSecret = null;
    return cachedSecret;
  }

  if (!client) {
    client = new SecretsManagerClient({});
  }

  pending = client
    .send(new GetSecretValueCommand({ SecretId: arn }))
    .then((resp: { SecretString?: string; SecretBinary?: Uint8Array }) => {
      const value =
        resp.SecretString ??
        (resp.SecretBinary
          ? Buffer.from(resp.SecretBinary as Uint8Array).toString('utf8')
          : undefined);
      cachedSecret = parseSecretValue(value);
      return cachedSecret;
    })
    .catch((err: unknown) => {
      console.error('Failed to load email verify secret', { err });
      cachedSecret = null;
      return cachedSecret;
    })
    .finally(() => {
      pending = null;
    });

  return pending;
};
