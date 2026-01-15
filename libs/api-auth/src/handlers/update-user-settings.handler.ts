import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { badRequest, ok, serverError } from '@pettzi/utils-dynamo/http';
import { buildOwnerProfilePk, buildOwnerSettingsSk } from '@pettzi/domain-model';
import { docClient, getOwnerId, parseJson, PETTZI_TABLE_NAME } from './common';

interface SettingsPayload {
  theme?: 'light' | 'dark';
  weightUnit?: 'kg' | 'lb';
  distanceUnit?: 'm' | 'in';
  measurementUnits?: 'metric' | 'imperial';
  newsletter?: boolean;
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  let ownerId: string;
  try {
    ownerId = getOwnerId(event);
  } catch (err: any) {
    return err;
  }

  let payload: SettingsPayload;
  try {
    payload = parseJson<SettingsPayload>(event.body);
  } catch (err: any) {
    return err;
  }

  if (!payload || Object.keys(payload).length === 0) {
    return badRequest('No fields to update');
  }

  if (payload.theme && !['light', 'dark'].includes(payload.theme)) {
    return badRequest('Invalid theme');
  }
  if (payload.weightUnit && !['kg', 'lb'].includes(payload.weightUnit)) {
    return badRequest('Invalid weight unit');
  }
  if (payload.distanceUnit && !['m', 'in'].includes(payload.distanceUnit)) {
    return badRequest('Invalid distance unit');
  }
  if (payload.measurementUnits && !['metric', 'imperial'].includes(payload.measurementUnits)) {
    return badRequest('Invalid measurement units');
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

  const normalizedWeightUnit =
    payload.weightUnit ??
    (payload.measurementUnits === 'imperial'
      ? 'lb'
      : payload.measurementUnits === 'metric'
        ? 'kg'
        : undefined);
  const normalizedDistanceUnit =
    payload.distanceUnit ??
    (payload.measurementUnits === 'imperial'
      ? 'in'
      : payload.measurementUnits === 'metric'
        ? 'm'
        : undefined);

  if (payload.theme !== undefined) setField('theme', payload.theme);
  if (normalizedWeightUnit !== undefined) setField('weightUnit', normalizedWeightUnit);
  if (normalizedDistanceUnit !== undefined) setField('distanceUnit', normalizedDistanceUnit);
  if (payload.newsletter !== undefined) setField('newsletter', payload.newsletter);

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
    console.error('Update user settings error', error);
    return serverError('Failed to update user settings');
  }
};
