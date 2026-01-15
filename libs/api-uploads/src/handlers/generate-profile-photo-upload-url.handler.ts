import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { created, badRequest, serverError } from '@pettzi/utils-dynamo/http';
import {
  getOwnerId,
  parseJson,
  guessExtension,
  nowPlusSeconds,
  PETTZI_DOCS_BUCKET_NAME,
} from './common';

const s3 = new S3Client({});

interface UploadRequest {
  contentType?: string;
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  let ownerId: string;
  try {
    ownerId = getOwnerId(event);
  } catch (err: any) {
    return err;
  }

  let payload: UploadRequest = {};
  try {
    payload = event.body ? parseJson<UploadRequest>(event.body) : {};
  } catch (err: any) {
    return err;
  }

  try {
    const contentType = payload.contentType ?? 'image/jpeg';
    const fileId = crypto.randomUUID();
    const key = `owners/${ownerId}/profile/${fileId}${guessExtension(contentType)}`;

    const expiresIn = 900;
    const uploadUrl = await getSignedUrl(
      s3,
      new PutObjectCommand({
        Bucket: PETTZI_DOCS_BUCKET_NAME,
        Key: key,
        ContentType: contentType,
      }),
      { expiresIn }
    );

    return created({
      uploadUrl,
      fileKey: key,
      expiresAt: nowPlusSeconds(expiresIn),
      contentType,
    });
  } catch (error) {
    console.error('Generate profile photo upload URL error', error);
    return serverError('Failed to generate upload URL');
  }
};
