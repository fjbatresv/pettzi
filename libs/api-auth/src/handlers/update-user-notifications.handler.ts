import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { badRequest, ok, serverError } from '@pettzi/utils-dynamo/http';
import { buildOwnerProfilePk, buildOwnerSettingsSk } from '@pettzi/domain-model';
import { docClient, getOwnerId, parseJson, PETTZI_TABLE_NAME } from './common';

interface NotificationsPayload {
  vetVisits?: boolean;
  medicationReminders?: boolean;
  groomingAppointments?: boolean;
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  let ownerId: string;
  try {
    ownerId = getOwnerId(event);
  } catch (err: any) {
    return err;
  }

  let payload: NotificationsPayload;
  try {
    payload = parseJson<NotificationsPayload>(event.body);
  } catch (err: any) {
    return err;
  }

  if (!payload || Object.keys(payload).length === 0) {
    return badRequest('No fields to update');
  }

  const updatedAt = new Date().toISOString();
  const createdAt = updatedAt;

  const updateExpressions: string[] = [
    '#updatedAt = :updatedAt',
    '#createdAt = if_not_exists(#createdAt, :createdAt)',
  ];
  const expressionNames: Record<string, string> = {
    '#updatedAt': 'updatedAt',
    '#createdAt': 'createdAt',
  };
  const expressionValues: Record<string, any> = {
    ':updatedAt': updatedAt,
    ':createdAt': createdAt,
  };

  const setField = (name: string, value: any) => {
    expressionNames[`#${name}`] = name;
    expressionValues[`:${name}`] = value;
    updateExpressions.push(`#${name} = :${name}`);
  };

  if (payload.vetVisits !== undefined)
    setField('notifyVetVisits', payload.vetVisits);
  if (payload.medicationReminders !== undefined)
    setField('notifyMedicationReminders', payload.medicationReminders);
  if (payload.groomingAppointments !== undefined)
    setField('notifyGroomingAppointments', payload.groomingAppointments);

  try {
    const res = await docClient.send(
      new UpdateCommand({
        TableName: PETTZI_TABLE_NAME,
        Key: {
          PK: buildOwnerProfilePk(ownerId),
          SK: buildOwnerSettingsSk(),
        },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: expressionNames,
        ExpressionAttributeValues: expressionValues,
        ReturnValues: 'ALL_NEW',
      })
    );

    return ok(res.Attributes);
  } catch (error) {
    console.error('Update user notifications error', error);
    return serverError('Failed to update user notifications');
  }
};
