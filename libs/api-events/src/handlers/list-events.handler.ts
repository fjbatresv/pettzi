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

    const limitRaw = event.queryStringParameters?.limit;
    const cursorRaw = event.queryStringParameters?.cursor;
    const limit = Math.min(Math.max(Number(limitRaw) || 20, 1), 50);
    const startKey =
      cursorRaw ? (JSON.parse(Buffer.from(cursorRaw, 'base64').toString('utf8')) as any) : undefined;

    const res = await docClient.send(
      new QueryCommand({
        TableName: PETTZI_TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': buildPetEventPk(petId),
          ':sk': 'EVENT#',
        },
        Limit: limit,
        ExclusiveStartKey: startKey,
        ScanIndexForward: false,
      })
    );

    const events = (res.Items ?? []).map((item) => fromItemPetEvent(item));
    const nextCursor = res.LastEvaluatedKey
      ? Buffer.from(JSON.stringify(res.LastEvaluatedKey)).toString('base64')
      : undefined;
    return ok({ events, nextCursor });
  } catch (error) {
    console.error('List events error', error);
    return serverError('Failed to list events');
  }
};
