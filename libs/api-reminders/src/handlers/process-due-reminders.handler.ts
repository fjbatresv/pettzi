import { Handler } from 'aws-lambda';
import { PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import {
  fromItemPetReminder,
  buildReminderGsi1Pk,
  buildPetReminderPk,
  buildPetReminderSk,
  toItemPetReminder,
} from '@pettzi/domain-model';
import { docClient, PETTZI_TABLE_NAME } from './common';

const ses = new SESClient({});

export const handler: Handler = async () => {
  const today = new Date().toISOString().slice(0, 10);
  const fromAddress = process.env.REMINDERS_EMAIL_FROM;
  try {
    const res = await docClient.send(
      new QueryCommand({
        TableName: PETTZI_TABLE_NAME,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk AND begins_with(GSI1SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': buildReminderGsi1Pk(),
          ':sk': today,
        },
      })
    );

    const reminders = (res.Items ?? []).map(fromItemPetReminder);
    for (const reminder of reminders) {
      try {
        if (fromAddress) {
          const eventType = (reminder as any).eventType ?? 'Reminder';
          const notes = (reminder as any).notes ?? '';
          await ses.send(
            new SendEmailCommand({
              Source: fromAddress,
              Destination: { ToAddresses: [fromAddress] },
              Message: {
                Subject: { Data: `PETTZI reminder for ${reminder.petId}` },
                Body: {
                  Text: {
                    Data: `Reminder (${eventType}) for pet ${reminder.petId} due on ${
                      typeof reminder.dueDate === 'string'
                        ? reminder.dueDate
                        : reminder.dueDate?.toISOString()
                    }. ${notes}`,
                  },
                },
              },
            })
          );
        }

        await docClient.send(
          new UpdateCommand({
            TableName: PETTZI_TABLE_NAME,
            Key: {
              PK: buildPetReminderPk(reminder.petId),
              SK: buildPetReminderSk(reminder.reminderId),
            },
            UpdateExpression: 'SET lastNotifiedAt = :now',
            ExpressionAttributeValues: { ':now': new Date().toISOString() },
          })
        );

        const nextDueDate = getNextDueDate(reminder);
        if (nextDueDate) {
          const nextReminder = {
            reminderId: crypto.randomUUID(),
            petId: reminder.petId,
            eventId: reminder.eventId,
            dueDate: nextDueDate,
            message: reminder.message,
            metadata: reminder.metadata,
            createdAt: new Date(),
          };
          await docClient.send(
            new PutCommand({
              TableName: PETTZI_TABLE_NAME,
              Item: toItemPetReminder(nextReminder),
              ConditionExpression: 'attribute_not_exists(PK)',
            })
          );
        }
      } catch (sendErr) {
        console.error('Failed to notify reminder', reminder.reminderId, sendErr);
      }
    }
  } catch (error) {
    console.error('Process reminders error', error);
    throw error;
  }
};

type PeriodicityMeta = {
  type: 'hours' | 'daily' | 'weekly' | 'monthly';
  everyHours?: number;
  time?: string;
  weekday?: number;
  dayOfMonth?: number;
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
