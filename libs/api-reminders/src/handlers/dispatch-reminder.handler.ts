import { EventBridgeEvent } from 'aws-lambda';
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { buildPetReminderPk, buildPetReminderSk } from '@pettzi/domain-model';
import {
  buildIdempotencyKey,
  docClient,
  PETTZI_TABLE_NAME,
  REMINDERS_QUEUE_URL,
} from './common';

const sqs = new SQSClient({});

type DispatchDetail = {
  petId?: string;
  reminderId?: string;
};

const parsePayload = (event: { detail?: any; body?: string }) => {
  if (event.detail) {
    return event.detail;
  }
  if ((event as any).petId || (event as any).reminderId || (event as any).pet_id) {
    return event as any;
  }
  if (event.body) {
    try {
      return JSON.parse(event.body);
    } catch {
      return null;
    }
  }
  return null;
};

export const handler = async (event: EventBridgeEvent<string, DispatchDetail> & { detail?: any; body?: string; }) => {
  const payload = parsePayload(event);
  console.info('Dispatch reminder invoked', { detail: event.detail, payload, raw: event });
  const petId = payload?.petId ?? payload?.pet_id ?? payload?.petID;
  const reminderId = payload?.reminderId ?? payload?.reminder_id ?? payload?.reminderID;
  if (!petId || !reminderId) {
    console.warn('Missing reminder identifiers', { detail: event.detail });
    return;
  }
  if (!REMINDERS_QUEUE_URL) {
    console.error('Missing REMINDERS_QUEUE_URL');
    return;
  }

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
    console.warn('Reminder not found for dispatch', { petId, reminderId });
    return;
  }

  const dueDateIso = typeof item.dueDate === 'string' ? item.dueDate : new Date(item.dueDate).toISOString();
  const idempotencyKey = buildIdempotencyKey(reminderId, dueDateIso);
  try {
    await docClient.send(
      new UpdateCommand({
        TableName: PETTZI_TABLE_NAME,
        Key: {
          PK: buildPetReminderPk(petId),
          SK: buildPetReminderSk(reminderId),
        },
        UpdateExpression: 'SET lastEnqueuedKey = :key, lastEnqueuedAt = :now',
        ConditionExpression: 'attribute_not_exists(lastEnqueuedKey) OR lastEnqueuedKey <> :key',
        ExpressionAttributeValues: {
          ':key': idempotencyKey,
          ':now': new Date().toISOString(),
        },
      })
    );
  } catch (err: any) {
    if (err?.name === 'ConditionalCheckFailedException') {
      console.info('Reminder already enqueued', { petId, reminderId, idempotencyKey });
      return;
    }
    throw err;
  }

  try {
    await sqs.send(
      new SendMessageCommand({
        QueueUrl: REMINDERS_QUEUE_URL,
        MessageBody: JSON.stringify({ petId, reminderId }),
        MessageGroupId: reminderId,
        MessageDeduplicationId: idempotencyKey,
      })
    );
    console.info('Reminder enqueued', { petId, reminderId, idempotencyKey });
  } catch (err) {
    await docClient.send(
      new UpdateCommand({
        TableName: PETTZI_TABLE_NAME,
        Key: {
          PK: buildPetReminderPk(petId),
          SK: buildPetReminderSk(reminderId),
        },
        UpdateExpression: 'REMOVE lastEnqueuedKey, lastEnqueuedAt',
      })
    );
    throw err;
  }

};
