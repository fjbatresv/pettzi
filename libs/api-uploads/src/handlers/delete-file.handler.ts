import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { badRequest, ok, serverError, unauthorized } from '@peto/utils-dynamo/http';
import { assertOwnership, getOwnerId, PETO_DOCS_BUCKET_NAME } from './common';

const s3 = new S3Client({});

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const petId = event.pathParameters?.petId;
  const rawFileKey = event.pathParameters?.fileKey;
  if (!petId || !rawFileKey) {
    return badRequest('petId and fileKey are required');
  }

  let ownerId: string;
  try {
    ownerId = getOwnerId(event);
  } catch (err: any) {
    return err;
  }

  const fileKey = decodeURIComponent(rawFileKey);
  if (!fileKey.startsWith(`pets/${petId}/`)) {
    return unauthorized('File does not belong to this pet');
  }

  try {
    await assertOwnership(petId, ownerId);
    await s3.send(
      new DeleteObjectCommand({
        Bucket: PETO_DOCS_BUCKET_NAME,
        Key: fileKey,
      })
    );
    return ok({ message: 'File deleted' });
  } catch (error) {
    console.error('Delete file error', error);
    return serverError('Failed to delete file');
  }
};
