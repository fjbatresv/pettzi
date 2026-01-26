import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { notFound, ok, unauthorized, serverError } from '@pettzi/utils-dynamo/http';
import {
  buildPetOwnerPk,
  buildPetOwnerSk,
  buildSharedRecordGsi1Pk,
  SharedRecord,
  fromItemSharedRecord,
} from '@pettzi/domain-model';
import { getOwnerId, PETTZI_TABLE_NAME } from '../utils';

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const normalizeLimit = (value?: string | null) => {
  const limit = Number(value);
  if (!Number.isFinite(limit)) {
    return 20;
  }
  return Math.min(Math.max(limit, 1), 50);
};

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const petId = event.pathParameters?.petId;
  if (!petId) {
    return notFound('petId is required');
  }

  let ownerId: string;
  try {
    ownerId = getOwnerId(event);
  } catch (err: any) {
    return err;
  }

  const limit = normalizeLimit(event.queryStringParameters?.limit);
  const cursorRaw = event.queryStringParameters?.cursor;
  const lastKey =
    cursorRaw
      ? (JSON.parse(Buffer.from(cursorRaw, 'base64').toString('utf8')) as any)
      : undefined;

  try {
    const link = await docClient.send(
      new GetCommand({
        TableName: PETTZI_TABLE_NAME,
        Key: {
          PK: buildPetOwnerPk(petId),
          SK: buildPetOwnerSk(ownerId),
        },
      })
    );

    if (!link.Item) {
      return unauthorized('You are not an owner of this pet');
    }

    const res = await docClient.send(
      new QueryCommand({
        TableName: PETTZI_TABLE_NAME,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk AND begins_with(GSI1SK, :prefix)',
        ExpressionAttributeValues: {
          ':pk': buildSharedRecordGsi1Pk(petId),
          ':prefix': 'SHARED_RECORD#',
        },
        Limit: limit,
        ScanIndexForward: false,
        ExclusiveStartKey: lastKey,
      })
    );

    const records = (res.Items ?? [])
      .map((item) => fromItemSharedRecord(item))
      .map((record: SharedRecord) => ({
        token: record.token,
        petId: record.petId,
        ownerId: record.ownerId,
        items: record.items,
        expiresAt: record.expiresAt.toISOString(),
        createdAt: record.createdAt.toISOString(),
      }));

    const nextCursor = res.LastEvaluatedKey
      ? Buffer.from(JSON.stringify(res.LastEvaluatedKey)).toString('base64')
      : undefined;

    return ok({ records, nextCursor });
  } catch (error) {
    console.error('List shared records error', error);
    return serverError('Failed to list shared records');
  }
};
