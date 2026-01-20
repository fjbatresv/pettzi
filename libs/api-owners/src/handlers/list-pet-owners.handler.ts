import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { ok, badRequest, forbidden, serverError } from '@pettzi/utils-dynamo/http';
import {
  getCallerOwnerId,
  assertOwnerOfPet,
  ensureOwnerExists,
  listOwnersForPet,
} from './common';

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const petId = event.pathParameters?.petId;
  if (!petId) {
    return badRequest('petId is required');
  }

  let ownerId: string;
  try {
    ownerId = getCallerOwnerId(event);
  } catch (err: any) {
    return err;
  }

  try {
    // Any owner (primary or secondary) can list
    await assertOwnerOfPet(petId, ownerId);
    const owners = await listOwnersForPet(petId);
    const enriched = await Promise.all(
      owners.map(async (owner) => {
        try {
          const profile = await ensureOwnerExists(owner.ownerId);
          return {
            ...owner,
            profile: {
              fullName: profile.fullName,
              email: profile.email,
              profilePhotoKey: profile.profilePhotoKey,
              locale: profile.locale,
            },
          };
        } catch {
          return owner;
        }
      })
    );
    return ok({ owners: enriched });
  } catch (err: any) {
    if (err?.statusCode === 401 || err?.statusCode === 403) {
      return forbidden('You are not an owner of this pet');
    }
    console.error('List pet owners error', err);
    return serverError('Failed to list owners');
  }
};
