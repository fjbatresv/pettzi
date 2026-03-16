import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { badRequest, ok, serverError } from '@pettzi/utils-dynamo/http';
import { assertOwnership, getOwnerId } from './common';
import { listTodayForPet } from '../lib/routines.service';

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const petId = event.pathParameters?.petId;
  if (!petId) {
    return badRequest('petId is required');
  }

  try {
    await assertOwnership(petId, getOwnerId(event));
    return ok({ occurrences: await listTodayForPet(petId) });
  } catch (error: any) {
    if (error?.statusCode) {
      return error;
    }
    console.error('List routine today error', error);
    return serverError('Failed to list today routine');
  }
};
