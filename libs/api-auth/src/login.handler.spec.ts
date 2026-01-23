jest.mock('@aws-sdk/client-cognito-identity-provider', () => {
  const mockSend = jest.fn();
  return {
    CognitoIdentityProviderClient: jest.fn(() => ({ send: mockSend })),
    InitiateAuthCommand: jest.fn((input) => input),
    __sendMock: mockSend,
  };
});

const { __sendMock: sendMock } = jest.requireMock(
  '@aws-sdk/client-cognito-identity-provider'
) as { __sendMock: jest.Mock };
import { handler } from './login.handler';

const makeTestPassword = (label: string) =>
  `Test-${label}-${Math.random().toString(36).slice(2, 10)}Aa!`;

describe('login.handler', () => {
  beforeEach(() => {
    sendMock.mockReset();
  });

  it('returns tokens on success', async () => {
    sendMock.mockResolvedValue({
      AuthenticationResult: {
        IdToken: 'id',
        AccessToken: 'access',
        RefreshToken: 'refresh',
      },
    });

    const res = await (handler as any)({
      body: JSON.stringify({
        email: 'a@b.com',
        password: makeTestPassword('valid'),
      }),
    } as any);

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body!)).toEqual({
      idToken: 'id',
      accessToken: 'access',
    });
  });

  it('returns challenge payload when new password required', async () => {
    sendMock.mockResolvedValue({
      ChallengeName: 'NEW_PASSWORD_REQUIRED',
      Session: 'session',
    });

    const res = await (handler as any)({
      body: JSON.stringify({
        email: 'a@b.com',
        password: makeTestPassword('temp'),
      }),
    } as any);

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body!)).toEqual({
      challenge: 'NEW_PASSWORD_REQUIRED',
      session: 'session',
      message: 'New password required',
    });
  });

  it('returns 401 for not authorized', async () => {
    sendMock.mockRejectedValue({ name: 'NotAuthorizedException' });

    const res = await (handler as any)({
      body: JSON.stringify({
        email: 'a@b.com',
        password: makeTestPassword('invalid'),
      }),
    } as any);

    expect(res.statusCode).toBe(401);
  });

  it('returns 400 when missing fields', async () => {
    const res = await (handler as any)({
      body: JSON.stringify({ email: 'a@b.com' }),
    } as any);
    expect(res.statusCode).toBe(400);
  });
});
