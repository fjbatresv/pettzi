jest.mock('@aws-sdk/client-cognito-identity-provider', () => {
  const mockSend = jest.fn();
  return {
    CognitoIdentityProviderClient: jest.fn(() => ({ send: mockSend })),
    AdminUpdateUserAttributesCommand: jest.fn((input) => input),
    __sendMock: mockSend,
  };
});

const { CognitoIdentityProviderClient, AdminUpdateUserAttributesCommand, __sendMock } =
  jest.requireMock('@aws-sdk/client-cognito-identity-provider') as {
    CognitoIdentityProviderClient: jest.Mock;
    AdminUpdateUserAttributesCommand: jest.Mock;
    __sendMock: jest.Mock;
  };

import { handler } from './confirm-email.handler';
import crypto from 'crypto';

const buildToken = (secret: string, email = 'user@example.com', offsetMs = 1000) => {
  const expires = Date.now() + offsetMs;
  const payload = `${email}:${expires}`;
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return Buffer.from(`${payload}:${signature}`).toString('base64url');
};

describe('confirm-email.handler', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...OLD_ENV };
    process.env.EMAIL_VERIFY_SECRET = 'super-secret';
    process.env.COGNITO_USER_POOL_ID = 'pool';
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  it('returns 200 when token is valid', async () => {
    const token = buildToken(process.env.EMAIL_VERIFY_SECRET!);

    const res = await handler({ body: JSON.stringify({ token }) } as any);

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body!)).toEqual({ message: 'Email verified' });
    expect(__sendMock).toHaveBeenCalledTimes(1);
    expect(AdminUpdateUserAttributesCommand).toHaveBeenCalledWith({
      UserPoolId: 'pool',
      Username: 'user@example.com',
      UserAttributes: [{ Name: 'email_verified', Value: 'true' }],
    });
  });

  it('returns 400 when token missing', async () => {
    const res = await handler({ body: undefined } as any);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body!)).toEqual({ error: { code: 'BAD_REQUEST', message: 'token is required' } });
  });

  it('returns 400 for invalid token', async () => {
    const res = await handler({ body: JSON.stringify({ token: 'bad' }) } as any);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body!)).toEqual({
      error: { code: 'BAD_REQUEST', message: 'invalid or expired token' },
    });
  });

  it('returns 500 if secret missing', async () => {
    delete process.env.EMAIL_VERIFY_SECRET;
    const res = await handler({ body: JSON.stringify({ token: buildToken('foo') }) } as any);
    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body!)).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Email verification not configured' },
    });
  });
});
