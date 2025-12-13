import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import {
  ok,
  badRequest,
  notFound,
  serverError,
} from '@pettzi/utils-dynamo/http';
import {
  buildPetEventPk,
  buildPetEventSk,
  fromItemPetEvent,
} from '@pettzi/domain-model';
import { assertOwnership, docClient, getOwnerId, parseJson, PETTZI_TABLE_NAME } from './common';

interface UpdateEventRequest {
  eventType?: string;
  eventDate?: string;
  title?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
  nextReminderDate?: string;
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const petId = event.pathParameters?.petId;
  const eventId = event.pathParameters?.eventId;
  if (!petId || !eventId) {
    return badRequest('petId and eventId are required');
  }

  let ownerId: string;
  try {
    ownerId = getOwnerId(event);
  } catch (err: any) {
    return err;
  }

  let payload: UpdateEventRequest;
  try {
    payload = parseJson<UpdateEventRequest>(event.body);
  } catch (err: any) {
    return err;
  }

  if (!payload || Object.keys(payload).length === 0) {
    return badRequest('No fields to update');
  }

  try {
    await assertOwnership(petId, ownerId);

    const existing = await docClient.send(
      new GetCommand({
        TableName: PETTZI_TABLE_NAME,
        Key: {
          PK: buildPetEventPk(petId),
          SK: buildPetEventSk(new Date().toISOString(), eventId),
        },
      })
    );

    const item = existing.Item || null;
    if (!item || item.eventId !== eventId) {
      return notFound('Event not found');
    }

    const updateExpressions: string[] = [];
    const attrNames: Record<string, string> = {};
    const attrValues: Record<string, any> = { ':updatedAt': new Date().toISOString() };

    const setField = (field: string, value: any) => {
      attrNames[`#${field}`] = field;
      attrValues[`:${field}`] = value;
      updateExpressions.push(`#${field} = :${field}`);
    };

    if (payload.eventType !== undefined) setField('eventType', payload.eventType);
    if (payload.eventDate !== undefined) setField('eventDate', payload.eventDate);
    if (payload.title !== undefined) setField('title', payload.title);
    if (payload.notes !== undefined) setField('notes', payload.notes);
    if (payload.metadata !== undefined) setField('metadata', payload.metadata);
    setField('updatedAt', attrValues[':updatedAt']);

    const res = await docClient.send(
      new UpdateCommand({
        TableName: PETTZI_TABLE_NAME,
        Key: { PK: buildPetEventPk(petId), SK: item.SK },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: attrNames,
        ExpressionAttributeValues: attrValues,
        ReturnValues: 'ALL_NEW',
      })
    );

    const updated = res.Attributes ? fromItemPetEvent(res.Attributes) : undefined;
    if (!updated) {
      return serverError('Failed to update event');
    }
    return ok(updated);
  } catch (error) {
    console.error('Update event error', error);
    return serverError('Failed to update event');
  }
};
