import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { handler } from './list-pet-owners.handler';

jest.mock('@aws-sdk/lib-dynamodb', () => {
  const send = jest.fn();
  class Cmd {
    constructor(public input: any) {}
  }
  return {
    DynamoDBDocumentClient: { from: () => ({ send }) },
    GetCommand: Cmd,
    QueryCommand: Cmd,
    __sendMock: send,
  };
});

const { __sendMock: sendMock } = jest.requireMock('@aws-sdk/lib-dynamodb') as {
  __sendMock: jest.Mock;
};

describe('list-pet-owners.handler', () => {
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
        method: 'GET',
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
    process.env.PETTZI_TABLE_NAME = 'PettziTable';
    sendMock.mockReset();
  });

  it('lists owners when caller is owner', async () => {
    // First GetCommand for caller ownership, then Query for owners list
    sendMock.mockImplementationOnce(() => ({ Item: { role: 'PRIMARY' } }));
    sendMock.mockImplementationOnce(() => ({
      Items: [{ ownerId: 'owner-1', petId: 'pet-1', role: 'PRIMARY' }],
    }));

    const res = await handler({
      ...baseEvent,
      pathParameters: { petId: 'pet-1' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body ?? '{}');
    expect(body.owners).toHaveLength(1);
  });
});
