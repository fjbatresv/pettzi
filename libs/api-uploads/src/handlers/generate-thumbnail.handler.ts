import { S3Event } from 'aws-lambda';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import sharp from 'sharp';
import heicConvert from 'heic-convert';
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
const isHeicFile = (fileName: string) => /\.(heic|heif)$/i.test(fileName);
const convertHeicToJpeg = async (source: Buffer): Promise<Buffer> => {
  const output = await heicConvert({
    buffer: source,
    format: 'JPEG',
    quality: 0.82,
  });
  return output instanceof ArrayBuffer
    ? Buffer.from(new Uint8Array(output))
    : Buffer.from(output);
};

const parsePhotoKey = (key: string) => {
  if (isThumbnailKey(key)) {
    return null;
  }
  const match = key.match(/^pets\/([^/]+)\/photos\/([^/]+)$/);
  if (!match) {
    console.warn('Invalid photo key');
    return null;
  }
  console.debug('match', match);
  return { petId: match[1], fileName: match[2] };
};

type EventBridgeS3Event = {
  detail?: {
    bucket?: { name?: string };
    object?: { key?: string };
  };
};

const extractObjectKeys = (event: S3Event | EventBridgeS3Event): string[] => {
  if (Array.isArray((event as S3Event).Records)) {
    return (event as S3Event).Records
      .map((record) => record?.s3?.object?.key)
      .filter((key): key is string => typeof key === 'string' && key.length > 0);
  }

  const key = (event as EventBridgeS3Event)?.detail?.object?.key;
  return typeof key === 'string' && key.length > 0 ? [key] : [];
};

export const handler = async (event: S3Event | EventBridgeS3Event): Promise<void> => {
  if (!PETTZI_DOCS_BUCKET_NAME || !PETTZI_TABLE_NAME) {
    console.warn('Missing bucket or table configuration');
    return;
  }

  const keys = extractObjectKeys(event);
  console.info('Thumbnail handler invoked', { keysCount: keys.length });
  if (keys.length === 0) {
    console.warn('No S3 object keys found in event payload');
    return;
  }

  for (const rawKey of keys) {
    const key = decodeURIComponent(rawKey.replace(/\+/g, ' '));
    const parsed = parsePhotoKey(key);
    if (!parsed) {
      console.warn('Record key no parsed', {key, parsed});
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
        console.warn('Object not contains a body', {key});
        continue;
      }
      const source = await streamToBuffer(object.Body);
      const baseName = parsed.fileName.replace(/\.[^.]+$/, '');
      const shouldJpeg = isHeicFile(parsed.fileName);
      const input = shouldJpeg ? await convertHeicToJpeg(source) : source;
      const thumbnail = await sharp(input)
        .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, { fit: 'cover' })
        .toFormat(shouldJpeg ? 'jpeg' : 'webp', shouldJpeg ? { quality: 82 } : { quality: 80 })
        .toBuffer();

      const thumbExt = shouldJpeg ? 'jpg' : 'webp';
      const thumbKey = `pets/${parsed.petId}/photos/thumbnails/${baseName}.${thumbExt}`;

      await s3.send(
        new PutObjectCommand({
          Bucket: PETTZI_DOCS_BUCKET_NAME,
          Key: thumbKey,
          Body: thumbnail,
          ContentType: shouldJpeg ? 'image/jpeg' : 'image/webp',
          CacheControl: 'public, max-age=31536000',
        })
      );
      console.debug('Thumbnail created', {thumbKey});
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
      console.debug('DynamoDB pet record updated with thumbnail', {PK: buildPetPkKey(parsed.petId),
        SK: buildPetSkMetadata(), thumbKey})
    } catch (error) {
      console.error('Thumbnail generation failed', { key, error });
    }
  }
};
