import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { badRequest, ok, serverError } from '@pettzi/utils-dynamo/http';
import { assertOwnership, getOwnerId, parseJson } from './common';
import {
  UpdateRoutineActivityInput,
  updateRoutineActivity,
} from '../lib/routines.service';

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const petId = event.pathParameters?.petId;
  const activityId = event.pathParameters?.activityId;
  if (!petId) {
    return badRequest('petId is required');
  }
  if (!activityId) {
    return badRequest('activityId is required');
  }

  let payload: UpdateRoutineActivityInput;
  try {
    await assertOwnership(petId, getOwnerId(event));
    payload = parseJson<UpdateRoutineActivityInput>(event.body);
  } catch (error: any) {
    return error;
  }

  try {
    return ok(await updateRoutineActivity(petId, activityId, payload));
  } catch (error: any) {
    if (error?.statusCode) {
      return error;
    }
    console.error('Update routine activity error', error);
    return serverError('Failed to update routine activity');
  }
};
