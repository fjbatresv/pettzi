import { APIGatewayProxyEventV2 } from 'aws-lambda';
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { badRequest, unauthorized } from '@pettzi/utils-dynamo/http';
import {
  buildPetOwnerPk,
  buildPetOwnerSk,
  buildPetOwnerGsi1Pk,
  PetId,
  OwnerId,
} from '@pettzi/domain-model';

export const PETTZI_TABLE_NAME = process.env.PETTZI_TABLE_NAME ?? '';

export const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const getOwnerId = (event: APIGatewayProxyEventV2): string => {
  const claims = (event.requestContext as any)?.authorizer?.jwt?.claims as
    | Record<string, any>
    | undefined;
  const ownerId =
    (claims?.email as string | undefined) ||
    (claims?.username as string | undefined) ||
    (claims?.['cognito:username'] as string | undefined) ||
    (claims?.sub as string | undefined);
  if (!ownerId) {
    throw unauthorized('Missing owner identity');
  }
  return ownerId;
};

export const parseJson = <T>(body: string | null | undefined): T => {
  if (!body) {
    throw badRequest('Request body is required');
  }
  try {
    return JSON.parse(body) as T;
  } catch {
    throw badRequest('Invalid JSON body');
  }
};

export const assertOwnership = async (
  petId: PetId,
  ownerId: OwnerId
): Promise<void> => {
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
    throw unauthorized('You are not an owner of this pet');
  }
};

export const listPetIdsForOwner = async (ownerId: OwnerId): Promise<PetId[]> => {
  const result = await docClient.send(
    new QueryCommand({
      TableName: PETTZI_TABLE_NAME,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: {
        ':pk': buildPetOwnerGsi1Pk(ownerId),
      },
    })
  );

  return (result.Items ?? [])
    .map((item) => item.petId as PetId | undefined)
    .filter((id): id is PetId => Boolean(id));
};

export const parseIsoDate = (value: string | undefined): Date | undefined => {
  if (!value) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw badRequest(`Invalid date: ${value}`);
  }
  return d;
};
