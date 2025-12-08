jest.mock('@aws-sdk/client-cognito-identity-provider', () => {
  const mockSend = jest.fn();
  return {
    CognitoIdentityProviderClient: jest.fn(() => ({ send: mockSend })),
    ForgotPasswordCommand: jest.fn((input) => input),
    __sendMock: mockSend,
  };
});

const { __sendMock: sendMock } = jest.requireMock(
  '@aws-sdk/client-cognito-identity-provider'
) as { __sendMock: jest.Mock };

import { handler } from './forgot-password.handler';

describe('forgot-password.handler', () => {
  beforeEach(() => {
    sendMock.mockReset();
  });

  it('returns 200 on success', async () => {
    sendMock.mockResolvedValue({});

    const res = await handler({
      body: JSON.stringify({ email: 'a@b.com' }),
    } as any);

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body!)).toEqual({ message: 'Password reset code sent.' });
  });

  it('returns 400 when missing email', async () => {
    const res = await handler({ body: JSON.stringify({}) } as any);
    expect(res.statusCode).toBe(400);
  });
});
