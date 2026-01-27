import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ok, serverError } from '@pettzi/utils-dynamo/http';
import {
  PETTZI_TABLE_NAME,
  buildPendingInvitePk,
  ddb,
  deletePendingInvite,
  getCallerOwnerId,
} from './common';
import { buildInvitePreview, InvitePreviewResponse } from './pet-invite.utils';
import { getInviteSecrets, parseInviteTokenWithSecrets } from './invite-secret';

const PETTZI_DOCS_BUCKET_NAME = process.env.PETTZI_DOCS_BUCKET_NAME ?? '';

interface PendingInviteItem {
  PK?: string;
  SK?: string;
  token?: string;
  petId?: string;
  inviterId?: string;
  inviteeId?: string;
  expiresAt?: number;
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  let callerOwnerId: string;
  try {
    callerOwnerId = getCallerOwnerId(event).toLowerCase();
  } catch (err: any) {
    return err;
  }

  try {
    if (!PETTZI_TABLE_NAME) {
      return serverError('PETTZI_TABLE_NAME is required');
    }

    const { current, previous } = await getInviteSecrets();
    if (!current && !previous) {
      return serverError('Invite secret is not configured');
    }

    const res = await ddb.send(
      new QueryCommand({
        TableName: PETTZI_TABLE_NAME,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: {
          ':pk': buildPendingInvitePk(callerOwnerId),
        },
      })
    );

    const items = (res.Items ?? []) as PendingInviteItem[];
    const invites: Array<{ token: string } & InvitePreviewResponse> = [];

    for (const item of items) {
      const token = item.token?.trim();
      const petId = item.petId ?? '';
      const inviterId = item.inviterId ?? '';
      if (!token || !petId || !inviterId) {
        continue;
      }
      if (item.expiresAt && item.expiresAt < Date.now()) {
        await deletePendingInvite(callerOwnerId, petId, inviterId);
        continue;
      }
      try {
        const payload = parseInviteTokenWithSecrets(token, [current, previous]);
        if (payload.inviteeId.toLowerCase() !== callerOwnerId) {
          continue;
        }
        const preview = await buildInvitePreview(payload, PETTZI_DOCS_BUCKET_NAME);
        invites.push({ token, ...preview });
      } catch (error: any) {
        if (petId && inviterId) {
          await deletePendingInvite(callerOwnerId, petId, inviterId);
        }
      }
    }

    return ok({ invites });
  } catch (error) {
    console.error('List pending invites error', error);
    return serverError('Failed to list pending invites');
  }
};
