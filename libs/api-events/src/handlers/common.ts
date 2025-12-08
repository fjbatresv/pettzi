import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { badRequest, unauthorized } from '@peto/utils-dynamo/http';
import {
  DynamoDBDocumentClient,
  GetCommand,
} from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  buildPetOwnerPk,
  buildPetOwnerSk,
  PetId,
  OwnerId,
} from '@peto/domain-model';

export const PETO_TABLE_NAME = process.env.PETO_TABLE_NAME ?? '';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const getOwnerId = (event: APIGatewayProxyEventV2): string => {
  const claims = (event.requestContext as any)?.authorizer?.jwt?.claims as
    | Record<string, any>
    | undefined;
  const ownerId = claims?.sub as string | undefined;
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
  const link = await ddb.send(
    new GetCommand({
      TableName: PETO_TABLE_NAME,
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

export const docClient = ddb;
