import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { badRequest, conflict, ok, serverError, forbidden } from '@pettzi/utils-dynamo/http';
import { OwnerRole, PetOwner, toItemPetOwner } from '@pettzi/domain-model';
import {
  createLink,
  deletePendingInvite,
  ensureOwnerExists,
  getCallerOwnerId,
  linkExists,
} from './common';
import { buildInvitePreview } from './pet-invite.utils';
import { getInviteSecrets, parseInviteTokenWithSecrets } from './invite-secret';

interface AcceptInvitePayload {
  token?: string;
}

const PETTZI_DOCS_BUCKET_NAME = process.env.PETTZI_DOCS_BUCKET_NAME ?? '';

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  let payload: AcceptInvitePayload;
  try {
    payload = JSON.parse(event.body ?? '{}') as AcceptInvitePayload;
  } catch {
    return badRequest('Invalid JSON body');
  }

  const token = payload.token?.trim();
  if (!token) {
    return badRequest('token is required');
  }

  let callerOwnerId: string;
  try {
    callerOwnerId = getCallerOwnerId(event).toLowerCase();
  } catch (err: any) {
    return err;
  }

  try {
    const { current, previous } = await getInviteSecrets();
    if (!current && !previous) {
      return serverError('Invite secret is not configured');
    }
    const invite = parseInviteTokenWithSecrets(token, [current, previous]);
    const inviteeId = invite.inviteeId.toLowerCase();
    if (inviteeId !== callerOwnerId) {
      return forbidden('Invite does not belong to this account');
    }

    await ensureOwnerExists(callerOwnerId);

    const alreadyLinked = await linkExists(invite.petId, inviteeId);
    if (!alreadyLinked) {
      const newLink: PetOwner = {
        petId: invite.petId,
        ownerId: inviteeId,
        role: OwnerRole.SECONDARY,
        linkedAt: new Date(),
      };
      await createLink(toItemPetOwner(newLink));
    }

    const preview = await buildInvitePreview(invite, PETTZI_DOCS_BUCKET_NAME);
    try {
      await deletePendingInvite(inviteeId, invite.petId, invite.inviterId);
    } catch (err) {
      console.warn('Failed to delete pending invite after accept', err);
    }
    return ok({ ...preview, status: alreadyLinked ? 'already-linked' : 'accepted' });
  } catch (error: any) {
    if (error?.statusCode === 409) {
      return conflict('Owner already linked to this pet');
    }
    return error;
  }
};
