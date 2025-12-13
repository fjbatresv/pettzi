import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { EventType, toItemPetEvent } from '@pettzi/domain-model';
import { handler } from './get-event.handler';

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

describe('get-event.handler', () => {
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
        path: '/pets/pet-1/events/event-1',
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

  it('returns a single event', async () => {
    const now = new Date('2024-01-01T00:00:00.000Z');
    const eventItem = toItemPetEvent({
      petId: 'pet-1',
      eventId: 'event-1',
      eventType: EventType.VACCINE,
      eventDate: now,
      createdAt: now,
      updatedAt: now,
    });

    const responses = [
      { Item: { PK: 'PET#pet-1', SK: 'OWNER#owner-1' } }, // ownership
      { Item: eventItem }, // fetch event
    ];

    sendMock.mockImplementation((command) => {
      if (command instanceof GetCommand) {
        const next = responses.shift();
        if (!next) throw new Error('Unexpected command');
        return next;
      }
      return {};
    });

    const res = await handler({
      ...baseEvent,
      pathParameters: { petId: 'pet-1', eventId: 'event-1' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body ?? '{}');
    expect(body.eventId).toBe('event-1');
  });

  it('returns bad request when params missing', async () => {
    const res = await handler({
      ...baseEvent,
      pathParameters: {},
    });
    expect(res.statusCode).toBe(400);
  });
});
