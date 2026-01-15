import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  ok,
  badRequest,
  unauthorized,
  notFound,
  serverError,
} from '@pettzi/utils-dynamo/http';
import {
  buildPetOwnerPk,
  buildPetOwnerSk,
  buildPetPkKey,
  buildPetSkMetadata,
  fromItemPet,
} from '@pettzi/domain-model';
import { getOwnerId, parseJson, PETTZI_TABLE_NAME, isoNow } from '../utils';

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

interface UpdatePetRequest {
  name?: string;
  notes?: string;
  color?: string;
  weightKg?: number;
  species?: string;
  breed?: string;
  birthDate?: string;
  photoKey?: string;
  photoThumbnailKey?: string;
  lastGroomingDate?: string;
  lastVetVisitDate?: string;
  healthIndex?: number;
}

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

  let payload: UpdatePetRequest;
  try {
    payload = parseJson<UpdatePetRequest>(event.body);
  } catch (err: any) {
    return err;
  }

  if (!payload || Object.keys(payload).length === 0) {
    return badRequest('No fields to update');
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

    const updateExpressions: string[] = [];
    const expressionValues: Record<string, any> = {
      ':updatedAt': isoNow(),
      ':false': false,
    };
    const expressionNames: Record<string, string> = {};

    const setField = (attr: string, value: any) => {
      const key = `:${attr}`;
      expressionNames[`#${attr}`] = attr;
      expressionValues[key] = value;
      updateExpressions.push(`#${attr} = ${key}`);
    };

    if (payload.name !== undefined) setField('name', payload.name);
    if (payload.notes !== undefined) setField('notes', payload.notes);
    if (payload.color !== undefined) setField('color', payload.color);
    if (payload.weightKg !== undefined) setField('weightKg', payload.weightKg);
    if (payload.species !== undefined) setField('species', payload.species);
    if (payload.breed !== undefined) setField('breed', payload.breed);
    if (payload.birthDate !== undefined)
      setField('birthDate', payload.birthDate);
    if (payload.photoKey !== undefined) setField('photoKey', payload.photoKey);
    if (payload.photoThumbnailKey !== undefined)
      setField('photoThumbnailKey', payload.photoThumbnailKey);
    if (payload.lastGroomingDate !== undefined)
      setField('lastGroomingDate', payload.lastGroomingDate);
    if (payload.lastVetVisitDate !== undefined)
      setField('lastVetVisitDate', payload.lastVetVisitDate);
    if (payload.healthIndex !== undefined)
      setField('healthIndex', payload.healthIndex);

    setField('updatedAt', expressionValues[':updatedAt']);

    const res = await docClient.send(
      new UpdateCommand({
        TableName: PETTZI_TABLE_NAME,
        Key: {
          PK: buildPetPkKey(petId),
          SK: buildPetSkMetadata(),
        },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: expressionNames,
        ExpressionAttributeValues: expressionValues,
        ConditionExpression:
          'attribute_not_exists(isArchived) OR isArchived = :false',
        ReturnValues: 'ALL_NEW',
      })
    );

    const updated = res.Attributes ? fromItemPet(res.Attributes) : undefined;
    if (!updated) {
      return serverError('Failed to update pet');
    }

    return ok(updated);
  } catch (error: any) {
    if (error.name === 'ConditionalCheckFailedException') {
      return badRequest('Pet is archived and cannot be updated');
    }
    console.error('Update pet error', error);
    return serverError('Failed to update pet');
  }
};
