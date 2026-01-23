import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';
import { badRequest, notFound, ok, serverError } from '@pettzi/utils-dynamo/http';
import {
  buildPetPkKey,
  buildPetSkMetadata,
  buildSharedRecordPk,
  buildPetEventPk,
  fromItemPetEvent,
  fromItemPet,
  fromItemSharedRecord,
} from '@pettzi/domain-model';
import { PETTZI_TABLE_NAME } from '../utils';

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3 = new S3Client({});
const PETTZI_DOCS_BUCKET_NAME = process.env.PETTZI_DOCS_BUCKET_NAME ?? '';

const hashPassword = (password: string, salt: string) =>
  crypto.scryptSync(password, salt, 64).toString('hex');

const safeCompare = (a: string, b: string) => {
  const aBuf = Buffer.from(a, 'hex');
  const bBuf = Buffer.from(b, 'hex');
  if (aBuf.length !== bBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(aBuf, bBuf);
};

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const token = event.pathParameters?.token;
  if (!token) {
    return notFound('token is required');
  }

  const password = event.queryStringParameters?.password?.trim();

  try {
    const res = await docClient.send(
      new QueryCommand({
        TableName: PETTZI_TABLE_NAME,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: {
          ':pk': buildSharedRecordPk(token),
        },
        Limit: 1,
      })
    );

    const item = res.Items?.[0];
    if (!item) {
      return notFound('Shared record not found');
    }

    const record = fromItemSharedRecord(item);
    if (record.expiresAt.getTime() <= Date.now()) {
      return notFound('Shared record expired');
    }

    if (record.passwordHash && record.passwordSalt) {
      if (!password) {
        return ok({
          requiresPassword: true,
          message: 'PASSWORD_REQUIRED',
        });
      }
      const candidateHash = hashPassword(password, record.passwordSalt);
      if (!safeCompare(candidateHash, record.passwordHash)) {
        return badRequest('Invalid password');
      }
    }

    const petRes = await docClient.send(
      new GetCommand({
        TableName: PETTZI_TABLE_NAME,
        Key: {
          PK: buildPetPkKey(record.petId),
          SK: buildPetSkMetadata(),
        },
      })
    );

    const pet = petRes.Item ? fromItemPet(petRes.Item) : undefined;
    if (pet?.isArchived) {
      return notFound('Pet archived');
    }

    const limitRaw = event.queryStringParameters?.limit;
    const cursorRaw = event.queryStringParameters?.cursor;
    const limit = Math.min(Math.max(Number(limitRaw) || 5, 1), 50);
    let lastKey =
      cursorRaw ? (JSON.parse(Buffer.from(cursorRaw, 'base64').toString('utf8')) as any) : undefined;
    const events: ReturnType<typeof fromItemPetEvent>[] = [];

    while (events.length < limit) {
      const eventsRes = await docClient.send(
        new QueryCommand({
          TableName: PETTZI_TABLE_NAME,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
          ExpressionAttributeValues: {
            ':pk': buildPetEventPk(record.petId),
            ':prefix': 'EVENT#',
          },
          Limit: limit,
          ExclusiveStartKey: lastKey,
          ScanIndexForward: false,
        })
      );

      const batch = (eventsRes.Items ?? [])
        .map((item) => fromItemPetEvent(item))
        .filter((event) => record.items.includes(event.eventType));
      events.push(...batch);

      if (!eventsRes.LastEvaluatedKey) {
        lastKey = undefined;
        break;
      }
      lastKey = eventsRes.LastEvaluatedKey;
      if (batch.length === 0 && eventsRes.Items?.length === 0) {
        break;
      }
    }

    const nextCursor = lastKey
      ? Buffer.from(JSON.stringify(lastKey)).toString('base64')
      : undefined;

    let photoUrl: string | undefined;
    const photoKey = pet?.photoThumbnailKey ?? pet?.photoKey;
    if (photoKey && PETTZI_DOCS_BUCKET_NAME) {
      photoUrl = await getSignedUrl(
        s3,
        new GetObjectCommand({
          Bucket: PETTZI_DOCS_BUCKET_NAME,
          Key: photoKey,
        }),
        { expiresIn: 900 }
      );
    }

    return ok({
      token: record.token,
      petId: record.petId,
      items: record.items,
      expiresAt: record.expiresAt.toISOString(),
      createdAt: record.createdAt.toISOString(),
      pet,
      photoUrl,
      events,
      nextCursor,
    });
  } catch (error) {
    console.error('Get shared record error', error);
    return serverError('Failed to get shared record');
  }
};
