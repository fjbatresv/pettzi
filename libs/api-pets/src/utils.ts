import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { badRequest, unauthorized } from '@peto/utils-dynamo/http';

export const PETO_TABLE_NAME = process.env.PETO_TABLE_NAME ?? '';

export const parseJson = <T>(body: string | null | undefined) => {
  if (!body) {
    throw badRequest('Request body is required');
  }
  try {
    return JSON.parse(body) as T;
  } catch (err) {
    throw badRequest('Invalid JSON body');
  }
};

export const getOwnerId = (event: APIGatewayProxyEventV2): string => {
  const claims = (event.requestContext as any)?.authorizer?.jwt?.claims as
    | Record<string, any>
    | undefined;
  const ownerId = claims?.sub as string | undefined;
  if (!ownerId) {
    throw unauthorized('Missing owner identity');
  }
  return ownerId;
};

export const isoNow = () => new Date().toISOString();
