import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { badRequest, ok, serverError, forbidden } from '@pettzi/utils-dynamo/http';
import {
  deletePendingInvite,
  getCallerOwnerId,
} from './common';
import { getInviteSecrets, parseInviteTokenWithSecrets } from './invite-secret';

interface RejectInvitePayload {
  token?: string;
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  let payload: RejectInvitePayload;
  try {
    payload = JSON.parse(event.body ?? '{}') as RejectInvitePayload;
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

    await deletePendingInvite(inviteeId, invite.petId, invite.inviterId);

    return ok({ message: 'Invitation rejected' });
  } catch (error: any) {
    return error;
  }
};
