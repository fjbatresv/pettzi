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
    const legacyUnits = item?.measurementUnits ?? 'metric';
    const weightUnit =
      item?.weightUnit ??
      (legacyUnits === 'imperial' ? 'lb' : 'kg');
    const distanceUnit =
      item?.distanceUnit ??
      (legacyUnits === 'imperial' ? 'in' : 'm');
    return ok({
      theme: item?.theme ?? 'light',
      weightUnit,
      distanceUnit,
      newsletter: item?.newsletter ?? true,
    });
  } catch (error) {
    console.error('Get user settings error', error);
    return serverError('Failed to get user settings');
  }
};
