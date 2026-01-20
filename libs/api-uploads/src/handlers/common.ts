import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
} from '@aws-sdk/lib-dynamodb';
import { badRequest, unauthorized } from '@pettzi/utils-dynamo/http';
import {
  buildPetOwnerPk,
  buildPetOwnerSk,
  OwnerId,
  PetId,
} from '@pettzi/domain-model';

export const PETTZI_TABLE_NAME = process.env.PETTZI_TABLE_NAME ?? '';
export const PETTZI_DOCS_BUCKET_NAME = process.env.PETTZI_DOCS_BUCKET_NAME ?? '';

export const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const getOwnerId = (event: APIGatewayProxyEventV2): string => {
  const claims = (event.requestContext as any)?.authorizer?.jwt?.claims as
    | Record<string, any>
    | undefined;
  const ownerId =
    (claims?.email as string | undefined) ||
    (claims?.username as string | undefined) ||
    (claims?.['cognito:username'] as string | undefined) ||
    (claims?.sub as string | undefined);
  if (!ownerId) {
    throw unauthorized('Missing owner identity');
  }
  return ownerId;
};

export const assertOwnership = async (
  petId: PetId,
  ownerId: OwnerId,
): Promise<void> => {
  const link = await docClient.send(
    new GetCommand({
      TableName: PETTZI_TABLE_NAME,
      Key: {
        PK: buildPetOwnerPk(petId),
        SK: buildPetOwnerSk(ownerId),
      },
    })
  );

  if (!link.Item) {
    throw unauthorized('You are not an owner of this pet');
  }
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

export const guessExtension = (contentType: string | undefined): string => {
  if (!contentType) return '';
  if (contentType === 'image/jpeg') return '.jpg';
  if (contentType === 'image/png') return '.png';
  if (contentType === 'image/gif') return '.gif';
  if (contentType === 'application/pdf') return '.pdf';
  const parts = contentType.split('/');
  if (parts.length === 2 && parts[1]) return `.${parts[1]}`;
  return '';
};

export const nowPlusSeconds = (seconds: number): string =>
  new Date(Date.now() + seconds * 1000).toISOString();
