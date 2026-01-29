import { SQSEvent } from 'aws-lambda';
import {
  GetCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  SchedulerClient,
  CreateScheduleCommand,
  UpdateScheduleCommand,
  DeleteScheduleCommand,
} from '@aws-sdk/client-scheduler';
import {
  SESClient,
  SendEmailCommand,
  SendTemplatedEmailCommand,
} from '@aws-sdk/client-ses';
import {
  buildOwnerProfilePk,
  buildOwnerProfileSk,
  buildPetOwnerPk,
  buildPetPkKey,
  buildPetSkMetadata,
  buildPetReminderPk,
  buildPetReminderSk,
  buildReminderGsi1Sk,
} from '@pettzi/domain-model';
import {
  buildIdempotencyKey,
  buildReminderRuleName,
  docClient,
  isSchedulerNotFound,
  PETTZI_TABLE_NAME,
  REMINDER_DISPATCHER_ARN,
  REMINDER_SCHEDULER_ROLE_ARN,
  SES_REMINDER_TEMPLATE_NAME,
  toScheduleExpression,
} from './common';

const ses = new SESClient({});
const scheduler = new SchedulerClient({});

interface ReminderMessage {
  petId: string;
  reminderId: string;
}

type PeriodicityMeta = {
  type: 'hours' | 'daily' | 'weekly' | 'monthly';
  everyHours?: number;
  time?: string;
  weekday?: number;
  dayOfMonth?: number;
};

export const handler = async (event: SQSEvent) => {
  console.info('Consume reminders batch', { count: event.Records?.length ?? 0 });
  for (const record of event.Records ?? []) {
    let payload: ReminderMessage | null = null;
    try {
      payload = JSON.parse(record.body) as ReminderMessage;
    } catch {
      console.warn('Invalid reminder message payload');
      continue;
    }
    if (!payload?.petId || !payload?.reminderId) {
      console.warn('Reminder message missing identifiers', { payload });
      continue;
    }

    const { petId, reminderId } = payload;
    const res = await docClient.send(
      new GetCommand({
        TableName: PETTZI_TABLE_NAME,
        Key: {
          PK: buildPetReminderPk(petId),
          SK: buildPetReminderSk(reminderId),
        },
      })
    );
    const item = res.Item as Record<string, any> | undefined;
    if (!item) {
      console.warn('Reminder not found for consume', { petId, reminderId });
      continue;
    }

    const dueDateIso = typeof item.dueDate === 'string' ? item.dueDate : new Date(item.dueDate).toISOString();
    const idempotencyKey = buildIdempotencyKey(reminderId, dueDateIso);

    const ownerIds = new Set<string>();
    const primaryOwnerId = item.ownerId as string | undefined;
    if (primaryOwnerId) {
      ownerIds.add(primaryOwnerId);
    }
    try {
      const ownersRes = await docClient.send(
        new QueryCommand({
          TableName: PETTZI_TABLE_NAME,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
          ExpressionAttributeValues: {
            ':pk': buildPetOwnerPk(petId),
            ':sk': 'OWNER#',
          },
        })
      );
      for (const ownerLink of ownersRes.Items ?? []) {
        const linkedOwnerId = ownerLink.ownerId as string | undefined;
        if (linkedOwnerId) {
          ownerIds.add(linkedOwnerId);
        }
      }
    } catch (err) {
      console.error('Failed to list pet owners for reminder', { petId, reminderId, err });
    }

    const recipients = (
      await Promise.all(
        [...ownerIds].map(async (ownerId) => {
          const ownerRes = await docClient.send(
            new GetCommand({
              TableName: PETTZI_TABLE_NAME,
              Key: {
                PK: buildOwnerProfilePk(ownerId),
                SK: buildOwnerProfileSk(),
              },
            })
          );
          const owner = ownerRes.Item as Record<string, any> | undefined;
          const email = owner?.email as string | undefined;
          if (!email) {
            console.warn('Owner email missing for reminder', { ownerId, petId, reminderId });
            return null;
          }
          return {
            ownerId,
            email,
            locale: (owner?.locale as string | undefined) || 'es',
          };
        })
      )
    ).filter((recipient): recipient is { ownerId: string; email: string; locale: string } => Boolean(recipient));

    if (recipients.length === 0) {
      console.warn('No reminder recipients found', { petId, reminderId });
      continue;
    }

    const petRes = await docClient.send(
      new GetCommand({
        TableName: PETTZI_TABLE_NAME,
        Key: {
          PK: buildPetPkKey(petId),
          SK: buildPetSkMetadata(),
        },
      })
    );
    const petName = (petRes.Item as Record<string, any> | undefined)?.name ?? petId;

    const message = (item.message as string | undefined) ?? '';
    const metadata = parseMetadata(item.metadata);
    const reminderName = (metadata.name as string | undefined) || message || 'Reminder';
    const eventType = (metadata.eventType as string | undefined) || reminderName;
    const notes = (metadata.notes as string | undefined) || '';

    const fromAddress = process.env.REMINDERS_EMAIL_FROM;
    if (!fromAddress) {
      console.error('Missing REMINDERS_EMAIL_FROM');
      continue;
    }

    for (const recipient of recipients) {
      if (SES_REMINDER_TEMPLATE_NAME) {
        console.info('Sending templated reminder email', {
          reminderId,
          petId,
          to: recipient.email,
          from: fromAddress,
          template: SES_REMINDER_TEMPLATE_NAME,
        });
        await ses.send(
          new SendTemplatedEmailCommand({
            Source: fromAddress,
            Destination: { ToAddresses: [recipient.email] },
            Template: SES_REMINDER_TEMPLATE_NAME,
            TemplateData: JSON.stringify({
              reminderName,
              eventType,
              petName,
              eventDate: dueDateIso,
              notes,
              locale: recipient.locale,
            }),
          })
        );
      } else {
        console.info('Sending fallback reminder email', {
          reminderId,
          petId,
          to: recipient.email,
          from: fromAddress,
        });
        await ses.send(
          new SendEmailCommand({
            Source: fromAddress,
            Destination: { ToAddresses: [recipient.email] },
            Message: {
              Subject: { Data: `PETTZI reminder for ${petName}` },
              Body: {
                Text: {
                  Data: `Reminder (${reminderName}) for ${petName} due on ${dueDateIso}. ${notes}`,
                },
              },
            },
          })
        );
      }
      console.info('Reminder email sent', { reminderId, petId, email: recipient.email });
    }

    await docClient.send(
      new UpdateCommand({
        TableName: PETTZI_TABLE_NAME,
        Key: {
          PK: buildPetReminderPk(petId),
          SK: buildPetReminderSk(reminderId),
        },
        UpdateExpression: 'SET lastSentAt = :now, lastSentKey = :key',
        ExpressionAttributeValues: {
          ':now': new Date().toISOString(),
          ':key': idempotencyKey,
        },
      })
    );

    const nextDueDate = getNextDueDate({
      dueDate: new Date(dueDateIso),
      metadata,
    });

    if (!nextDueDate) {
      console.info('Reminder completed (non-recurring)', { reminderId, petId });
      await docClient.send(
        new UpdateCommand({
          TableName: PETTZI_TABLE_NAME,
          Key: {
            PK: buildPetReminderPk(petId),
            SK: buildPetReminderSk(reminderId),
          },
          UpdateExpression: 'SET completedAt = :now',
          ExpressionAttributeValues: { ':now': new Date().toISOString() },
        })
      );
      continue;
    }

    const ruleName = (item.ruleName as string | undefined) || buildReminderRuleName(reminderId);
    if (!REMINDER_DISPATCHER_ARN || !REMINDER_SCHEDULER_ROLE_ARN) {
      console.error('Missing REMINDER_DISPATCHER_ARN');
      continue;
    }

    let scheduleExpression: string;
    try {
      scheduleExpression = toScheduleExpression(nextDueDate);
    } catch (scheduleErr: any) {
      console.error('Invalid schedule date for reminder', scheduleErr);
      await docClient.send(
        new UpdateCommand({
          TableName: PETTZI_TABLE_NAME,
          Key: {
            PK: buildPetReminderPk(petId),
            SK: buildPetReminderSk(reminderId),
          },
          UpdateExpression: 'SET completedAt = :now',
          ExpressionAttributeValues: { ':now': new Date().toISOString() },
        })
      );
      continue;
    }
    console.info('Rescheduling reminder', {
      reminderId,
      petId,
      nextDueDate: nextDueDate.toISOString(),
      scheduleExpression,
    });
    try {
      await scheduler.send(
        new UpdateScheduleCommand({
          Name: ruleName,
          ScheduleExpression: scheduleExpression,
          FlexibleTimeWindow: { Mode: 'OFF' },
          State: 'ENABLED',
          ActionAfterCompletion: 'NONE',
          Target: {
            Arn: REMINDER_DISPATCHER_ARN,
            RoleArn: REMINDER_SCHEDULER_ROLE_ARN,
            Input: JSON.stringify({ petId, reminderId }),
          },
        })
      );

      await docClient.send(
        new UpdateCommand({
          TableName: PETTZI_TABLE_NAME,
          Key: {
            PK: buildPetReminderPk(petId),
            SK: buildPetReminderSk(reminderId),
          },
        UpdateExpression:
          'SET dueDate = :dueDate, GSI1SK = :gsi1, #ttl = :ttl, updatedAt = :now REMOVE completedAt, lastEnqueuedKey, lastEnqueuedAt',
        ExpressionAttributeNames: {
          '#ttl': 'ttl',
        },
        ExpressionAttributeValues: {
          ':dueDate': nextDueDate.toISOString(),
          ':gsi1': buildReminderGsi1Sk(nextDueDate, petId, item.eventId ?? reminderId),
          ':ttl': Math.floor(nextDueDate.getTime() / 1000),
          ':now': new Date().toISOString(),
          },
        })
      );
    } catch (err: any) {
      if (isSchedulerNotFound(err)) {
        try {
          await scheduler.send(
            new CreateScheduleCommand({
              Name: ruleName,
              ScheduleExpression: scheduleExpression,
              FlexibleTimeWindow: { Mode: 'OFF' },
              State: 'ENABLED',
              ActionAfterCompletion: 'NONE',
              Target: {
                Arn: REMINDER_DISPATCHER_ARN,
                RoleArn: REMINDER_SCHEDULER_ROLE_ARN,
                Input: JSON.stringify({ petId, reminderId }),
              },
            })
          );
        } catch (createErr) {
          console.error('Failed to create reminder schedule', createErr);
        }
      } else {
        console.error('Failed to reschedule reminder', err);
        try {
          await scheduler.send(new DeleteScheduleCommand({ Name: ruleName }));
        } catch (cleanupErr) {
          if (!isSchedulerNotFound(cleanupErr)) {
            console.error('Failed to cleanup reminder schedule', cleanupErr);
          }
        }
      }
    }
  }
};

const getNextDueDate = (reminder: {
  dueDate: Date;
  metadata?: Record<string, unknown>;
}): Date | null => {
  const metadata = reminder.metadata ?? {};
  const periodicity = metadata.periodicity as PeriodicityMeta | undefined;
  if (!periodicity?.type) {
    return null;
  }

  const endDateRaw = metadata.endDate as string | undefined | null;
  const endDate = endDateRaw ? new Date(endDateRaw) : null;
  const indefinite = Boolean(metadata.indefinite);
  const next = computeNextDate(reminder.dueDate, periodicity);
  if (!next) {
    return null;
  }
  if (!indefinite && endDate && next.getTime() > endDate.getTime()) {
    return null;
  }
  return next;
};

const computeNextDate = (baseDate: Date, periodicity: PeriodicityMeta): Date | null => {
  const base = new Date(baseDate);
  switch (periodicity.type) {
    case 'hours': {
      const hours = Math.max(1, periodicity.everyHours ?? 1);
      return new Date(base.getTime() + hours * 60 * 60 * 1000);
    }
    case 'daily': {
      const next = addDays(base, 1);
      return applyTime(next, periodicity.time, base);
    }
    case 'weekly': {
      const next = addDays(base, 1);
      const weekday = periodicity.weekday ?? next.getDay();
      return nextWeekday(next, weekday, periodicity.time, base);
    }
    case 'monthly': {
      const dayOfMonth = periodicity.dayOfMonth ?? base.getDate();
      const next = nextMonthDay(base, dayOfMonth);
      return applyTime(next, periodicity.time, base);
    }
    default:
      return null;
  }
};

const addDays = (value: Date, days: number) => {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
};

const applyTime = (date: Date, timeValue?: string, fallback?: Date) => {
  if (!timeValue) {
    if (fallback) {
      date.setHours(fallback.getHours(), fallback.getMinutes(), 0, 0);
    }
    return date;
  }
  const [hours, minutes] = timeValue.split(':').map(Number);
  date.setHours(hours ?? 0, minutes ?? 0, 0, 0);
  return date;
};

const nextWeekday = (base: Date, weekday: number, timeValue?: string, fallback?: Date) => {
  const next = applyTime(new Date(base), timeValue, fallback);
  const currentDay = next.getDay();
  const diff = (weekday - currentDay + 7) % 7;
  next.setDate(next.getDate() + (diff === 0 ? 7 : diff));
  return next;
};

const nextMonthDay = (base: Date, day: number) => {
  const next = new Date(base.getFullYear(), base.getMonth() + 1, 1);
  const maxDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(day, maxDay));
  return next;
};

const parseMetadata = (value: unknown): Record<string, unknown> => {
  if (!value) {
    return {};
  }
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return value as Record<string, unknown>;
};
