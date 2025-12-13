import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  ok,
  unauthorized,
  notFound,
  badRequest,
  serverError,
} from '@pettzi/utils-dynamo/http';
import {
  buildPetOwnerPk,
  buildPetOwnerSk,
  buildPetPkKey,
  buildPetSkMetadata,
  fromItemPet,
  OwnerRole,
} from '@pettzi/domain-model';
import { getOwnerId, PETTZI_TABLE_NAME, isoNow } from '../utils';

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
    if (link.Item.role !== OwnerRole.PRIMARY) {
      return unauthorized('Only primary owner can archive this pet');
    }

    const updateRes = await docClient.send(
      new UpdateCommand({
        TableName: PETTZI_TABLE_NAME,
        Key: {
          PK: buildPetPkKey(petId),
          SK: buildPetSkMetadata(),
        },
        UpdateExpression:
          'SET isArchived = :true, archivedAt = :archivedAt, updatedAt = :updatedAt',
        ConditionExpression:
          'attribute_not_exists(isArchived) OR isArchived = :false',
        ExpressionAttributeValues: {
          ':true': true,
          ':false': false,
          ':archivedAt': isoNow(),
          ':updatedAt': isoNow(),
        },
        ReturnValues: 'ALL_NEW',
      })
    );

    const archivedPet = updateRes.Attributes
      ? fromItemPet(updateRes.Attributes)
      : undefined;

    if (!archivedPet) {
      return serverError('Failed to archive pet');
    }

    return ok({ message: 'Pet archived', pet: archivedPet });
  } catch (error: any) {
    if (error.name === 'ConditionalCheckFailedException') {
      return badRequest('Pet is already archived');
    }
    console.error('Archive pet error', error);
    return serverError('Failed to archive pet');
  }
};
