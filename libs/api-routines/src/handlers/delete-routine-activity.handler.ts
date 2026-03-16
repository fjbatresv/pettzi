import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { badRequest, ok, serverError } from '@pettzi/utils-dynamo/http';
import { assertOwnership, getOwnerId } from './common';
import { deleteRoutineActivityAndOccurrences } from '../lib/routines.service';

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const petId = event.pathParameters?.petId;
  const activityId = event.pathParameters?.activityId;
  if (!petId) {
    return badRequest('petId is required');
  }
  if (!activityId) {
    return badRequest('activityId is required');
  }

  try {
    await assertOwnership(petId, getOwnerId(event));
    await deleteRoutineActivityAndOccurrences(petId, activityId);
    return ok({ message: 'Routine activity deleted' });
  } catch (error: any) {
    if (error?.statusCode) {
      return error;
    }
    console.error('Delete routine activity error', error);
    return serverError('Failed to delete routine activity');
  }
};
