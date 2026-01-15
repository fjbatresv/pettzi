import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { badRequest, unauthorized } from '@pettzi/utils-dynamo/http';

export const PETTZI_TABLE_NAME = process.env.PETTZI_TABLE_NAME ?? '';

export const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const getClaims = (event: APIGatewayProxyEventV2) => {
  const ctx = event.requestContext as any;
  return (ctx?.authorizer?.jwt?.claims ?? {}) as Record<string, string>;
};

export const getOwnerId = (event: APIGatewayProxyEventV2): string => {
  const claims = getClaims(event);
  const ownerId = claims?.sub;
  if (!ownerId) {
    throw unauthorized('Missing owner identity');
  }
  return ownerId;
};

export const getEmail = (event: APIGatewayProxyEventV2): string | undefined => {
  const claims = getClaims(event);
  return claims?.email;
};

export const parseJson = <T>(body: string | null | undefined): T => {
  if (!body) {
    throw badRequest('Request body is required');
  }
  try {
    return JSON.parse(body) as T;
  } catch {
    throw badRequest('Invalid JSON body');
  }
};

export const getAccessToken = (event: APIGatewayProxyEventV2): string | null => {
  const header = event.headers?.authorization ?? event.headers?.Authorization;
  if (!header) {
    return null;
  }
  const [, token] = header.split(' ');
  return token || null;
};
