import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from '@aws-sdk/lib-dynamodb';
import crypto from 'crypto';
import { badRequest, created, notFound, unauthorized, serverError } from '@pettzi/utils-dynamo/http';
import {
  buildPetOwnerPk,
  buildPetOwnerSk,
  EventType,
  SharedRecord,
  toItemSharedRecord,
} from '@pettzi/domain-model';
import { getOwnerId, isoNow, parseJson, PETTZI_TABLE_NAME } from '../utils';

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const EXPIRATION_OPTIONS: Record<string, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '3d': 3 * 24 * 60 * 60 * 1000,
  '1w': 7 * 24 * 60 * 60 * 1000,
  '1m': 30 * 24 * 60 * 60 * 1000,
};

interface CreateSharedRecordRequest {
  items?: EventType[];
  expiresIn?: keyof typeof EXPIRATION_OPTIONS;
  password?: string;
}

const ALLOWED_ITEMS: EventType[] = [
  EventType.MEDICATION,
  EventType.GROOMING,
  EventType.VET_VISIT,
  EventType.VACCINE,
  EventType.WEIGHT,
  EventType.INCIDENT,
  EventType.WALK,
  EventType.FEEDING,
];

const hashPassword = (password: string, salt: string) =>
  crypto.scryptSync(password, salt, 64).toString('hex');

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

  let payload: CreateSharedRecordRequest;
  try {
    payload = parseJson<CreateSharedRecordRequest>(event.body);
  } catch (err: any) {
    return err;
  }

  const items = Array.isArray(payload.items)
    ? payload.items.filter((item): item is EventType => ALLOWED_ITEMS.includes(item))
    : [];
  if (items.length === 0) {
    return badRequest('items are required');
  }

  const expiresKey = payload.expiresIn ?? '24h';
  const ttl = EXPIRATION_OPTIONS[expiresKey];
  if (!ttl) {
    return badRequest('invalid expiration');
  }

  const password = payload.password?.trim();
  const passwordSalt = password ? crypto.randomBytes(16).toString('hex') : undefined;
  const passwordHash = password && passwordSalt ? hashPassword(password, passwordSalt) : undefined;
  const now = new Date(isoNow());
  const expiresAt = new Date(now.getTime() + ttl);

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

    let token = crypto.randomUUID();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const record: SharedRecord = {
        token,
        petId,
        ownerId,
        items,
        expiresAt,
        createdAt: now,
        passwordHash,
        passwordSalt,
      };

      try {
        await docClient.send(
          new PutCommand({
            TableName: PETTZI_TABLE_NAME,
            Item: toItemSharedRecord(record),
            ConditionExpression: 'attribute_not_exists(PK)',
          })
        );
        return created({
          token: record.token,
          petId: record.petId,
          items: record.items,
          expiresAt: record.expiresAt.toISOString(),
        });
      } catch (error: any) {
        if (error?.name === 'ConditionalCheckFailedException') {
          token = crypto.randomUUID();
          continue;
        }
        throw error;
      }
    }

    return serverError('Failed to generate share record');
  } catch (error) {
    console.error('Create shared record error', error);
    return serverError('Failed to create shared record');
  }
};
