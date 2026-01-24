import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { DeleteCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import {
  SchedulerClient,
  CreateScheduleCommand,
  DeleteScheduleCommand,
} from '@aws-sdk/client-scheduler';
import { badRequest, created, serverError } from '@pettzi/utils-dynamo/http';
import { PetReminder, toItemPetReminder, buildPetReminderPk, buildPetReminderSk } from '@pettzi/domain-model';
import {
  assertOwnership,
  buildReminderRuleName,
  docClient,
  getOwnerId,
  parseIsoDate,
  parseJson,
  PETTZI_TABLE_NAME,
  REMINDER_DISPATCHER_ARN,
  REMINDER_SCHEDULER_ROLE_ARN,
  isSchedulerNotFound,
  toScheduleExpression,
} from './common';

interface CreateReminderRequest {
  dueDate: string;
  message?: string;
  eventId?: string;
  metadata?: Record<string, unknown>;
}

const scheduler = new SchedulerClient({});

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const petId = event.pathParameters?.petId;
  if (!petId) {
    return badRequest('petId is required');
  }

  let ownerId: string;
  try {
    ownerId = getOwnerId(event);
  } catch (err: any) {
    return err;
  }

  let payload: CreateReminderRequest;
  try {
    payload = parseJson<CreateReminderRequest>(event.body);
  } catch (err: any) {
    return err;
  }

  if (!payload.dueDate) {
    return badRequest('dueDate is required');
  }

  let dueDate: Date;
  try {
    const parsed = parseIsoDate(payload.dueDate);
    if (!parsed) {
      return badRequest('dueDate is required');
    }
    dueDate = parsed;
  } catch (err: any) {
    return err;
  }

  try {
    await assertOwnership(petId, ownerId);
  } catch (err: any) {
    return err;
  }

  const now = new Date();
  if (dueDate.getTime() <= now.getTime()) {
    return badRequest('dueDate must be in the future');
  }

  if (!REMINDER_DISPATCHER_ARN || !REMINDER_SCHEDULER_ROLE_ARN) {
    return serverError('Reminder scheduler is not configured');
  }

  const reminderId = crypto.randomUUID();
  const ruleName = buildReminderRuleName(reminderId);
  const reminder: PetReminder = {
    reminderId,
    petId,
    ownerId,
    eventId: payload.eventId,
    dueDate,
    message: payload.message,
    metadata: payload.metadata,
    createdAt: now,
  };
  const recurring = Boolean(payload.metadata?.recurring || payload.metadata?.periodicity);

  try {
    await docClient.send(
      new PutCommand({
        TableName: PETTZI_TABLE_NAME,
        Item: {
          ...toItemPetReminder(reminder),
          ruleName,
        },
        ConditionExpression: 'attribute_not_exists(PK)',
      })
    );

    let scheduleExpression: string;
    try {
      scheduleExpression = toScheduleExpression(dueDate);
    } catch (scheduleError: any) {
      if (scheduleError?.message === 'SCHEDULE_DATE_TOO_FAR') {
        return badRequest('dueDate must be within 1 year');
      }
      return badRequest('dueDate is invalid');
    }
    console.info('Scheduling reminder', {
      reminderId: reminder.reminderId,
      dueDate: dueDate.toISOString(),
      scheduleExpression,
    });
    await scheduler.send(
      new CreateScheduleCommand({
        Name: ruleName,
        ScheduleExpression: scheduleExpression,
        FlexibleTimeWindow: { Mode: 'OFF' },
        State: 'ENABLED',
        ActionAfterCompletion: recurring ? 'NONE' : 'DELETE',
        Target: {
          Arn: REMINDER_DISPATCHER_ARN,
          RoleArn: REMINDER_SCHEDULER_ROLE_ARN,
          Input: JSON.stringify({ petId, reminderId: reminder.reminderId }),
        },
      })
    );

    return created({ ...reminder, recurring });
  } catch (error) {
    if (ruleName) {
      try {
        await scheduler.send(new DeleteScheduleCommand({ Name: ruleName }));
      } catch (cleanupError) {
        if (!isSchedulerNotFound(cleanupError)) {
          console.error('Failed to cleanup reminder rule', cleanupError);
        }
      }
      try {
        await docClient.send(
          new DeleteCommand({
            TableName: PETTZI_TABLE_NAME,
            Key: {
              PK: buildPetReminderPk(petId),
              SK: buildPetReminderSk(reminder.reminderId),
            },
          })
        );
      } catch (deleteError) {
        console.error('Failed to cleanup reminder item', deleteError);
      }
    }
    console.error('Create reminder error', error);
    return serverError('Failed to create reminder');
  }
};
