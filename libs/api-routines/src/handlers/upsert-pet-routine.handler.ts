import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { badRequest, ok, serverError } from '@pettzi/utils-dynamo/http';
import { assertOwnership, getOwnerId, parseJson } from './common';
import {
  UpsertRoutineInput,
  upsertPetRoutine,
} from '../lib/routines.service';

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const petId = event.pathParameters?.petId;
  if (!petId) {
    return badRequest('petId is required');
  }

  let ownerId: string;
  let payload: UpsertRoutineInput;
  try {
    ownerId = getOwnerId(event);
    payload = parseJson<UpsertRoutineInput>(event.body);
    await assertOwnership(petId, ownerId);
  } catch (error: any) {
    return error;
  }

  try {
    return ok(await upsertPetRoutine(petId, ownerId, payload));
  } catch (error: any) {
    if (error?.statusCode) {
      return error;
    }
    console.error('Upsert routine error', error);
    return serverError('Failed to save routine');
  }
};
