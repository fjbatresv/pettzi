import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { ok, serverError } from '@pettzi/utils-dynamo/http';
import {
  buildOwnerProfilePk,
  buildOwnerProfileSk,
} from '@pettzi/domain-model';
import { docClient, getEmail, getOwnerId, PETTZI_TABLE_NAME } from './common';

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  let ownerId: string;
  try {
    ownerId = getOwnerId(event);
  } catch (err: any) {
    return err;
  }

  const email = getEmail(event);

  try {
    const res = await docClient.send(
      new GetCommand({
        TableName: PETTZI_TABLE_NAME,
        Key: {
          PK: buildOwnerProfilePk(ownerId),
          SK: buildOwnerProfileSk(),
        },
      })
    );

    const item = res.Item as Record<string, any> | undefined;
    return ok({
      ownerId,
      email,
      firstName: item?.firstName ?? '',
      lastName: item?.lastName ?? '',
      phone: item?.phone ?? '',
      profilePhotoKey: item?.profilePhotoKey ?? '',
      fullName: item?.fullName ?? '',
    });
  } catch (error) {
    console.error('Get user profile error', error);
    return serverError('Failed to get user profile');
  }
};
