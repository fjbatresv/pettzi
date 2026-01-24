import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ok, badRequest, notFound, serverError } from '@pettzi/utils-dynamo/http';
import { buildPetEventPk, fromItemPetEvent } from '@pettzi/domain-model';
import {
  assertOwnership,
  docClient,
  getOwnerId,
  PETTZI_TABLE_NAME,
  PETTZI_DOCS_BUCKET_NAME,
} from './common';

const s3 = new S3Client({});

type RawAttachment = {
  fileKey?: string;
  fileName?: string;
  contentType?: string;
};

type AttachmentResponse = {
  fileKey: string;
  fileName?: string;
  contentType?: string;
  downloadUrl: string;
  previewUrl?: string;
  expiresAt: string;
  isImage: boolean;
};

const normalizeAttachments = (value: unknown): RawAttachment[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item) => item && typeof item === 'object');
};

const isImageContent = (contentType?: string, fileName?: string) => {
  if (contentType && contentType.startsWith('image/')) {
    return true;
  }
  if (!fileName) {
    return false;
  }
  return Boolean(fileName.match(/\.(png|jpe?g|gif|webp|bmp|heic|heif)$/i));
};

const nowPlusSeconds = (seconds: number): string =>
  new Date(Date.now() + seconds * 1000).toISOString();

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const petId = event.pathParameters?.petId;
  const eventId = event.pathParameters?.eventId;
  if (!petId || !eventId) {
    return badRequest('petId and eventId are required');
  }

  let ownerId: string;
  try {
    ownerId = getOwnerId(event);
  } catch (err: any) {
    return err;
  }

  try {
    await assertOwnership(petId, ownerId);

    const res = await docClient.send(
      new GetCommand({
        TableName: PETTZI_TABLE_NAME,
        Key: {
          PK: buildPetEventPk(petId),
          SK: `EVENT#${eventId}`,
        },
      })
    );

    let eventItem;
    if (res.Item && res.Item.eventId === eventId) {
      eventItem = fromItemPetEvent(res.Item);
    } else {
      const queryRes = await docClient.send(
        new QueryCommand({
          TableName: PETTZI_TABLE_NAME,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
          ExpressionAttributeValues: {
            ':pk': buildPetEventPk(petId),
            ':sk': 'EVENT#',
          },
        })
      );

      const found = (queryRes.Items ?? []).find((i: any) => i.eventId === eventId);
      if (found) {
        eventItem = fromItemPetEvent(found);
      }
    }

    if (!eventItem) {
      return notFound('Event not found');
    }

    if (!PETTZI_DOCS_BUCKET_NAME) {
      return ok({ event: eventItem, attachments: [] });
    }

    let meta = eventItem.metadata as Record<string, unknown> | string | undefined;
    if (typeof meta === 'string') {
      try {
        meta = JSON.parse(meta) as Record<string, unknown>;
      } catch {
        meta = undefined;
      }
    }
    const rawAttachments = normalizeAttachments((meta as Record<string, unknown> | undefined)?.attachments);
    const expiresIn = 900;
    const expiresAt = nowPlusSeconds(expiresIn);

    const validAttachments = rawAttachments
      .map((attachment) => {
        const fileKey = attachment.fileKey?.trim();
        if (!fileKey) {
          return null;
        }
        if (!fileKey.startsWith(`pets/${petId}/`)) {
          return null;
        }
        return { ...attachment, fileKey };
      })
      .filter((attachment): attachment is RawAttachment & { fileKey: string } => Boolean(attachment));

    const attachments: AttachmentResponse[] = await Promise.all(
      validAttachments.map(async (attachment) => {
        const fileKey = attachment.fileKey;
        const contentType = attachment.contentType;
        const fileName = attachment.fileName;
        const downloadUrl = await getSignedUrl(
          s3,
          new GetObjectCommand({
            Bucket: PETTZI_DOCS_BUCKET_NAME,
            Key: fileKey,
          }),
          { expiresIn }
        );
        const isImage = isImageContent(contentType, fileName);
        return {
          fileKey,
          fileName,
          contentType,
          downloadUrl,
          previewUrl: isImage ? downloadUrl : undefined,
          expiresAt,
          isImage,
        };
      })
    );

    return ok({
      event: eventItem,
      attachments,
    });
  } catch (error) {
    console.error('Get event detail error', error);
    return serverError('Failed to get event detail');
  }
};
