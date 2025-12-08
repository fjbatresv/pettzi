import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { EventType, toItemPetEvent } from '@peto/domain-model';
import { handler } from './update-event.handler';

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

describe('update-event.handler', () => {
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
        method: 'PATCH',
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
    process.env.PETO_TABLE_NAME = 'PetoTable';
    sendMock.mockReset();
  });

  it('updates an event', async () => {
    const now = new Date('2024-01-01T00:00:00.000Z');
    const item = toItemPetEvent({
      petId: 'pet-1',
      eventId: 'event-1',
      eventType: EventType.VACCINE,
      eventDate: now,
      createdAt: now,
      updatedAt: now,
    });

    let call = 0;
    sendMock.mockImplementation((command) => {
      if (command instanceof GetCommand) {
        call += 1;
        return { Item: call === 1 ? { PK: 'PET#pet-1', SK: 'OWNER#owner-1' } : item };
      }
      if (command instanceof UpdateCommand) {
        return { Attributes: { ...item, title: 'Updated title' } };
      }
      throw new Error(`Unexpected command: ${command.constructor.name}`);
    });

    const res = await handler({
      ...baseEvent,
      pathParameters: { petId: 'pet-1', eventId: 'event-1' },
      body: JSON.stringify({ title: 'Updated title' }),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body ?? '{}');
    expect(body.title ?? body.event?.title).toBe('Updated title');
  });

  it('returns bad request on empty body', async () => {
    const res = await handler({
      ...baseEvent,
      pathParameters: { petId: 'pet-1', eventId: 'event-1' },
      body: '{}',
    });
    expect(res.statusCode).toBe(400);
  });
});
