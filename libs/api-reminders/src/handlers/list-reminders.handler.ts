import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ok, serverError } from '@pettzi/utils-dynamo/http';
import {
  buildPetReminderPk,
  fromItemPetReminder,
} from '@pettzi/domain-model';
import {
  docClient,
  getOwnerId,
  listPetIdsForOwner,
  parseIsoDate,
  PETTZI_TABLE_NAME,
} from './common';

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
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
    const petIds = await listPetIdsForOwner(ownerId);
    if (petIds.length === 0) {
      return ok({ reminders: [] });
    }

    const reminders = [];
    for (const petId of petIds) {
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

      const items = (res.Items ?? []).map(fromItemPetReminder);
      for (const reminder of items) {
        const due = reminder.dueDate.getTime();
        if (from && due < from.getTime()) continue;
        if (to && due > to.getTime()) continue;
        reminders.push(reminder);
      }
    }

    return ok({ reminders });
  } catch (error) {
    console.error('List reminders error', error);
    return serverError('Failed to list reminders');
  }
};
