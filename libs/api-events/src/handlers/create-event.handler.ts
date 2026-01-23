import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { created, badRequest, serverError } from '@pettzi/utils-dynamo/http';
import {
  PetEvent,
  EventType,
  toItemPetEvent,
} from '@pettzi/domain-model';
import { docClient, getOwnerId, parseJson, assertOwnership, PETTZI_TABLE_NAME } from './common';

interface CreateEventRequest {
  eventType: EventType;
  date: string;
  title?: string;
  notes?: string;
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
    ownerId,
    eventId,
    eventType: payload.eventType,
    eventDate: new Date(payload.date),
    notes: payload.notes,
    metadata: payload.metadata,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await docClient.send(
      new PutCommand({
        TableName: PETTZI_TABLE_NAME,
        Item: toItemPetEvent(petEvent),
        ConditionExpression: 'attribute_not_exists(PK)',
      })
    );

    return created(petEvent);
  } catch (error) {
    console.error('Create event error', error);
    return serverError('Failed to create event');
  }
};
