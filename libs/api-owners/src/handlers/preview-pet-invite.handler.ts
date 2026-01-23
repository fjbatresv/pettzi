import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { badRequest, ok, serverError } from '@pettzi/utils-dynamo/http';
import { buildInvitePreview, parseInviteToken } from './pet-invite.utils';

const INVITE_SECRET = process.env.PET_SHARE_INVITE_SECRET ?? '';
const PETTZI_DOCS_BUCKET_NAME = process.env.PETTZI_DOCS_BUCKET_NAME ?? '';

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const token = event.queryStringParameters?.token?.trim();
  if (!token) {
    return badRequest('token is required');
  }
  if (!INVITE_SECRET) {
    return serverError('Invite secret is not configured');
  }

  try {
    const payload = parseInviteToken(token, INVITE_SECRET);
    const preview = await buildInvitePreview(payload, PETTZI_DOCS_BUCKET_NAME);
    return ok(preview);
  } catch (err: any) {
    return err;
  }
};
