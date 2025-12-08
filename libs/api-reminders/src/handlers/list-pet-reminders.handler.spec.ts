import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { toItemPetReminder } from '@peto/domain-model';
import { handler } from './list-pet-reminders.handler';

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

describe('list-pet-reminders.handler', () => {
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
        path: '/pets/pet-1/reminders',
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

  it('lists reminders for a pet', async () => {
    const now = new Date('2024-01-02T00:00:00.000Z');
    const reminderItem = toItemPetReminder({
      reminderId: 'rem-1',
      petId: 'pet-1',
      eventId: 'evt-1',
      dueDate: now,
      createdAt: now,
      message: 'Checkup',
    });

    const responses = [
      { Item: { PK: 'PET#pet-1', SK: 'OWNER#owner-1' } }, // ownership
      { Items: [reminderItem] }, // reminders query
    ];

    sendMock.mockImplementation((command) => {
      if (command instanceof GetCommand || command instanceof QueryCommand) {
        const next = responses.shift();
        if (!next) throw new Error('Unexpected command');
        return next;
      }
      throw new Error(`Unexpected command ${command.constructor.name}`);
    });

    const res = await handler({
      ...baseEvent,
      pathParameters: { petId: 'pet-1' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body ?? '{}');
    expect(body.reminders).toHaveLength(1);
  });

  it('returns bad request when missing petId', async () => {
    const res = await handler({
      ...baseEvent,
      pathParameters: {},
    });
    expect(res.statusCode).toBe(400);
  });
});
