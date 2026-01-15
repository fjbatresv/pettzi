import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { badRequest, ok, serverError } from '@pettzi/utils-dynamo/http';
import {
  buildOwnerProfilePk,
  buildOwnerProfileSk,
} from '@pettzi/domain-model';
import { docClient, getEmail, getOwnerId, parseJson, PETTZI_TABLE_NAME } from './common';

interface UpdateProfilePayload {
  firstName?: string;
  lastName?: string;
  phone?: string;
  profilePhotoKey?: string;
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  let ownerId: string;
  try {
    ownerId = getOwnerId(event);
  } catch (err: any) {
    return err;
  }

  let payload: UpdateProfilePayload;
  try {
    payload = parseJson<UpdateProfilePayload>(event.body);
  } catch (err: any) {
    return err;
  }

  if (!payload || Object.keys(payload).length === 0) {
    return badRequest('No fields to update');
  }

  const updatedAt = new Date().toISOString();
  const createdAt = updatedAt;
  const email = getEmail(event);
  const firstName = payload.firstName?.trim();
  const lastName = payload.lastName?.trim();
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();

  const updateExpressions: string[] = [
    '#updatedAt = :updatedAt',
    '#createdAt = if_not_exists(#createdAt, :createdAt)',
    '#ownerId = if_not_exists(#ownerId, :ownerId)',
    '#userId = if_not_exists(#userId, :userId)',
  ];
  const expressionNames: Record<string, string> = {
    '#updatedAt': 'updatedAt',
    '#createdAt': 'createdAt',
    '#ownerId': 'ownerId',
    '#userId': 'userId',
  };
  const expressionValues: Record<string, any> = {
    ':updatedAt': updatedAt,
    ':createdAt': createdAt,
    ':ownerId': ownerId,
    ':userId': ownerId,
  };

  const setField = (name: string, value: any) => {
    expressionNames[`#${name}`] = name;
    expressionValues[`:${name}`] = value;
    updateExpressions.push(`#${name} = :${name}`);
  };

  if (payload.firstName !== undefined) setField('firstName', firstName ?? '');
  if (payload.lastName !== undefined) setField('lastName', lastName ?? '');
  if (payload.phone !== undefined) setField('phone', payload.phone?.trim() ?? '');
  if (payload.profilePhotoKey !== undefined)
    setField('profilePhotoKey', payload.profilePhotoKey?.trim() ?? '');
  if (payload.firstName !== undefined || payload.lastName !== undefined) {
    setField('fullName', fullName);
  }
  if (email) {
    setField('email', email);
  }

  try {
    const res = await docClient.send(
      new UpdateCommand({
        TableName: PETTZI_TABLE_NAME,
        Key: {
          PK: buildOwnerProfilePk(ownerId),
          SK: buildOwnerProfileSk(),
        },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: expressionNames,
        ExpressionAttributeValues: expressionValues,
        ReturnValues: 'ALL_NEW',
      })
    );

    return ok(res.Attributes);
  } catch (error) {
    console.error('Update user profile error', error);
    return serverError('Failed to update user profile');
  }
};
