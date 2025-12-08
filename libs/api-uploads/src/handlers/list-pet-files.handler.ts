import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { badRequest, ok, serverError } from '@peto/utils-dynamo/http';
import { assertOwnership, getOwnerId, PETO_DOCS_BUCKET_NAME } from './common';

const s3 = new S3Client({});

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const petId = event.pathParameters?.petId;
  if (!petId) {
    return badRequest('petId is required');
  }

  let ownerId: string;
  try {
    ownerId = getOwnerId(event);
  } catch (err: any) {
    return err;
  }

  try {
    await assertOwnership(petId, ownerId);

    const res = await s3.send(
      new ListObjectsV2Command({
        Bucket: PETO_DOCS_BUCKET_NAME,
        Prefix: `pets/${petId}/`,
      })
    );

    const files =
      res.Contents?.map((obj) => ({
        key: obj.Key,
        size: obj.Size ?? 0,
        lastModified: obj.LastModified?.toISOString(),
        type: obj.Key?.includes('/photos/')
          ? 'PHOTO'
          : obj.Key?.includes('/documents/')
            ? 'DOCUMENT'
            : undefined,
      })) ?? [];

    return ok({ files });
  } catch (error) {
    console.error('List pet files error', error);
    return serverError('Failed to list files');
  }
};
