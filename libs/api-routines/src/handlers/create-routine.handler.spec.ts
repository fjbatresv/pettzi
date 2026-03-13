import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { RoutineType } from '@pettzi/domain-model';
import { handler } from './create-routine.handler';

jest.mock('@aws-sdk/lib-dynamodb', () => {
  const actual = jest.requireActual('@aws-sdk/lib-dynamodb');
  const send = jest.fn();
  return {
    ...actual,
    DynamoDBDocumentClient: { from: () => ({ send }) },
    __sendMock: send,
  };
});

const { __sendMock: sendMock } = jest.requireMock('@aws-sdk/lib-dynamodb') as {
  __sendMock: jest.Mock;
};

describe('create-routine.handler', () => {
  const event = {
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
      http: { method: 'POST', path: '', protocol: 'HTTP/1.1', sourceIp: '', userAgent: '' },
      requestId: '',
      routeKey: '',
      stage: '$default',
      time: '',
      timeEpoch: 0,
      authorizer: { jwt: { claims: { sub: 'owner-1' }, scopes: [] } },
    },
    isBase64Encoded: false,
  } as APIGatewayProxyEventV2;

  beforeEach(() => {
    process.env.PETTZI_TABLE_NAME = 'PettziTable';
    sendMock.mockReset();
  });

  it('creates a routine', async () => {
    sendMock.mockImplementation((command) => {
      if (command instanceof GetCommand) {
        return { Item: { PK: 'PET#pet-1', SK: 'OWNER#owner-1' } };
      }
      if (command instanceof PutCommand) {
        return {};
      }
      if (command instanceof QueryCommand) {
        return { Items: [] };
      }
      throw new Error(`Unexpected command ${command.constructor.name}`);
    });

    const response = await (handler as any)({
      ...event,
      pathParameters: { petId: 'pet-1' },
      body: JSON.stringify({
        title: 'Morning walk',
        type: RoutineType.WALKING,
        timezone: 'America/Guatemala',
        schedule: { frequency: 'DAILY', times: ['07:00'] },
      }),
    });

    expect(response.statusCode).toBe(201);
    expect(JSON.parse(response.body ?? '{}').title).toBe('Morning walk');
  });
});
