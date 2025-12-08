var sendMock: jest.Mock;

jest.mock('@aws-sdk/client-cognito-identity-provider', () => {
  const mockSend = jest.fn();
  sendMock = mockSend;
  return {
    CognitoIdentityProviderClient: jest.fn(() => ({ send: mockSend })),
    InitiateAuthCommand: jest.fn((input) => input),
  };
});

import { handler } from './login.handler';

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

    const res = await handler({
      body: JSON.stringify({ email: 'a@b.com', password: 'Password1' }),
    } as any);

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body!)).toEqual({
      idToken: 'id',
      accessToken: 'access',
      refreshToken: 'refresh',
    });
  });

  it('returns 401 for not authorized', async () => {
    sendMock.mockRejectedValue({ name: 'NotAuthorizedException' });

    const res = await handler({
      body: JSON.stringify({ email: 'a@b.com', password: 'bad' }),
    } as any);

    expect(res.statusCode).toBe(401);
  });

  it('returns 400 when missing fields', async () => {
    const res = await handler({ body: JSON.stringify({ email: 'a@b.com' }) } as any);
    expect(res.statusCode).toBe(400);
  });
});
