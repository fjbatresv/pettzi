import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { badRequest, ok, serverError } from '@pettzi/utils-dynamo/http';
import { RoutineOccurrenceStatus } from '@pettzi/domain-model';
import { assertOwnership, getOwnerId, parseOptionalJson } from './common';
import { updateOccurrenceStatus } from '../lib/routines.service';

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const petId = event.pathParameters?.petId;
  const occurrenceId = event.pathParameters?.occurrenceId;
  if (!petId || !occurrenceId) {
    return badRequest('petId and occurrenceId are required');
  }

  try {
    const ownerId = getOwnerId(event);
    await assertOwnership(petId, ownerId);
    const payload = parseOptionalJson<{ notes?: string }>(event.body);
    return ok(
      await updateOccurrenceStatus(
        petId,
        occurrenceId,
        RoutineOccurrenceStatus.SKIPPED,
        ownerId,
        payload?.notes
      )
    );
  } catch (error: any) {
    if (error?.statusCode) {
      return error;
    }
    console.error('Skip routine occurrence error', error);
    return serverError('Failed to update occurrence');
  }
};
