var sendMock: jest.Mock;

jest.mock('@aws-sdk/client-cognito-identity-provider', () => {
  const mockSend = jest.fn();
  sendMock = mockSend;
  return {
    CognitoIdentityProviderClient: jest.fn(() => ({ send: mockSend })),
    ConfirmForgotPasswordCommand: jest.fn((input) => input),
  };
});

import { handler } from './confirm-forgot-password.handler';

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
        newPassword: 'Password1',
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
