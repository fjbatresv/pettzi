import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { unauthorized } from '@pettzi/utils-dynamo/http';

export type CatalogLocale = 'es' | 'en';

export const getOwnerId = (event: APIGatewayProxyEventV2): string => {
  const claims = (event.requestContext as unknown as {
    authorizer?: { jwt?: { claims?: Record<string, unknown> } };
  })?.authorizer?.jwt?.claims;
  const ownerId =
    (typeof claims?.email === 'string' && claims.email) ||
    (typeof claims?.username === 'string' && claims.username) ||
    (typeof claims?.['cognito:username'] === 'string' && claims['cognito:username']) ||
    (typeof claims?.sub === 'string' && claims.sub) ||
    undefined;
  if (!ownerId) {
    throw unauthorized('Missing owner identity');
  }
  return ownerId;
};

export const getLocale = (event: APIGatewayProxyEventV2): CatalogLocale => {
  const queryLocale = event.queryStringParameters?.locale;
  if (queryLocale === 'es' || queryLocale === 'en') {
    return queryLocale;
  }

  const headerLocale =
    event.headers?.['accept-language'] ?? event.headers?.['Accept-Language'];
  if (typeof headerLocale === 'string' && headerLocale.toLowerCase().startsWith('es')) {
    return 'es';
  }

  return 'en';
};
