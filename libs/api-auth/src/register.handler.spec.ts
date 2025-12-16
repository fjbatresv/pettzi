jest.mock('@aws-sdk/client-cognito-identity-provider', () => {
  const mockSend = jest.fn();
  return {
    CognitoIdentityProviderClient: jest.fn(() => ({ send: mockSend })),
    AdminCreateUserCommand: jest.fn((input) => input),
    AdminSetUserPasswordCommand: jest.fn((input) => input),
    InitiateAuthCommand: jest.fn((input) => input),
    __sendMock: mockSend,
  };
});

const { __sendMock: sendMock } = jest.requireMock(
  '@aws-sdk/client-cognito-identity-provider'
) as { __sendMock: jest.Mock };

jest.mock('@aws-sdk/client-ses', () => {
  const mockSend = jest.fn();
  return {
    SESClient: jest.fn(() => ({ send: mockSend })),
    SendTemplatedEmailCommand: jest.fn((input) => input),
    __sendMock: mockSend,
  };
});

const { __sendMock: sesSendMock } = jest.requireMock(
  '@aws-sdk/client-ses'
) as { __sendMock: jest.Mock };

import { handler } from './register.handler';

const makeTestPassword = () => `Test-${Math.random().toString(36).slice(2, 10)}Aa!`;

describe('register.handler', () => {
  beforeEach(() => {
    sendMock.mockReset();
    sesSendMock.mockReset();
    process.env.COGNITO_USER_POOL_CLIENT_ID = 'client-id';
    process.env.COGNITO_USER_POOL_ID = 'pool-id';
    delete process.env.SES_FROM_EMAIL;
    delete process.env.SES_WELCOME_TEMPLATE_NAME;
    delete process.env.EMAIL_VERIFY_SECRET;
    delete process.env.EMAIL_VERIFY_BASE_URL;
  });

  it('returns 201 on success', async () => {
    sendMock
      .mockResolvedValueOnce({}) // AdminCreateUser
      .mockResolvedValueOnce({}) // AdminSetUserPassword
      .mockResolvedValueOnce({
        AuthenticationResult: {
          IdToken: 'id',
          AccessToken: 'access',
          RefreshToken: 'refresh',
          TokenType: 'Bearer',
          ExpiresIn: 3600,
        },
      }); // InitiateAuth

    process.env.SES_FROM_EMAIL = 'no-reply@pettzi.app';
    process.env.SES_WELCOME_TEMPLATE_NAME = 'template';
    process.env.EMAIL_VERIFY_SECRET = 'secret';
    process.env.EMAIL_VERIFY_BASE_URL = 'https://app/confirm-email';

    const res = await handler({
      body: JSON.stringify({ email: 'a@b.com', password: makeTestPassword() }),
    } as any);

    expect(res.statusCode).toBe(201);
    expect(res.body && JSON.parse(res.body)).toEqual({
      message: 'User registered. Please confirm your email.',
      idToken: 'id',
      accessToken: 'access',
      refreshToken: 'refresh',
      tokenType: 'Bearer',
      expiresIn: 3600,
    });
    expect(sesSendMock).toHaveBeenCalledTimes(1);
    const sendArgs = sesSendMock.mock.calls[0][0];
    expect(sendArgs.Template).toBe('template');
    expect(sendArgs.Destination).toEqual({ ToAddresses: ['a@b.com'] });
    expect(sendArgs.TemplateData).toContain('verificationLink');
    expect(sendArgs.TemplateData).toContain('https://app/confirm-email');
  });

  it('returns 400 when body missing', async () => {
    const res = await handler({} as any);
    expect(res.statusCode).toBe(400);
  });

  it('returns 409 when user exists', async () => {
    sendMock.mockRejectedValue({ name: 'UsernameExistsException' });

    const res = await handler({
      body: JSON.stringify({ email: 'a@b.com', password: makeTestPassword() }),
    } as any);

    expect(res.statusCode).toBe(409);
  });

  it('returns 400 on invalid json', async () => {
    const res = await handler({ body: '{bad json' } as any);
    expect(res.statusCode).toBe(400);
  });
});
