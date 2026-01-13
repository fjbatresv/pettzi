import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { badRequest, ok, serverError, unauthorized } from '@pettzi/utils-dynamo/http';
import { assertOwnership, getOwnerId, nowPlusSeconds, PETTZI_DOCS_BUCKET_NAME } from './common';

const s3 = new S3Client({});

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const petId = event.pathParameters?.petId;
  const rawFileKey = event.queryStringParameters?.fileKey;
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

    const expiresIn = 900;
    const downloadUrl = await getSignedUrl(
      s3,
      new GetObjectCommand({
        Bucket: PETTZI_DOCS_BUCKET_NAME,
        Key: fileKey,
      }),
      { expiresIn }
    );

    return ok({
      downloadUrl,
      expiresAt: nowPlusSeconds(expiresIn),
    });
  } catch (error) {
    console.error('Generate download URL error', error);
    return serverError('Failed to generate download URL');
  }
};
