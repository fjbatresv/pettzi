import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { badRequest, ok, serverError } from '@pettzi/utils-dynamo/http';
import { RoutineStatus } from '@pettzi/domain-model';
import { assertOwnership, getOwnerId, parseJson } from './common';
import {
  getRoutineOrThrow,
  saveRoutine,
  syncPetRoutineOccurrences,
  UpdateRoutineInput,
  validateUpdateRoutine,
} from '../lib/routines.service';

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const petId = event.pathParameters?.petId;
  const routineId = event.pathParameters?.routineId;
  if (!petId || !routineId) {
    return badRequest('petId and routineId are required');
  }

  try {
    await assertOwnership(petId, getOwnerId(event));
    const current = await getRoutineOrThrow(petId, routineId);
    if (current.status === RoutineStatus.ARCHIVED) {
      return badRequest('Archived routines cannot be updated');
    }
    const payload = validateUpdateRoutine(parseJson<UpdateRoutineInput>(event.body));
    const updated = {
      ...current,
      ...payload,
      updatedAt: new Date(),
    };
    await saveRoutine(updated);
    await syncPetRoutineOccurrences(petId);
    return ok(updated);
  } catch (error: any) {
    if (error?.statusCode) {
      return error;
    }
    console.error('Update routine error', error);
    return serverError('Failed to update routine');
  }
};
