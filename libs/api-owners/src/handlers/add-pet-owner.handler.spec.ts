import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { handler } from './add-pet-owner.handler';

jest.mock('@aws-sdk/lib-dynamodb', () => {
  const send = jest.fn();
  class Cmd {
    constructor(public input: any) {}
  }
  return {
    DynamoDBDocumentClient: { from: () => ({ send }) },
    GetCommand: Cmd,
    PutCommand: Cmd,
    __sendMock: send,
  };
});

const { __sendMock: sendMock } = jest.requireMock('@aws-sdk/lib-dynamodb') as {
  __sendMock: jest.Mock;
};

describe('add-pet-owner.handler', () => {
  const baseEvent: APIGatewayProxyEventV2 = {
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
        method: 'POST',
        path: '/owners/pets/pet-1/owners',
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
  };

  beforeEach(() => {
    process.env.PETO_TABLE_NAME = 'PetoTable';
    sendMock.mockReset();
  });

  it('adds a secondary owner', async () => {
    // sequence: assert primary (Get), ensure owner exists (Get), linkExists (Get), put
    sendMock
      .mockResolvedValueOnce({ Item: { role: 'PRIMARY' } })
      .mockResolvedValueOnce({ Item: { ownerId: 'owner-2' } })
      .mockResolvedValueOnce({}) // link does not exist
      .mockResolvedValueOnce({}); // put ok

    const res = await handler({
      ...baseEvent,
      pathParameters: { petId: 'pet-1' },
      body: JSON.stringify({ ownerId: 'owner-2', role: 'SECONDARY' }),
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body ?? '{}');
    expect(body.ownerId).toBe('owner-2');
  });

  it('returns conflict if already linked', async () => {
    sendMock
      .mockResolvedValueOnce({ Item: { role: 'PRIMARY' } })
      .mockResolvedValueOnce({ Item: { ownerId: 'owner-2' } })
      .mockResolvedValueOnce({ Item: { ownerId: 'owner-2' } });

    const res = await handler({
      ...baseEvent,
      pathParameters: { petId: 'pet-1' },
      body: JSON.stringify({ ownerId: 'owner-2' }),
    });

    expect(res.statusCode).toBe(409);
  });
});
