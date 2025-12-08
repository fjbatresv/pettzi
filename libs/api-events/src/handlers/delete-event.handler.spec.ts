import { APIGatewayProxyEventV2 } from 'aws-lambda';
import {
  GetCommand,
  DeleteCommand,
  QueryCommand,
  BatchWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { EventType, toItemPetEvent, toItemPetReminder } from '@peto/domain-model';
import { handler } from './delete-event.handler';

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

describe('delete-event.handler', () => {
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
        method: 'DELETE',
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

  it('deletes an event and related reminders', async () => {
    const now = new Date('2024-01-01T00:00:00.000Z');
    const eventItem = toItemPetEvent({
      petId: 'pet-1',
      eventId: 'event-1',
      eventType: EventType.VACCINE,
      eventDate: now,
      createdAt: now,
      updatedAt: now,
    });
    const reminderItem = toItemPetReminder({
      petId: 'pet-1',
      reminderId: 'rem-1',
      eventId: 'event-1',
      dueDate: now,
      createdAt: now,
      message: 'Reminder',
    });

    const responses = [
      { Item: { PK: 'PET#pet-1', SK: 'OWNER#owner-1' } }, // ownership check
      { Item: eventItem }, // fetch event
      {}, // delete event
      { Items: [reminderItem] }, // query reminders
      {}, // batch delete
    ];

    sendMock.mockImplementation(() => {
      const next = responses.shift();
      if (!next) {
        throw new Error('Unexpected extra command');
      }
      return next;
    });

    const res = await handler({
      ...baseEvent,
      pathParameters: { petId: 'pet-1', eventId: 'event-1' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body ?? '{}');
    expect(body.message).toMatch(/deleted/i);
    expect(sendMock).toHaveBeenCalledTimes(5);
  });

  it('returns bad request when params missing', async () => {
    const res = await handler({
      ...baseEvent,
      pathParameters: {},
    });
    expect(res.statusCode).toBe(400);
  });
});
