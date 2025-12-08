import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ok, badRequest, notFound, serverError } from '@peto/utils-dynamo/http';
import {
  buildPetEventPk,
  buildPetEventSk,
  fromItemPetEvent,
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
        Key: {
          PK: buildPetEventPk(petId),
          SK: `EVENT#${eventId}`, // placeholder to allow Get; events use date in SK, so fallback below
        },
      })
    );

    let eventItem;
    if (res.Item && res.Item.eventId === eventId) {
      eventItem = fromItemPetEvent(res.Item);
    } else {
      // If the SK pattern includes date, fallback to query and filter by eventId.
      const queryRes = await docClient.send(
        new QueryCommand({
          TableName: PETO_TABLE_NAME,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
          ExpressionAttributeValues: {
            ':pk': buildPetEventPk(petId),
            ':sk': 'EVENT#',
          },
        })
      );

      const found = (queryRes.Items ?? []).find((i: any) => i.eventId === eventId);
      if (found) {
        eventItem = fromItemPetEvent(found);
      }
    }

    if (!eventItem) {
      return notFound('Event not found');
    }

    return ok(eventItem);
  } catch (error) {
    console.error('Get event error', error);
    return serverError('Failed to get event');
  }
};
