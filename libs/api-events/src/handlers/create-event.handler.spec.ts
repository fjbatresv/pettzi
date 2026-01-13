import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { EventType } from '@pettzi/domain-model';
import { handler } from './create-event.handler';

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

describe('create-event.handler', () => {
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
        method: 'POST',
        path: '/pets/pet-1/events',
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

  it('creates an event', async () => {
    sendMock.mockImplementation((command) => {
      if (command instanceof GetCommand) {
        return { Item: { PK: 'PET#pet-1', SK: 'OWNER#owner-1' } };
      }
      if (command instanceof PutCommand) {
        // return the items we wrote for assertion if needed
        return {};
      }
      throw new Error(`Unexpected command ${command.constructor.name}`);
    });

    const res = await (handler as any)({
      ...baseEvent,
      pathParameters: { petId: 'pet-1' },
      body: JSON.stringify({
        eventType: EventType.VACCINE,
        date: '2024-01-01',
        title: 'Rabies',
      }),
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body ?? '{}');
    expect(body.eventType).toBe(EventType.VACCINE);
    expect(sendMock).toHaveBeenCalled();
  });

  it('returns bad request when body is missing', async () => {
    const res = await (handler as any)({
      ...baseEvent,
      pathParameters: { petId: 'pet-1' },
      body: null,
    });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body ?? '{}').error.code).toBe('BAD_REQUEST');
  });

  it('returns bad request when eventType/date missing', async () => {
    sendMock.mockImplementation((command) => {
      if (command instanceof GetCommand) {
        return { Item: { PK: 'PET#pet-1', SK: 'OWNER#owner-1' } };
      }
      throw new Error('Unexpected');
    });

    const res = await (handler as any)({
      ...baseEvent,
      pathParameters: { petId: 'pet-1' },
      body: JSON.stringify({ title: 'Missing fields' }),
    });

    expect(res.statusCode).toBe(400);
  });
});
