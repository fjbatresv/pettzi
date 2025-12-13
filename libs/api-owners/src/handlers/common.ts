import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  PutCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  badRequest,
  unauthorized,
  forbidden,
  notFound,
} from '@pettzi/utils-dynamo/http';
import {
  buildPetOwnerPk,
  buildPetOwnerSk,
  buildOwnerProfilePk,
  buildOwnerProfileSk,
  OwnerId,
  PetId,
  PetOwner,
  OwnerRole,
  fromItemOwnerProfile,
} from '@pettzi/domain-model';

export const PETTZI_TABLE_NAME = process.env.PETTZI_TABLE_NAME ?? '';

export const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const getCallerOwnerId = (event: APIGatewayProxyEventV2): string => {
  const claims = (event.requestContext as any)?.authorizer?.jwt?.claims as
    | Record<string, any>
    | undefined;
  const ownerId = claims?.sub as string | undefined;
  if (!ownerId) {
    throw unauthorized('Missing owner identity');
  }
  return ownerId;
};

export const ensureOwnerExists = async (ownerId: OwnerId) => {
  const res = await ddb.send(
    new GetCommand({
      TableName: PETTZI_TABLE_NAME,
      Key: {
        PK: buildOwnerProfilePk(ownerId),
        SK: buildOwnerProfileSk(),
      },
    })
  );
  if (!res.Item) {
    throw notFound('Owner not found');
  }
  return fromItemOwnerProfile(res.Item);
};

export const assertOwnerOfPet = async (
  petId: PetId,
  ownerId: OwnerId,
  requiredRole?: OwnerRole,
) => {
  const res = await ddb.send(
    new GetCommand({
      TableName: PETTZI_TABLE_NAME,
      Key: {
        PK: buildPetOwnerPk(petId),
        SK: buildPetOwnerSk(ownerId),
      },
    })
  );
  if (!res.Item) {
    throw forbidden('You are not an owner of this pet');
  }
  if (requiredRole && res.Item.role !== requiredRole) {
    throw forbidden('Operation allowed only for primary owner');
  }
  return res.Item as PetOwner;
};

export const listOwnersForPet = async (petId: PetId): Promise<PetOwner[]> => {
  const res = await ddb.send(
    new QueryCommand({
      TableName: PETTZI_TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': buildPetOwnerPk(petId),
        ':sk': 'OWNER#',
      },
    })
  );
  return (res.Items ?? []) as PetOwner[];
};

export const linkExists = async (petId: PetId, ownerId: OwnerId) => {
  const res = await ddb.send(
    new GetCommand({
      TableName: PETTZI_TABLE_NAME,
      Key: {
        PK: buildPetOwnerPk(petId),
        SK: buildPetOwnerSk(ownerId),
      },
    })
  );
  return !!res.Item;
};

export const createLink = async (link: Record<string, any>) =>
  ddb.send(
    new PutCommand({
      TableName: PETTZI_TABLE_NAME,
      Item: link,
      ConditionExpression: 'attribute_not_exists(PK)',
    })
  );

export const deleteLink = async (petId: PetId, ownerId: OwnerId) =>
  ddb.send(
    new DeleteCommand({
      TableName: PETTZI_TABLE_NAME,
      Key: {
        PK: buildPetOwnerPk(petId),
        SK: buildPetOwnerSk(ownerId),
      },
    })
  );

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
