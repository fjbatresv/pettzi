import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { badRequest, created, serverError } from '@pettzi/utils-dynamo/http';
import { RoutineStatus } from '@pettzi/domain-model';
import {
  assertOwnership,
  getOwnerId,
  parseJson,
} from './common';
import {
  CreateRoutineInput,
  saveRoutine,
  syncPetRoutineOccurrences,
  validateCreateRoutine,
} from '../lib/routines.service';

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const petId = event.pathParameters?.petId;
  if (!petId) {
    return badRequest('petId is required');
  }

  let ownerId: string;
  let payload: CreateRoutineInput;
  try {
    ownerId = getOwnerId(event);
    payload = validateCreateRoutine(parseJson<CreateRoutineInput>(event.body));
    await assertOwnership(petId, ownerId);
  } catch (error: any) {
    return error;
  }

  const now = new Date();
  const routine = {
    routineId: crypto.randomUUID(),
    petId,
    ownerUserId: ownerId,
    title: payload.title,
    type: payload.type,
    notes: payload.notes,
    status: RoutineStatus.ACTIVE,
    timezone: payload.timezone,
    schedule: payload.schedule,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await saveRoutine(routine);
    await syncPetRoutineOccurrences(petId);
    return created(routine);
  } catch (error) {
    console.error('Create routine error', error);
    return serverError('Failed to create routine');
  }
};
