import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { badRequest, ok, serverError } from '@pettzi/utils-dynamo/http';
import { assertOwnership, getOwnerId } from './common';
import { listRoutinesForPet, syncPetRoutineOccurrences } from '../lib/routines.service';

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const petId = event.pathParameters?.petId;
  if (!petId) {
    return badRequest('petId is required');
  }

  try {
    await assertOwnership(petId, getOwnerId(event));
    await syncPetRoutineOccurrences(petId);
    return ok({ routines: await listRoutinesForPet(petId) });
  } catch (error: any) {
    if (error?.statusCode) {
      return error;
    }
    console.error('List routines error', error);
    return serverError('Failed to list routines');
  }
};
