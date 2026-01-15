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
} from '@pettzi/utils-dynamo/http';
import {
  buildPetOwnerPk,
  buildPetOwnerSk,
  buildPetPkKey,
  buildPetSkMetadata,
  fromItemPet,
} from '@pettzi/domain-model';
import { getOwnerId, PETTZI_TABLE_NAME } from '../utils';
import { computeHealthIndex, fetchVaccineStatus } from './health';

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

    const petRes = await docClient.send(
      new GetCommand({
        TableName: PETTZI_TABLE_NAME,
        Key: {
          PK: buildPetPkKey(petId),
          SK: buildPetSkMetadata(),
        },
      })
    );

    if (!petRes.Item) {
      return notFound('Pet not found');
    }

    let pet = fromItemPet(petRes.Item);
    if (pet.isArchived) {
      return notFound('Pet archived');
    }

    if (pet.healthIndex === undefined || pet.healthIndex === null) {
      const vaccineStatus = await fetchVaccineStatus(
        docClient,
        PETTZI_TABLE_NAME,
        pet.petId
      );
      pet = { ...pet, ...computeHealthIndex(pet, vaccineStatus) };
    }

    return ok(pet);
  } catch (error) {
    console.error('Get pet error', error);
    return serverError('Failed to get pet');
  }
};
