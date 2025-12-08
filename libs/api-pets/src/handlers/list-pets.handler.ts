import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  BatchGetCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { ok, unauthorized, serverError } from '@peto/utils-dynamo/http';
import {
  buildPetPkKey,
  buildPetSkMetadata,
  buildPetOwnerGsi1Pk,
  fromItemPet,
} from '@peto/domain-model';
import { getOwnerId, PETO_TABLE_NAME } from '../utils';

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const GSI1 = 'GSI1';

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  let ownerId: string;
  try {
    ownerId = getOwnerId(event);
  } catch (err: any) {
    return err;
  }

  try {
    const links = await docClient.send(
      new QueryCommand({
        TableName: PETO_TABLE_NAME,
        IndexName: GSI1,
        KeyConditionExpression: 'GSI1PK = :pk',
        ExpressionAttributeValues: {
          ':pk': buildPetOwnerGsi1Pk(ownerId),
        },
      })
    );

    const petIds = Array.from(
      new Set((links.Items ?? []).map((item) => item.petId as string))
    );

    if (petIds.length === 0) {
      return ok({ pets: [] });
    }

    const keys = petIds.map((petId) => ({
      PK: buildPetPkKey(petId),
      SK: buildPetSkMetadata(),
    }));

    const petsRes = await docClient.send(
      new BatchGetCommand({
        RequestItems: {
          [PETO_TABLE_NAME]: {
            Keys: keys,
          },
        },
      })
    );

    const petsItems = petsRes.Responses?.[PETO_TABLE_NAME] ?? [];
    const pets = petsItems
      .map((item) => fromItemPet(item))
      .filter((p) => !p.isArchived);

    return ok({ pets });
  } catch (error: any) {
    if (error.name === 'ValidationException') {
      return unauthorized('Invalid owner');
    }
    console.error('List pets error', error);
    return serverError('Failed to list pets');
  }
};
