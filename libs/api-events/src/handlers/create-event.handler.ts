import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { created, badRequest, serverError } from '@peto/utils-dynamo/http';
import {
  PetEvent,
  PetReminder,
  EventType,
  toItemPetEvent,
  toItemPetReminder,
} from '@peto/domain-model';
import { docClient, getOwnerId, parseJson, assertOwnership, PETO_TABLE_NAME } from './common';

interface CreateEventRequest {
  eventType: EventType;
  date: string;
  title?: string;
  notes?: string;
  nextReminderDate?: string;
  metadata?: Record<string, unknown>;
}

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

  let payload: CreateEventRequest;
  try {
    payload = parseJson<CreateEventRequest>(event.body);
  } catch (err: any) {
    return err;
  }

  if (!payload.eventType || !payload.date) {
    return badRequest('eventType and date are required');
  }

  try {
    await assertOwnership(petId, ownerId);
  } catch (err: any) {
    return err;
  }

  const eventId = crypto.randomUUID();
  const now = new Date();
  const petEvent: PetEvent = {
    petId,
    eventId,
    eventType: payload.eventType,
    eventDate: new Date(payload.date),
    notes: payload.notes,
    metadata: payload.metadata,
    createdAt: now,
    updatedAt: now,
  };

  const items = [
    {
      Put: {
        TableName: PETO_TABLE_NAME,
        Item: toItemPetEvent(petEvent),
        ConditionExpression: 'attribute_not_exists(PK)',
      },
    },
  ];

  let reminder: PetReminder | undefined;
  if (payload.nextReminderDate) {
    reminder = {
      reminderId: crypto.randomUUID(),
      petId,
      eventId,
      dueDate: new Date(payload.nextReminderDate),
      createdAt: now,
      message: payload.title,
    };
    items.push({
      Put: {
        TableName: PETO_TABLE_NAME,
        Item: toItemPetReminder(reminder),
        ConditionExpression: 'attribute_not_exists(PK)',
      },
    });
  }

  try {
    await docClient.send(
      new TransactWriteCommand({
        TransactItems: items,
      })
    );

    return created({
      ...petEvent,
      reminderId: reminder?.reminderId,
    });
  } catch (error) {
    console.error('Create event error', error);
    return serverError('Failed to create event');
  }
};
