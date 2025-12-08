import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  ok,
  notFound,
  unauthorized,
  serverError,
} from '@peto/utils-dynamo/http';
import {
  buildPetOwnerPk,
  buildPetOwnerSk,
  buildPetPkKey,
  buildPetSkMetadata,
  fromItemPet,
} from '@peto/domain-model';
import { getOwnerId, PETO_TABLE_NAME } from '../utils';

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

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

  try {
    const link = await docClient.send(
      new GetCommand({
        TableName: PETO_TABLE_NAME,
        Key: {
          PK: buildPetOwnerPk(petId),
          SK: buildPetOwnerSk(ownerId),
        },
      })
    );

    if (!link.Item) {
      return unauthorized('You are not an owner of this pet');
    }

    const petRes = await docClient.send(
      new GetCommand({
        TableName: PETO_TABLE_NAME,
        Key: {
          PK: buildPetPkKey(petId),
          SK: buildPetSkMetadata(),
        },
      })
    );

    if (!petRes.Item) {
      return notFound('Pet not found');
    }

    const pet = fromItemPet(petRes.Item);
    if (pet.isArchived) {
      return notFound('Pet archived');
    }

    return ok(pet);
  } catch (error) {
    console.error('Get pet error', error);
    return serverError('Failed to get pet');
  }
};
