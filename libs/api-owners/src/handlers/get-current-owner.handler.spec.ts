import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { handler } from './get-current-owner.handler';

jest.mock('@aws-sdk/lib-dynamodb', () => {
  const send = jest.fn();
  return {
    DynamoDBDocumentClient: { from: () => ({ send }) },
    GetCommand: jest.fn((input) => input),
    __sendMock: send,
  };
});

const { __sendMock: sendMock } = jest.requireMock('@aws-sdk/lib-dynamodb') as {
  __sendMock: jest.Mock;
};

describe('get-current-owner.handler', () => {
  const baseEvent = {
    version: '2.0',
    routeKey: '',
    rawPath: '',
    rawQueryString: '',
    headers: {},
    requestContext: {
      accountId: '',
      apiId: '',
      domainName: '',
      domainPrefix: '',
      http: {
        method: 'GET',
        path: '/owners/me',
        protocol: 'HTTP/1.1',
        sourceIp: '',
        userAgent: '',
      },
      requestId: '',
      routeKey: '',
      stage: '$default',
      time: '',
      timeEpoch: 0,
      authorizer: {
        jwt: { claims: { sub: 'owner-1' }, scopes: [] },
      },
    },
    isBase64Encoded: false,
  } as APIGatewayProxyEventV2;

  beforeEach(() => {
    process.env.PETTZI_TABLE_NAME = 'PettziTable';
    sendMock.mockReset();
  });

  it('returns owner profile', async () => {
    sendMock.mockResolvedValue({
      Item: {
        PK: 'OWNER#owner-1',
        SK: 'PROFILE',
        ownerId: 'owner-1',
        userId: 'user-1',
        fullName: 'John',
        createdAt: new Date().toISOString(),
      },
    });

    const res = await (handler as any)(baseEvent);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body ?? '{}');
    expect(body.ownerId).toBe('owner-1');
  });

  it('returns not found when missing', async () => {
    sendMock.mockResolvedValue({});
    const res = await (handler as any)(baseEvent);
    expect(res.statusCode).toBe(404);
  });
});
