import { GetCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

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
      SendTemplatedEmailCommand: jest.fn((input) => input),
      SendEmailCommand: jest.fn((input) => input),
      __sesSendMock: send,
    };
  },
  { virtual: true }
);

jest.mock(
  '@aws-sdk/client-scheduler',
  () => {
    const send = jest.fn();
    return {
      SchedulerClient: jest.fn(() => ({ send })),
      UpdateScheduleCommand: jest.fn((input) => input),
      CreateScheduleCommand: jest.fn((input) => input),
      DeleteScheduleCommand: jest.fn((input) => input),
      __schedulerSendMock: send,
    };
  },
  { virtual: true }
);

const { __sendMock: ddbSendMock } = jest.requireMock(
  '@aws-sdk/lib-dynamodb'
) as {
  __sendMock: jest.Mock;
};
const { __sesSendMock: sesSendMock } = jest.requireMock(
  '@aws-sdk/client-ses'
) as {
  __sesSendMock: jest.Mock;
};
const { __schedulerSendMock: schedulerSendMock } = jest.requireMock(
  '@aws-sdk/client-scheduler'
) as {
  __schedulerSendMock: jest.Mock;
};

describe('consume-reminder.handler', () => {
  beforeEach(() => {
    process.env.PETTZI_TABLE_NAME = 'PettziTable';
    process.env.REMINDERS_EMAIL_FROM = 'no-reply@pettzi.dev';
    process.env.SES_REMINDER_TEMPLATE_NAME = 'RemindersTemplate';
    process.env.REMINDER_DISPATCHER_ARN = 'arn:aws:lambda:us-east-1:123:function:dispatcher';
    process.env.REMINDER_SCHEDULER_ROLE_ARN = 'arn:aws:iam::123:role/scheduler';
    ddbSendMock.mockReset();
    sesSendMock.mockReset();
    schedulerSendMock.mockReset();
  });

  it('sends templated email with eventType and updates ttl safely', async () => {
    const { handler } = await import('./consume-reminder.handler');
    const dueDate = new Date(Date.now() + 5 * 60 * 1000);
    const reminderItem = {
      petId: 'pet-1',
      reminderId: 'rem-1',
      ownerId: 'owner-1',
      dueDate: dueDate.toISOString(),
      metadata: {
        name: 'Vacuna anual',
        notes: 'Aplicar en la mañana',
        eventType: 'VACCINE',
        periodicity: {
          type: 'daily',
          time: '10:00',
        },
      },
      ruleName: 'rule-1',
    };

    const responses = [
      { Item: reminderItem }, // Get reminder
      { Items: [] }, // Query owners
      { Item: { email: 'owner@pettzi.dev', locale: 'es' } }, // Get owner profile
      { Item: { name: 'Firulais' } }, // Get pet metadata
      {}, // Update lastSentAt
      {}, // Update dueDate (reschedule)
    ];

    ddbSendMock.mockImplementation((command) => {
      if (
        command instanceof GetCommand ||
        command instanceof QueryCommand ||
        command instanceof UpdateCommand
      ) {
        const next = responses.shift();
        if (!next) {
          throw new Error('Unexpected command');
        }
        return next;
      }
      throw new Error(`Unexpected command ${command.constructor.name}`);
    });

    sesSendMock.mockResolvedValue({});
    schedulerSendMock.mockResolvedValue({});

    await handler({
      Records: [
        {
          body: JSON.stringify({ petId: 'pet-1', reminderId: 'rem-1' }),
        },
      ],
    } as any);

    expect(sesSendMock).toHaveBeenCalledTimes(1);
    const sesInput = sesSendMock.mock.calls[0]?.[0] as { TemplateData?: string };
    const templateData = JSON.parse(sesInput.TemplateData ?? '{}');
    expect(templateData.eventType).toBe('VACCINE');
    expect(templateData.reminderName).toBe('Vacuna anual');

    const updateCommands = ddbSendMock.mock.calls
      .map(([command]) => command)
      .filter((command) => command instanceof UpdateCommand);
    const rescheduleUpdate = updateCommands.find((command) =>
      String((command as any).input?.UpdateExpression ?? '').includes('#ttl')
    );
    expect(rescheduleUpdate).toBeDefined();
    expect((rescheduleUpdate as any).input.ExpressionAttributeNames).toEqual({
      '#ttl': 'ttl',
    });
  });
});
