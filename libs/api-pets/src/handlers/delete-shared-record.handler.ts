import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, DeleteCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { notFound, ok, unauthorized, serverError } from '@pettzi/utils-dynamo/http';
import {
  buildPetOwnerPk,
  buildPetOwnerSk,
  buildSharedRecordPk,
  buildSharedRecordSk,
  fromItemSharedRecord,
} from '@pettzi/domain-model';
import { getOwnerId, PETTZI_TABLE_NAME } from '../utils';

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const petId = event.pathParameters?.petId;
  const token = event.pathParameters?.token;
  if (!petId) {
    return notFound('petId is required');
  }
  if (!token) {
    return notFound('token is required');
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

    const recordRes = await docClient.send(
      new GetCommand({
        TableName: PETTZI_TABLE_NAME,
        Key: {
          PK: buildSharedRecordPk(token),
          SK: buildSharedRecordSk(petId),
        },
      })
    );

    if (!recordRes.Item) {
      return notFound('Shared record not found');
    }

    const record = fromItemSharedRecord(recordRes.Item);
    if (record.petId !== petId) {
      return notFound('Shared record not found');
    }

    await docClient.send(
      new DeleteCommand({
        TableName: PETTZI_TABLE_NAME,
        Key: {
          PK: buildSharedRecordPk(token),
          SK: buildSharedRecordSk(petId),
        },
      })
    );

    return ok({ message: 'Shared record deleted', token });
  } catch (error) {
    console.error('Delete shared record error', error);
    return serverError('Failed to delete shared record');
  }
};
