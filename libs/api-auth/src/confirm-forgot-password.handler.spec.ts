jest.mock('@aws-sdk/client-cognito-identity-provider', () => {
  const mockSend = jest.fn();
  return {
    CognitoIdentityProviderClient: jest.fn(() => ({ send: mockSend })),
    ConfirmForgotPasswordCommand: jest.fn((input) => input),
    __sendMock: mockSend,
  };
});

const { __sendMock: sendMock } = jest.requireMock(
  '@aws-sdk/client-cognito-identity-provider'
) as { __sendMock: jest.Mock };

import { handler } from './confirm-forgot-password.handler';

const makeTestPassword = () => `Test-${Math.random().toString(36).slice(2, 10)}Aa!`;

describe('confirm-forgot-password.handler', () => {
  beforeEach(() => {
    sendMock.mockReset();
  });

  it('returns 200 on success', async () => {
    sendMock.mockResolvedValue({});

    const res = await handler({
      body: JSON.stringify({
        email: 'a@b.com',
        code: '123456',
        newPassword: makeTestPassword(),
      }),
    } as any);

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body!)).toEqual({ message: 'Password has been reset.' });
  });

  it('returns 400 when missing fields', async () => {
    const res = await handler({ body: JSON.stringify({}) } as any);
    expect(res.statusCode).toBe(400);
  });
});
