import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import {
  ok,
  badRequest,
  serverError,
} from '@pettzi/utils-dynamo/http';
import {
  buildPetReminderPk,
  fromItemPetReminder,
} from '@pettzi/domain-model';
import {
  assertOwnership,
  docClient,
  getOwnerId,
  parseIsoDate,
  PETTZI_TABLE_NAME,
} from './common';

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const petId = event.pathParameters?.petId;
  if (!petId) {
    return badRequest('petId is required');
  }

  let ownerId: string;
  try {
    ownerId = getOwnerId(event);
  } catch (err: any) {
    return err;
  }

  const fromDate = event.queryStringParameters?.fromDate;
  const toDate = event.queryStringParameters?.toDate;

  let from: Date | undefined;
  let to: Date | undefined;
  try {
    from = parseIsoDate(fromDate);
    to = parseIsoDate(toDate);
  } catch (err: any) {
    return err;
  }

  try {
    await assertOwnership(petId, ownerId);

    const res = await docClient.send(
      new QueryCommand({
        TableName: PETTZI_TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': buildPetReminderPk(petId),
          ':sk': 'REMINDER#',
        },
      })
    );

    const reminders = (res.Items ?? [])
      .map(fromItemPetReminder)
      .map((reminder) => ({
        ...reminder,
        recurring: Boolean(reminder.metadata?.recurring || reminder.metadata?.periodicity),
      }))
      .filter((reminder) => {
        const due = reminder.dueDate.getTime();
        if (from && due < from.getTime()) return false;
        if (to && due > to.getTime()) return false;
        return true;
      });

    return ok({ reminders });
  } catch (error) {
    console.error('List pet reminders error', error);
    return serverError('Failed to list reminders');
  }
};
