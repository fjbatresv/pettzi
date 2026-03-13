import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { badRequest, ok, serverError } from '@pettzi/utils-dynamo/http';
import { assertOwnership, getOwnerId } from './common';
import { listOccurrencesForRoutine } from '../lib/routines.service';

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const petId = event.pathParameters?.petId;
  const routineId = event.pathParameters?.routineId;
  if (!petId || !routineId) {
    return badRequest('petId and routineId are required');
  }

  try {
    await assertOwnership(petId, getOwnerId(event));
    return ok({ occurrences: await listOccurrencesForRoutine(petId, routineId) });
  } catch (error: any) {
    if (error?.statusCode) {
      return error;
    }
    console.error('List routine occurrences error', error);
    return serverError('Failed to list routine occurrences');
  }
};
