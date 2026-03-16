import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { badRequest, created, serverError } from '@pettzi/utils-dynamo/http';
import { assertOwnership, getOwnerId, parseJson } from './common';
import {
  CreateRoutineActivityInput,
  createRoutineActivity,
} from '../lib/routines.service';

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const petId = event.pathParameters?.petId;
  if (!petId) {
    return badRequest('petId is required');
  }

  let ownerId: string;
  let payload: CreateRoutineActivityInput;
  try {
    ownerId = getOwnerId(event);
    payload = parseJson<CreateRoutineActivityInput>(event.body);
    await assertOwnership(petId, ownerId);
  } catch (error: any) {
    return error;
  }

  try {
    return created(await createRoutineActivity(petId, ownerId, payload));
  } catch (error: any) {
    if (error?.statusCode) {
      return error;
    }
    console.error('Create routine activity error', error);
    return serverError('Failed to create routine activity');
  }
};
