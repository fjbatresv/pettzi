import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { toItemPetReminder } from '@pettzi/domain-model';
import { handler } from './list-reminders.handler';

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

describe('list-reminders.handler', () => {
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
        path: '/reminders',
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

  it('returns reminders for owned pets', async () => {
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
      { Items: [{ petId: 'pet-1' }] }, // pet links via GSI1
      { Items: [reminderItem] }, // reminders for pet
    ];

    sendMock.mockImplementation((command) => {
      if (command instanceof QueryCommand) {
        const next = responses.shift();
        if (!next) throw new Error('Unexpected query');
        return next;
      }
      if (command instanceof GetCommand) {
        return { Item: { PK: 'PET#pet-1', SK: 'OWNER#owner-1' } };
      }
      throw new Error(`Unexpected command ${command.constructor.name}`);
    });

    const res = await (handler as any)(baseEvent);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body ?? '{}');
    expect(body.reminders).toHaveLength(1);
  });

  it('returns empty when no pets', async () => {
    sendMock.mockImplementation(() => ({ Items: [] }));

    const res = await (handler as any)(baseEvent);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body ?? '{}');
    expect(body.reminders).toHaveLength(0);
  });
});
