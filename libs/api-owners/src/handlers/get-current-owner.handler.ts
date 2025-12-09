import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { ok, notFound, serverError } from '@peto/utils-dynamo/http';
import {
  buildOwnerProfilePk,
  buildOwnerProfileSk,
  fromItemOwnerProfile,
} from '@peto/domain-model';
import { ddb, getCallerOwnerId, PETO_TABLE_NAME } from './common';

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  let ownerId: string;
  try {
    ownerId = getCallerOwnerId(event);
  } catch (err: any) {
    return err;
  }

  try {
    const res = await ddb.send(
      new GetCommand({
        TableName: PETO_TABLE_NAME,
        Key: {
          PK: buildOwnerProfilePk(ownerId),
          SK: buildOwnerProfileSk(),
        },
      })
    );

    if (!res.Item) {
      return notFound('Owner not found');
    }

    return ok(fromItemOwnerProfile(res.Item));
  } catch (error) {
    console.error('Get current owner error', error);
    return serverError('Failed to get owner');
  }
};
