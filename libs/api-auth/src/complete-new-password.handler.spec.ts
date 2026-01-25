jest.mock('@aws-sdk/client-cognito-identity-provider', () => {
  const mockSend = jest.fn();
  return {
    CognitoIdentityProviderClient: jest.fn(() => ({ send: mockSend })),
    RespondToAuthChallengeCommand: jest.fn((input) => input),
    __sendMock: mockSend,
  };
});

const { __sendMock: sendMock } = jest.requireMock(
  '@aws-sdk/client-cognito-identity-provider'
) as { __sendMock: jest.Mock };

import { handler } from './complete-new-password.handler';

describe('complete-new-password.handler', () => {
  beforeEach(() => {
    sendMock.mockReset();
    process.env.COGNITO_USER_POOL_CLIENT_ID = 'client';
  });

  it('completes challenge and returns tokens', async () => {
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
        session: 'session',
        newPassword: 'NewPass1',
      }),
    } as any);

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body!)).toEqual({
      idToken: 'id',
      accessToken: 'access',
      refreshToken: 'refresh',
    });
  });

  it('returns 400 if fields missing', async () => {
    const res = await (handler as any)({
      body: JSON.stringify({ email: 'a@b.com' }),
    } as any);
    expect(res.statusCode).toBe(400);
  });
});
