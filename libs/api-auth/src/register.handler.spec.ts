var sendMock: jest.Mock;

jest.mock('@aws-sdk/client-cognito-identity-provider', () => {
  const mockSend = jest.fn();
  sendMock = mockSend;
  return {
    CognitoIdentityProviderClient: jest.fn(() => ({ send: mockSend })),
    SignUpCommand: jest.fn((input) => input),
  };
});

import { handler } from './register.handler';

describe('register.handler', () => {
  beforeEach(() => {
    sendMock.mockReset();
  });

  it('returns 201 on success', async () => {
    sendMock.mockResolvedValue({});

    const res = await handler({
      body: JSON.stringify({ email: 'a@b.com', password: 'Password1' }),
    } as any);

    expect(res.statusCode).toBe(201);
    expect(res.body && JSON.parse(res.body)).toEqual({
      message: 'User registered. Please confirm your email.',
    });
  });

  it('returns 400 when body missing', async () => {
    const res = await handler({} as any);
    expect(res.statusCode).toBe(400);
  });

  it('returns 409 when user exists', async () => {
    sendMock.mockRejectedValue({ name: 'UsernameExistsException' });

    const res = await handler({
      body: JSON.stringify({ email: 'a@b.com', password: 'Password1' }),
    } as any);

    expect(res.statusCode).toBe(409);
  });

  it('returns 400 on invalid json', async () => {
    const res = await handler({ body: '{bad json' } as any);
    expect(res.statusCode).toBe(400);
  });
});
