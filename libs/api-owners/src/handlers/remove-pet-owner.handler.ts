import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { ok, badRequest, forbidden, notFound, serverError } from '@pettzi/utils-dynamo/http';
import {
  OwnerRole,
  buildPetOwnerPk,
  buildPetOwnerSk,
} from '@pettzi/domain-model';
import {
  getCallerOwnerId,
  assertOwnerOfPet,
  deleteLink,
  PETTZI_TABLE_NAME,
  ddb,
} from './common';

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const petId = event.pathParameters?.petId;
  const targetOwnerId = event.pathParameters?.ownerId;
  if (!petId || !targetOwnerId) {
    return badRequest('petId and ownerId are required');
  }

  let callerOwnerId: string;
  try {
    callerOwnerId = getCallerOwnerId(event);
  } catch (err: any) {
    return err;
  }

  if (targetOwnerId === callerOwnerId) {
    return badRequest('Cannot remove yourself via this endpoint');
  }

  try {
    await assertOwnerOfPet(petId, callerOwnerId, OwnerRole.PRIMARY);

    const target = await ddb.send(
      new GetCommand({
        TableName: PETTZI_TABLE_NAME,
        Key: {
          PK: buildPetOwnerPk(petId),
          SK: buildPetOwnerSk(targetOwnerId),
        },
      })
    );

    if (!target.Item) {
      return notFound('Owner link not found');
    }
    if (target.Item.role === OwnerRole.PRIMARY) {
      return forbidden('Cannot remove primary owner');
    }

    await deleteLink(petId, targetOwnerId);
    return ok({ message: 'Owner removed' });
  } catch (error: any) {
    if (error?.statusCode === 401 || error?.statusCode === 403) {
      return forbidden('Operation allowed only for primary owner');
    }
    console.error('Remove pet owner error', error);
    return serverError('Failed to remove owner');
  }
};
