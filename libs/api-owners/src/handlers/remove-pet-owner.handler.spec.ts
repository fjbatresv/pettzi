import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { handler } from './remove-pet-owner.handler';

jest.mock('@aws-sdk/lib-dynamodb', () => {
  const send = jest.fn();
  class Cmd {
    constructor(public input: any) {}
  }
  return {
    DynamoDBDocumentClient: { from: () => ({ send }) },
    GetCommand: Cmd,
    DeleteCommand: Cmd,
    __sendMock: send,
  };
});

const { __sendMock: sendMock } = jest.requireMock('@aws-sdk/lib-dynamodb') as {
  __sendMock: jest.Mock;
};

describe('remove-pet-owner.handler', () => {
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
        method: 'DELETE',
        path: '/owners/pets/pet-1/owners/owner-2',
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

  it('removes a secondary owner', async () => {
    // caller primary, target secondary
    sendMock
      .mockResolvedValueOnce({ Item: { role: 'PRIMARY' } })
      .mockResolvedValueOnce({
        Item: { role: 'SECONDARY', ownerId: 'owner-2' },
      })
      .mockResolvedValueOnce({});

    const res = await (handler as any)({
      ...baseEvent,
      pathParameters: { petId: 'pet-1', ownerId: 'owner-2' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body ?? '{}');
    expect(body.message).toMatch(/removed/i);
  });

  it('returns forbidden when target is primary', async () => {
    sendMock
      .mockResolvedValueOnce({ Item: { role: 'PRIMARY' } })
      .mockResolvedValueOnce({ Item: { role: 'PRIMARY', ownerId: 'owner-2' } });

    const res = await (handler as any)({
      ...baseEvent,
      pathParameters: { petId: 'pet-1', ownerId: 'owner-2' },
    });

    expect(res.statusCode).toBe(403);
  });
});
