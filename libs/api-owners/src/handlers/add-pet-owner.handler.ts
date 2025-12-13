import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { created, badRequest, conflict, forbidden, unauthorized, serverError } from '@pettzi/utils-dynamo/http';
import {
  OwnerRole,
  PetOwner,
  toItemPetOwner,
} from '@pettzi/domain-model';
import {
  getCallerOwnerId,
  assertOwnerOfPet,
  linkExists,
  createLink,
  parseJson,
  ensureOwnerExists,
} from './common';

interface AddOwnerRequest {
  ownerId?: string;
  role?: OwnerRole;
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const petId = event.pathParameters?.petId;
  if (!petId) {
    return badRequest('petId is required');
  }

  let callerOwnerId: string;
  try {
    callerOwnerId = getCallerOwnerId(event);
  } catch (err: any) {
    return err;
  }

  let payload: AddOwnerRequest;
  try {
    payload = parseJson<AddOwnerRequest>(event.body);
  } catch (err: any) {
    return err;
  }

  if (!payload.ownerId) {
    return badRequest('ownerId is required');
  }
  if (payload.ownerId === callerOwnerId) {
    return badRequest('Cannot add yourself as co-owner');
  }

  try {
    await assertOwnerOfPet(petId, callerOwnerId, OwnerRole.PRIMARY);

    await ensureOwnerExists(payload.ownerId);

    const exists = await linkExists(petId, payload.ownerId);
    if (exists) {
      return conflict('Owner already linked to this pet');
    }

    const newLink: PetOwner = {
      petId,
      ownerId: payload.ownerId,
      role: payload.role ?? OwnerRole.SECONDARY,
      linkedAt: new Date(),
    };

    await createLink(toItemPetOwner(newLink));

    return created({
      petId,
      ownerId: newLink.ownerId,
      role: newLink.role,
    });
  } catch (error: any) {
    if (error?.statusCode === 401) return unauthorized(error?.body ?? 'Unauthorized');
    if (error?.statusCode === 403) return forbidden(error?.body ?? 'Forbidden');
    if (error?.statusCode === 409) return conflict('Owner already linked to this pet');
    console.error('Add pet owner error', error);
    return serverError('Failed to add owner');
  }
};
