import { S3Event } from 'aws-lambda';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import sharp from 'sharp';
import {
  buildPetPkKey,
  buildPetSkMetadata,
} from '@pettzi/domain-model';
import { PETTZI_DOCS_BUCKET_NAME, PETTZI_TABLE_NAME } from './common';

const s3 = new S3Client({});
const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const THUMBNAIL_SIZE = 256;

const streamToBuffer = async (stream: any): Promise<Buffer> => {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
};

const isThumbnailKey = (key: string) => key.includes('/photos/thumbnails/');

const parsePhotoKey = (key: string) => {
  if (isThumbnailKey(key)) {
    return null;
  }
  const match = key.match(/^pets\/([^/]+)\/photos\/([^/]+)$/);
  if (!match) {
    return null;
  }
  return { petId: match[1], fileName: match[2] };
};

export const handler = async (event: S3Event): Promise<void> => {
  if (!PETTZI_DOCS_BUCKET_NAME || !PETTZI_TABLE_NAME) {
    console.warn('Missing bucket or table configuration');
    return;
  }

  for (const record of event.Records ?? []) {
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
    const parsed = parsePhotoKey(key);
    if (!parsed) {
      continue;
    }

    try {
      const object = await s3.send(
        new GetObjectCommand({
          Bucket: PETTZI_DOCS_BUCKET_NAME,
          Key: key,
        })
      );
      if (!object.Body) {
        continue;
      }
      const source = await streamToBuffer(object.Body);
      const thumbnail = await sharp(source)
        .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, { fit: 'cover' })
        .webp({ quality: 80 })
        .toBuffer();

      const thumbKey = `pets/${parsed.petId}/photos/thumbnails/${parsed.fileName.replace(/\.[^.]+$/, '')}.webp`;

      await s3.send(
        new PutObjectCommand({
          Bucket: PETTZI_DOCS_BUCKET_NAME,
          Key: thumbKey,
          Body: thumbnail,
          ContentType: 'image/webp',
          CacheControl: 'public, max-age=31536000',
        })
      );

      await docClient.send(
        new UpdateCommand({
          TableName: PETTZI_TABLE_NAME,
          Key: {
            PK: buildPetPkKey(parsed.petId),
            SK: buildPetSkMetadata(),
          },
          UpdateExpression:
            'SET #photoKey = :photoKey, #photoThumbnailKey = :thumbKey, #updatedAt = :updatedAt',
          ExpressionAttributeNames: {
            '#photoKey': 'photoKey',
            '#photoThumbnailKey': 'photoThumbnailKey',
            '#updatedAt': 'updatedAt',
          },
          ExpressionAttributeValues: {
            ':photoKey': key,
            ':thumbKey': thumbKey,
            ':updatedAt': new Date().toISOString(),
          },
          ConditionExpression: 'attribute_exists(PK)',
        })
      );
    } catch (error) {
      console.error('Thumbnail generation failed', { key, error });
    }
  }
};
