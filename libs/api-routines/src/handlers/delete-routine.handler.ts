import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { badRequest, ok, serverError } from '@pettzi/utils-dynamo/http';
import { assertOwnership, getOwnerId } from './common';
import { deleteRoutineAndOccurrences, getRoutineOrThrow } from '../lib/routines.service';

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const petId = event.pathParameters?.petId;
  const routineId = event.pathParameters?.routineId;
  if (!petId || !routineId) {
    return badRequest('petId and routineId are required');
  }

  try {
    await assertOwnership(petId, getOwnerId(event));
    await getRoutineOrThrow(petId, routineId);
    await deleteRoutineAndOccurrences(petId, routineId);
    return ok({ message: 'Routine deleted' });
  } catch (error: any) {
    if (error?.statusCode) {
      return error;
    }
    console.error('Delete routine error', error);
    return serverError('Failed to delete routine');
  }
};
