jest.mock('@aws-sdk/client-cognito-identity-provider', () => {
  const mockSend = jest.fn();
  return {
    CognitoIdentityProviderClient: jest.fn(() => ({ send: mockSend })),
    AdminSetUserPasswordCommand: jest.fn((input) => input),
    __sendMock: mockSend,
  };
});

jest.mock('@aws-sdk/client-ses', () => {
  const mockSend = jest.fn();
  return {
    SESClient: jest.fn(() => ({ send: mockSend })),
    SendTemplatedEmailCommand: jest.fn((input) => input),
    __sendMock: mockSend,
  };
});

const {
  __sendMock: cognitoSendMock,
} = jest.requireMock(
  '@aws-sdk/client-cognito-identity-provider'
) as { __sendMock: jest.Mock };

const {
  __sendMock: sesSendMock,
} = jest.requireMock('@aws-sdk/client-ses') as { __sendMock: jest.Mock };

import { handler } from './forgot-password.handler';

describe('forgot-password.handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.COGNITO_USER_POOL_ID = 'pool-id';
    process.env.SES_FROM_EMAIL = 'no-reply@pettzi.app';
    process.env.SES_RESET_TEMPLATE_NAME = 'template';
  });

  it('returns 200 on success and sends SES template', async () => {
    cognitoSendMock.mockResolvedValueOnce({});
    sesSendMock.mockResolvedValueOnce({});

    const res = await handler({
      body: JSON.stringify({ email: 'a@b.com' }),
    } as any);

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body!)).toEqual({
      message: 'Temporary password sent. Use it to login and then change your password.',
    });
    expect(cognitoSendMock).toHaveBeenCalledTimes(1);
    expect(sesSendMock).toHaveBeenCalledTimes(1);
    const templateArgs = sesSendMock.mock.calls[0][0];
    expect(templateArgs.Template).toBe('template');
    expect(templateArgs.TemplateData).toContain('temporaryPassword');
  });

  it('returns 400 when email missing', async () => {
    const res = await handler({ body: JSON.stringify({}) } as any);

    expect(res.statusCode).toBe(400);
  });
});
