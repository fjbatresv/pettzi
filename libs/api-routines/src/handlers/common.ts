import { APIGatewayProxyEventV2 } from 'aws-lambda';
import {
  DynamoDBDocumentClient,
  GetCommand,
} from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { badRequest, unauthorized } from '@pettzi/utils-dynamo/http';
import {
  buildPetOwnerPk,
  buildPetOwnerSk,
  OwnerId,
  PetId,
} from '@pettzi/domain-model';

export const PETTZI_TABLE_NAME = process.env.PETTZI_TABLE_NAME ?? '';
export const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const getOwnerId = (event: APIGatewayProxyEventV2): string => {
  const claims = (event.requestContext as any)?.authorizer?.jwt?.claims as
    | Record<string, unknown>
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

export const parseOptionalJson = <T>(
  body: string | null | undefined
): T | undefined => {
  if (!body) {
    return undefined;
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
  const result = await docClient.send(
    new GetCommand({
      TableName: PETTZI_TABLE_NAME,
      Key: {
        PK: buildPetOwnerPk(petId),
        SK: buildPetOwnerSk(ownerId),
      },
    })
  );
  if (!result.Item) {
    throw unauthorized('You are not an owner of this pet');
  }
};
