import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { unauthorized } from '@peto/utils-dynamo/http';

export const getOwnerId = (event: APIGatewayProxyEventV2): string => {
  const claims = (event.requestContext as unknown as {
    authorizer?: { jwt?: { claims?: Record<string, unknown> } };
  })?.authorizer?.jwt?.claims;
  const ownerId = typeof claims?.sub === 'string' ? claims.sub : undefined;
  if (!ownerId) {
    throw unauthorized('Missing owner identity');
  }
  return ownerId;
};
