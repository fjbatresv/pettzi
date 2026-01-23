import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { DeleteCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { badRequest, notFound, ok, serverError } from '@pettzi/utils-dynamo/http';
import { buildPetReminderPk, buildPetReminderSk } from '@pettzi/domain-model';
import { assertOwnership, docClient, getOwnerId, PETTZI_TABLE_NAME } from './common';

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const petId = event.pathParameters?.petId;
  const reminderId = event.pathParameters?.reminderId;
  if (!petId || !reminderId) {
    return badRequest('petId and reminderId are required');
  }

  let ownerId: string;
  try {
    ownerId = getOwnerId(event);
  } catch (err: any) {
    return err;
  }

  try {
    await assertOwnership(petId, ownerId);

    const res = await docClient.send(
      new GetCommand({
        TableName: PETTZI_TABLE_NAME,
        Key: {
          PK: buildPetReminderPk(petId),
          SK: buildPetReminderSk(reminderId),
        },
      })
    );
    if (!res.Item) {
      return notFound('Reminder not found');
    }

    await docClient.send(
      new DeleteCommand({
        TableName: PETTZI_TABLE_NAME,
        Key: {
          PK: buildPetReminderPk(petId),
          SK: buildPetReminderSk(reminderId),
        },
      })
    );

    return ok({ message: 'Reminder deleted' });
  } catch (error) {
    console.error('Delete reminder error', error);
    return serverError('Failed to delete reminder');
  }
};
