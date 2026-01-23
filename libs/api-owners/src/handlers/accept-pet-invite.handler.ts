import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { badRequest, conflict, ok, serverError, forbidden } from '@pettzi/utils-dynamo/http';
import { OwnerRole, PetOwner, toItemPetOwner } from '@pettzi/domain-model';
import {
  createLink,
  ensureOwnerExists,
  getCallerOwnerId,
  linkExists,
} from './common';
import { buildInvitePreview, parseInviteToken } from './pet-invite.utils';

interface AcceptInvitePayload {
  token?: string;
}

const INVITE_SECRET = process.env.PET_SHARE_INVITE_SECRET ?? '';
const PETTZI_DOCS_BUCKET_NAME = process.env.PETTZI_DOCS_BUCKET_NAME ?? '';

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  if (!INVITE_SECRET) {
    return serverError('Invite secret is not configured');
  }

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
    const invite = parseInviteToken(token, INVITE_SECRET);
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
    return ok({ ...preview, status: alreadyLinked ? 'already-linked' : 'accepted' });
  } catch (error: any) {
    if (error?.statusCode === 409) {
      return conflict('Owner already linked to this pet');
    }
    return error;
  }
};
