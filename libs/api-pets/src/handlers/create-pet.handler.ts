import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { created, badRequest, serverError } from '@pettzi/utils-dynamo/http';
import {
  Pet,
  PetOwner,
  OwnerRole,
  PetSpecies,
  toItemPet,
  toItemPetOwner,
} from '@pettzi/domain-model';
import { getOwnerId, parseJson, PETTZI_TABLE_NAME, isoNow } from '../utils';

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

interface CreatePetRequest {
  name: string;
  species: PetSpecies;
  breed?: string;
  birthDate?: string;
  notes?: string;
  color?: string;
  weightKg?: number;
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  let ownerId: string;
  try {
    ownerId = getOwnerId(event);
  } catch (err: any) {
    return err;
  }

  let input: CreatePetRequest;
  try {
    input = parseJson<CreatePetRequest>(event.body);
  } catch (err: any) {
    return err;
  }

  if (!input.name || !input.species) {
    return badRequest('name and species are required');
  }

  const petId = crypto.randomUUID();
  const now = new Date(isoNow());

  const pet: Pet = {
    petId,
    ownerId,
    name: input.name,
    species: input.species,
    breed: input.breed,
    birthDate: input.birthDate ? new Date(input.birthDate) : undefined,
    notes: input.notes,
    color: input.color,
    weightKg: input.weightKg,
    createdAt: now,
  };

  const petOwner: PetOwner = {
    petId,
    ownerId,
    role: OwnerRole.PRIMARY,
    linkedAt: now,
  };

  const petItem = toItemPet(pet);
  const linkItem = toItemPetOwner(petOwner);

  try {
    await docClient.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: PETTZI_TABLE_NAME,
              Item: petItem,
              ConditionExpression: 'attribute_not_exists(PK)',
            },
          },
          {
            Put: {
              TableName: PETTZI_TABLE_NAME,
              Item: linkItem,
              ConditionExpression: 'attribute_not_exists(PK)',
            },
          },
        ],
      })
    );

    return created(pet);
  } catch (error: any) {
    if (error.name === 'ConditionalCheckFailedException') {
      return serverError('Pet already exists');
    }
    console.error('Create pet error', error);
    return serverError('Failed to create pet');
  }
};
