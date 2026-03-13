import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { badRequest, ok, serverError } from '@pettzi/utils-dynamo/http';
import { assertOwnership, getOwnerId } from './common';
import { listUpcomingForPet } from '../lib/routines.service';

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const petId = event.pathParameters?.petId;
  if (!petId) {
    return badRequest('petId is required');
  }

  try {
    await assertOwnership(petId, getOwnerId(event));
    return ok({ occurrences: await listUpcomingForPet(petId) });
  } catch (error: any) {
    if (error?.statusCode) {
      return error;
    }
    console.error('List upcoming routines error', error);
    return serverError('Failed to list routine occurrences');
  }
};
