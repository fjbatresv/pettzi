import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { ok, serverError } from '@pettzi/utils-dynamo/http';
import { buildOwnerProfilePk, buildOwnerSettingsSk } from '@pettzi/domain-model';
import { docClient, getOwnerId, PETTZI_TABLE_NAME } from './common';

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  let ownerId: string;
  try {
    ownerId = getOwnerId(event);
  } catch (err: any) {
    return err;
  }

  try {
    const res = await docClient.send(
      new GetCommand({
        TableName: PETTZI_TABLE_NAME,
        Key: {
          PK: buildOwnerProfilePk(ownerId),
          SK: buildOwnerSettingsSk(),
        },
      })
    );

    const item = res.Item as Record<string, any> | undefined;
    return ok({
      vetVisits: item?.notifyVetVisits ?? true,
      medicationReminders: item?.notifyMedicationReminders ?? true,
      groomingAppointments: item?.notifyGroomingAppointments ?? true,
    });
  } catch (error) {
    console.error('Get user notifications error', error);
    return serverError('Failed to get user notifications');
  }
};
