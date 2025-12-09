import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { GetCommand, DeleteCommand, QueryCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { ok, badRequest, notFound, serverError } from '@peto/utils-dynamo/http';
import {
  buildPetEventPk,
  buildPetEventSk,
  buildPetReminderPk,
} from '@peto/domain-model';
import { assertOwnership, docClient, getOwnerId, PETO_TABLE_NAME } from './common';

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

  try {
    await assertOwnership(petId, ownerId);

    const res = await docClient.send(
      new GetCommand({
        TableName: PETO_TABLE_NAME,
        Key: { PK: buildPetEventPk(petId), SK: buildPetEventSk(new Date().toISOString(), eventId) },
      })
    );

    const item = res.Item;
    if (!item || item.eventId !== eventId) {
      return notFound('Event not found');
    }

    // Delete event
    await docClient.send(
      new DeleteCommand({
        TableName: PETO_TABLE_NAME,
        Key: { PK: buildPetEventPk(petId), SK: item.SK },
      })
    );

    // Remove related reminders for this event
    const reminders = await docClient.send(
      new QueryCommand({
        TableName: PETO_TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': buildPetReminderPk(petId),
          ':sk': 'REMINDER#',
        },
      })
    );
    const toDelete = (reminders.Items ?? []).filter((r) => r.eventId === eventId);
    if (toDelete.length > 0) {
      await docClient.send(
        new BatchWriteCommand({
          RequestItems: {
            [PETO_TABLE_NAME]: toDelete.map((r) => ({
              DeleteRequest: { Key: { PK: r.PK, SK: r.SK } },
            })),
          },
        })
      );
    }

    return ok({ message: 'Event deleted' });
  } catch (error) {
    console.error('Delete event error', error);
    return serverError('Failed to delete event');
  }
};
