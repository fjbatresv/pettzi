import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { badRequest, ok, serverError } from '@pettzi/utils-dynamo/http';
import { buildInvitePreview } from './pet-invite.utils';
import { getInviteSecrets, parseInviteTokenWithSecrets } from './invite-secret';

const PETTZI_DOCS_BUCKET_NAME = process.env.PETTZI_DOCS_BUCKET_NAME ?? '';

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const token = event.queryStringParameters?.token?.trim();
  if (!token) {
    return badRequest('token is required');
  }

  try {
    const { current, previous } = await getInviteSecrets();
    if (!current && !previous) {
      return serverError('Invite secret is not configured');
    }
    const payload = parseInviteTokenWithSecrets(token, [current, previous]);
    const preview = await buildInvitePreview(payload, PETTZI_DOCS_BUCKET_NAME);
    return ok(preview);
  } catch (err: any) {
    return err;
  }
};
