import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ok, badRequest, serverError } from '@pettzi/utils-dynamo/http';
import {
  buildPetEventPk,
  fromItemPetEvent,
  PetId,
} from '@pettzi/domain-model';
import { assertOwnership, docClient, getOwnerId, PETTZI_TABLE_NAME } from './common';

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const petId = event.pathParameters?.petId as PetId | undefined;
  if (!petId) {
    return badRequest('petId is required');
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
      new QueryCommand({
        TableName: PETTZI_TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': buildPetEventPk(petId),
          ':sk': 'EVENT#',
        },
      })
    );

    const events = (res.Items ?? []).map((item) => fromItemPetEvent(item));
    return ok({ events });
  } catch (error) {
    console.error('List events error', error);
    return serverError('Failed to list events');
  }
};
