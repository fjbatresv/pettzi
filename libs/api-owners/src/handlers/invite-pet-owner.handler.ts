import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { SESClient, SendTemplatedEmailCommand } from '@aws-sdk/client-ses';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import {
  badRequest,
  conflict,
  notFound,
  ok,
  serverError,
} from '@pettzi/utils-dynamo/http';
import {
  OwnerRole,
  buildPetPkKey,
  buildPetSkMetadata,
  fromItemPet,
} from '@pettzi/domain-model';
import crypto from 'crypto';
import {
  PETTZI_TABLE_NAME,
  assertOwnerOfPet,
  ddb,
  ensureOwnerExists,
  getCallerOwnerId,
  linkExists,
} from './common';

interface InvitePayload {
  email?: string;
}

const s3 = new S3Client({});
const ses = new SESClient({});

const PETTZI_DOCS_BUCKET_NAME = process.env.PETTZI_DOCS_BUCKET_NAME ?? '';
const SES_FROM_EMAIL = process.env.SES_FROM_EMAIL ?? '';
const INVITE_TEMPLATE_ES = process.env.SES_SHARE_PET_INVITE_TEMPLATE_NAME_ES ?? '';
const INVITE_TEMPLATE_EN = process.env.SES_SHARE_PET_INVITE_TEMPLATE_NAME_EN ?? '';
const INVITE_BASE_URL =
  process.env.PET_SHARE_INVITE_BASE_URL ?? 'https://app.pettzi.net/accept-invite';
const INVITE_SECRET = process.env.PET_SHARE_INVITE_SECRET ?? '';

const INVITE_EXPIRATION_DAYS = 7;
const INVITE_EXPIRATION_SECONDS = 60 * 60 * 24 * INVITE_EXPIRATION_DAYS;

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const buildInviteToken = (
  email: string,
  petId: string,
  inviterId: string,
  inviteeId: string,
  secret: string
) => {
  const expires = Date.now() + INVITE_EXPIRATION_SECONDS * 1000;
  const payload = `${email}:${petId}:${inviterId}:${inviteeId}:${expires}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return Buffer.from(`${payload}:${signature}`).toString('base64url');
};

const buildAcceptUrl = (token: string) => `${INVITE_BASE_URL}?token=${token}`;

const formatAge = (birthDate?: Date, locale: 'es' | 'en' = 'es') => {
  if (!birthDate) return '';
  const today = new Date();
  let years = today.getFullYear() - birthDate.getFullYear();
  let months = today.getMonth() - birthDate.getMonth();
  let days = today.getDate() - birthDate.getDate();

  if (days < 0) {
    const daysInPrevMonth = new Date(today.getFullYear(), today.getMonth(), 0).getDate();
    days += daysInPrevMonth;
    months -= 1;
  }
  if (months < 0) {
    months += 12;
    years -= 1;
  }
  if (years < 0) return '';

  if (years > 0) {
    if (locale === 'en') {
      return `${years} ${years === 1 ? 'year' : 'years'}`;
    }
    return `${years} ${years === 1 ? 'año' : 'años'}`;
  }
  if (locale === 'en') {
    return `${months} ${months === 1 ? 'month' : 'months'}`;
  }
  return `${months} ${months === 1 ? 'mes' : 'meses'}`;
};

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const petId = event.pathParameters?.petId;
  if (!petId) {
    return badRequest('petId is required');
  }
  if (!PETTZI_TABLE_NAME) {
    return serverError('PETTZI_TABLE_NAME is required');
  }
  if (!SES_FROM_EMAIL || (!INVITE_TEMPLATE_ES && !INVITE_TEMPLATE_EN)) {
    return serverError('SES templates are not configured');
  }
  if (!INVITE_SECRET) {
    return serverError('Invite secret is not configured');
  }

  let payload: InvitePayload;
  try {
    payload = JSON.parse(event.body ?? '{}') as InvitePayload;
  } catch {
    return badRequest('Invalid JSON body');
  }

  const rawEmail = payload.email?.trim();
  if (!rawEmail || !isValidEmail(rawEmail)) {
    return badRequest('Valid email is required');
  }
  const email = rawEmail.toLowerCase();

  let inviterId: string;
  try {
    inviterId = getCallerOwnerId(event);
  } catch (err: any) {
    return err;
  }

  try {
    await assertOwnerOfPet(petId, inviterId, OwnerRole.PRIMARY);
  } catch (err: any) {
    return err;
  }

  try {
    const invitee = await ensureOwnerExists(email);
    const inviteeId = invitee.ownerId;
    if (inviteeId === inviterId) {
      return badRequest('Cannot invite yourself');
    }

    const alreadyLinked = await linkExists(petId, inviteeId);
    if (alreadyLinked) {
      return conflict('Owner already linked to this pet');
    }

    const inviterProfile = await ensureOwnerExists(inviterId);

    const petRes = await ddb.send(
      new GetCommand({
        TableName: PETTZI_TABLE_NAME,
        Key: {
          PK: buildPetPkKey(petId),
          SK: buildPetSkMetadata(),
        },
      })
    );
    if (!petRes.Item) {
      return notFound('Pet not found');
    }
    const pet = fromItemPet(petRes.Item);
    const locale = inviterProfile.locale === 'en' ? 'en' : 'es';
    const petAge = formatAge(pet.birthDate, locale);
    const petBreed = pet.breed ?? pet.species ?? '';
    const petPhotoKey = pet.photoThumbnailKey ?? pet.photoKey ?? '';

    let petImageUrl = '';
    if (petPhotoKey && PETTZI_DOCS_BUCKET_NAME) {
      petImageUrl = await getSignedUrl(
        s3,
        new GetObjectCommand({
          Bucket: PETTZI_DOCS_BUCKET_NAME,
          Key: petPhotoKey,
        }),
        { expiresIn: INVITE_EXPIRATION_SECONDS }
      );
    }

    const token = buildInviteToken(email, petId, inviterId, inviteeId, INVITE_SECRET);
    const acceptInvitationUrl = buildAcceptUrl(token);
    const template =
      locale === 'en' && INVITE_TEMPLATE_EN ? INVITE_TEMPLATE_EN : INVITE_TEMPLATE_ES;

    await ses.send(
      new SendTemplatedEmailCommand({
        Source: SES_FROM_EMAIL,
        Destination: { ToAddresses: [email] },
        Template: template,
        TemplateData: JSON.stringify({
          inviterName: inviterProfile.fullName || inviterProfile.email || 'Pettzi',
          petName: pet.name,
          petBreed,
          petAge,
          petImageUrl,
          acceptInvitationUrl,
          expirationDays: INVITE_EXPIRATION_DAYS,
        }),
      })
    );

    return ok({ message: 'Invitation sent' });
  } catch (error) {
    console.error('Invite pet owner error', error);
    return serverError('Failed to invite owner');
  }
};
