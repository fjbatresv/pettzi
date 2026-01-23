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

jest.mock('@aws-sdk/client-ses', () => {
  const mockSend = jest.fn();
  return {
    SESClient: jest.fn(() => ({ send: mockSend })),
    SendTemplatedEmailCommand: jest.fn((input) => input),
    __sendMock: mockSend,
  };
});

jest.mock('@aws-sdk/lib-dynamodb', () => {
  const mockSend = jest.fn();
  return {
    DynamoDBDocumentClient: {
      from: jest.fn(() => ({ send: mockSend })),
    },
    PutCommand: jest.fn((input) => input),
    __sendMock: mockSend,
  };
});

type RegisterHandlerModule = typeof import('./register.handler');
const handlerModuleFactory = () =>
  require('./register.handler') as RegisterHandlerModule;
const makeTestPassword = () =>
  `Test-${Math.random().toString(36).slice(2, 10)}Aa!`;

describe('register.handler', () => {
  const OLD_ENV = process.env;
  let sendMock: jest.Mock;
  let sesSendMock: jest.Mock;
  let ddbSendMock: jest.Mock;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
    process.env.COGNITO_USER_POOL_CLIENT_ID = 'client-id';
    process.env.COGNITO_USER_POOL_ID = 'pool-id';
    process.env.PETTZI_TABLE_NAME = 'PettziTable';
    delete process.env.SES_FROM_EMAIL;
    delete process.env.SES_WELCOME_TEMPLATE_NAME;
    delete process.env.SES_WELCOME_TEMPLATE_NAME_ES;
    delete process.env.SES_WELCOME_TEMPLATE_NAME_EN;
    delete process.env.EMAIL_VERIFY_SECRET;
    delete process.env.EMAIL_VERIFY_BASE_URL;
    sendMock = jest.requireMock(
      '@aws-sdk/client-cognito-identity-provider'
    ).__sendMock;
    sesSendMock = jest.requireMock('@aws-sdk/client-ses').__sendMock;
    ddbSendMock = jest.requireMock('@aws-sdk/lib-dynamodb').__sendMock;
    sendMock.mockReset();
    sesSendMock.mockReset();
    ddbSendMock.mockReset();
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  const invokeHandler = async (payload: {
    name?: string;
    email?: string;
    password?: string;
    locale?: 'es' | 'en';
  }) => {
    const handler = handlerModuleFactory().handler;
    return handler({
      body: JSON.stringify(payload),
    } as any);
  };

  it('throws when user pool config is missing', () => {
    process.env = { ...OLD_ENV };
    delete process.env.COGNITO_USER_POOL_ID;
    expect(() => handlerModuleFactory().handler).toThrow(
      'COGNITO_USER_POOL_ID is required'
    );
  });

  it('returns 201 on success', async () => {
    sendMock
      .mockResolvedValueOnce({
        User: { Attributes: [{ Name: 'sub', Value: 'owner-1' }] },
      })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        AuthenticationResult: {
          IdToken: 'id',
          AccessToken: 'access',
          RefreshToken: 'refresh',
          TokenType: 'Bearer',
          ExpiresIn: 3600,
        },
      });

    process.env.SES_FROM_EMAIL = 'no-reply@pettzi.app';
    process.env.SES_WELCOME_TEMPLATE_NAME_ES = 'template-es';
    process.env.SES_WELCOME_TEMPLATE_NAME_EN = 'template-en';
    process.env.EMAIL_VERIFY_SECRET = 'secret';
    process.env.EMAIL_VERIFY_BASE_URL = 'https://app/confirm-email';

    const res = await invokeHandler({
      name: 'Test User',
      email: 'a@b.com',
      password: makeTestPassword(),
      locale: 'es',
    });

    expect(res.statusCode).toBe(201);
    expect(res.body && JSON.parse(res.body)).toEqual({
      message: 'User registered. Please confirm your email.',
      idToken: 'id',
      accessToken: 'access',
      tokenType: 'Bearer',
      expiresIn: 3600,
    });
    expect(sesSendMock).toHaveBeenCalledTimes(1);
    const sendArgs = sesSendMock.mock.calls[0][0];
    expect(sendArgs.Template).toBe('template-es');
    expect(sendArgs.Destination).toEqual({ ToAddresses: ['a@b.com'] });
    expect(sendArgs.TemplateData).toContain('verificationLink');
    expect(sendArgs.TemplateData).toContain('https://app/confirm-email');
  });

  it('returns 400 when body missing', async () => {
    const handler = handlerModuleFactory().handler;
    const res = await handler({} as any);
    expect(res.statusCode).toBe(400);
  });

  it('returns 409 when user exists', async () => {
    sendMock
      .mockRejectedValueOnce({ name: 'UsernameExistsException' })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});

    const res = await invokeHandler({
      name: 'Test User',
      email: 'a@b.com',
      password: makeTestPassword(),
      locale: 'es',
    });

    expect(res.statusCode).toBe(409);
  });

  it('returns 400 on invalid json', async () => {
    const handler = handlerModuleFactory().handler;
    const res = await handler({ body: '{bad json' } as any);
    expect(res.statusCode).toBe(400);
  });

  it('handles initiate auth missing tokens', async () => {
    sendMock
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});

    const res = await invokeHandler({
      name: 'Test User',
      email: 'a@b.com',
      password: makeTestPassword(),
      locale: 'es',
    });

    expect(res.statusCode).toBe(500);
  });

  it('returns bad request when password invalid', async () => {
    sendMock
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce({
        name: 'InvalidPasswordException',
        message: 'bad password',
      })
      .mockResolvedValueOnce({});

    const res = await invokeHandler({
      name: 'Test User',
      email: 'a@b.com',
      password: makeTestPassword(),
      locale: 'es',
    });

    expect(res.statusCode).toBe(400);
  });

  it('skips SES when verification config missing', async () => {
    sendMock
      .mockResolvedValueOnce({
        User: { Attributes: [{ Name: 'sub', Value: 'owner-1' }] },
      })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        AuthenticationResult: {
          IdToken: 'id',
          AccessToken: 'access',
          RefreshToken: 'refresh',
          TokenType: 'Bearer',
          ExpiresIn: 3600,
        },
      });

    const res = await invokeHandler({
      name: 'Test User',
      email: 'a@b.com',
      password: makeTestPassword(),
      locale: 'es',
    });

    expect(res.statusCode).toBe(201);
    expect(sesSendMock).not.toHaveBeenCalled();
  });

  it('survives SES failures', async () => {
    sendMock
      .mockResolvedValueOnce({
        User: { Attributes: [{ Name: 'sub', Value: 'owner-1' }] },
      })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        AuthenticationResult: {
          IdToken: 'id',
          AccessToken: 'access',
          RefreshToken: 'refresh',
          TokenType: 'Bearer',
          ExpiresIn: 3600,
        },
      });

    process.env.SES_FROM_EMAIL = 'no-reply@pettzi.app';
    process.env.SES_WELCOME_TEMPLATE_NAME_ES = 'template-es';
    process.env.SES_WELCOME_TEMPLATE_NAME_EN = 'template-en';
    process.env.EMAIL_VERIFY_SECRET = 'secret';
    process.env.EMAIL_VERIFY_BASE_URL = 'https://app/confirm-email';

    sesSendMock.mockRejectedValueOnce(new Error('boom'));

    const res = await invokeHandler({
      name: 'Test User',
      email: 'a@b.com',
      password: makeTestPassword(),
      locale: 'es',
    });

    expect(res.statusCode).toBe(201);
    expect(sesSendMock).toHaveBeenCalled();
  });
});
