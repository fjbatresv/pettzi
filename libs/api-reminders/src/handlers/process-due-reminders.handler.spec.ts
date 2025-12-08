import { QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { toItemPetReminder } from '@peto/domain-model';
import { handler } from './process-due-reminders.handler';

jest.mock('@aws-sdk/lib-dynamodb', () => {
  const actual = jest.requireActual('@aws-sdk/lib-dynamodb');
  const send = jest.fn();
  return {
    ...actual,
    DynamoDBDocumentClient: { from: () => ({ send }) },
    __sendMock: send,
  };
});

jest.mock(
  '@aws-sdk/client-ses',
  () => {
    const send = jest.fn();
    return {
      SESClient: jest.fn(() => ({ send })),
      SendEmailCommand: jest.fn((input) => input),
      __sesSendMock: send,
    };
  },
  { virtual: true }
);

const { __sendMock: ddbSendMock } = jest.requireMock('@aws-sdk/lib-dynamodb') as {
  __sendMock: jest.Mock;
};
const { __sesSendMock: sesSendMock } = jest.requireMock('@aws-sdk/client-ses') as {
  __sesSendMock: jest.Mock;
};

describe('process-due-reminders.handler', () => {
  beforeEach(() => {
    process.env.PETO_TABLE_NAME = 'PetoTable';
    process.env.REMINDERS_EMAIL_FROM = 'no-reply@peto.dev';
    ddbSendMock.mockReset();
    sesSendMock.mockReset();
  });

  it('processes due reminders and sends email', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const dueDate = new Date(`${today}T00:00:00.000Z`);
    const reminderItem = toItemPetReminder({
      reminderId: 'rem-1',
      petId: 'pet-1',
      eventId: 'evt-1',
      dueDate,
      createdAt: dueDate,
      message: 'Checkup',
    });

    const responses = [
      { Items: [reminderItem] }, // query GSI1
      {}, // update lastNotifiedAt
    ];

    ddbSendMock.mockImplementation((command) => {
      if (command instanceof QueryCommand || command instanceof UpdateCommand) {
        const next = responses.shift();
        if (!next) throw new Error('Unexpected command');
        return next;
      }
      throw new Error(`Unexpected command ${command.constructor.name}`);
    });

    sesSendMock.mockResolvedValue({});

    await handler({}, {} as any, jest.fn());

    expect(sesSendMock).toHaveBeenCalledTimes(1);
    expect(ddbSendMock).toHaveBeenCalled();
  });
});
