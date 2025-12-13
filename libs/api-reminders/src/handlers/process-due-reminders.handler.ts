import { Handler } from 'aws-lambda';
import { QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import {
  fromItemPetReminder,
  buildReminderGsi1Pk,
  buildPetReminderPk,
  buildPetReminderSk,
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
      } catch (sendErr) {
        console.error('Failed to notify reminder', reminder.reminderId, sendErr);
      }
    }
  } catch (error) {
    console.error('Process reminders error', error);
    throw error;
  }
};
