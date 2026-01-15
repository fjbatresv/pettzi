import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { badRequest, created, serverError } from '@pettzi/utils-dynamo/http';
import { PetReminder, toItemPetReminder } from '@pettzi/domain-model';
import {
  assertOwnership,
  docClient,
  getOwnerId,
  parseIsoDate,
  parseJson,
  PETTZI_TABLE_NAME,
} from './common';

interface CreateReminderRequest {
  dueDate: string;
  message?: string;
  eventId?: string;
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
  const reminder: PetReminder = {
    reminderId: crypto.randomUUID(),
    petId,
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
        Item: toItemPetReminder(reminder),
        ConditionExpression: 'attribute_not_exists(PK)',
      })
    );
    return created({ ...reminder, recurring });
  } catch (error) {
    console.error('Create reminder error', error);
    return serverError('Failed to create reminder');
  }
};
