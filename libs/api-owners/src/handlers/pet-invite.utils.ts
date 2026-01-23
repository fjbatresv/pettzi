import crypto from 'crypto';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import {
  badRequest,
  notFound,
  serverError,
} from '@pettzi/utils-dynamo/http';
import {
  OwnerProfile,
  buildPetPkKey,
  buildPetSkMetadata,
  fromItemPet,
} from '@pettzi/domain-model';
import { ddb, ensureOwnerExists, PETTZI_TABLE_NAME } from './common';

export interface InviteTokenPayload {
  email: string;
  petId: string;
  inviterId: string;
  inviteeId: string;
  expires: number;
}

export interface InvitePreviewResponse {
  pet: {
    petId: string;
    name: string;
    breed: string;
    species: string;
    age: string;
    imageUrl: string;
  };
  inviter: {
    ownerId: string;
    fullName: string;
    imageUrl: string;
  };
  expiresAt: string;
}

const s3 = new S3Client({});
const INVITE_EXPIRATION_SECONDS = 60 * 60 * 24 * 7;
const speciesLabels: Record<'es' | 'en', Record<string, string>> = {
  en: {
    DOG: 'Dog',
    CAT: 'Cat',
    BIRD: 'Bird',
    REPTILE: 'Reptile',
    OTHER: 'Other',
  },
  es: {
    DOG: 'Perro',
    CAT: 'Gato',
    BIRD: 'Ave',
    REPTILE: 'Reptil',
    OTHER: 'Otro',
  },
};

const breedLabels: Record<'es' | 'en', Record<string, string>> = {
  en: {
    LABRADOR: 'Labrador Retriever',
    GOLDEN: 'Golden Retriever',
    MIX: 'Mixed / Other',
    NEWFOUNDLAND: 'Newfoundland',
    SIAMESE: 'Siamese',
    PERSIAN: 'Persian',
    DOMESTIC_SHORTHAIR: 'Domestic Short hair',
    PARROT: 'Parrot',
    CANARY: 'Canary',
    IGUANA: 'Iguana',
    TURTLE: 'Turtle',
    OTHER: 'Other',
  },
  es: {
    LABRADOR: 'Labrador Retriever',
    GOLDEN: 'Golden Retriever',
    MIX: 'Mestizo / Otro',
    NEWFOUNDLAND: 'Terranova',
    SIAMESE: 'Siames',
    PERSIAN: 'Persa',
    DOMESTIC_SHORTHAIR: 'Pelo corto domestico',
    PARROT: 'Loro',
    CANARY: 'Canario',
    IGUANA: 'Iguana',
    TURTLE: 'Tortuga',
    OTHER: 'Otro',
  },
};

const safeEqual = (value: string, other: string) => {
  const left = Buffer.from(value);
  const right = Buffer.from(other);
  if (left.length !== right.length) {
    return false;
  }
  return crypto.timingSafeEqual(left, right);
};

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

const signPhoto = async (
  bucket: string,
  key: string,
  expiresAt: number
) => {
  if (!bucket || !key) {
    return '';
  }
  const expiresIn = Math.max(
    60,
    Math.min(
      INVITE_EXPIRATION_SECONDS,
      Math.floor((expiresAt - Date.now()) / 1000)
    )
  );
  return getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
    { expiresIn }
  );
};

export const parseInviteToken = (token: string, secret: string): InviteTokenPayload => {
  if (!token) {
    throw badRequest('Invite token is required');
  }
  if (!secret) {
    throw serverError('Invite secret is not configured');
  }
  let decoded = '';
  try {
    decoded = Buffer.from(token, 'base64url').toString('utf-8');
  } catch {
    throw badRequest('Invalid invite token');
  }

  const parts = decoded.split(':');
  if (parts.length < 6) {
    throw badRequest('Invalid invite token');
  }
  const signature = parts.pop() ?? '';
  const expiresRaw = parts.pop() ?? '';
  const inviteeId = parts.pop() ?? '';
  const inviterId = parts.pop() ?? '';
  const petId = parts.pop() ?? '';
  const email = parts.join(':');

  const expires = Number(expiresRaw);
  if (!email || !petId || !inviterId || !inviteeId || !Number.isFinite(expires)) {
    throw badRequest('Invalid invite token');
  }

  const payload = `${email}:${petId}:${inviterId}:${inviteeId}:${expires}`;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  if (!safeEqual(expected, signature)) {
    throw badRequest('Invalid invite token');
  }
  if (expires <= Date.now()) {
    throw badRequest('Invite token expired');
  }

  return {
    email,
    petId,
    inviterId,
    inviteeId,
    expires,
  };
};

export const buildInvitePreview = async (
  payload: InviteTokenPayload,
  docsBucket: string
): Promise<InvitePreviewResponse> => {
  if (!PETTZI_TABLE_NAME) {
    throw serverError('PETTZI_TABLE_NAME is required');
  }

  const inviterProfile = (await ensureOwnerExists(payload.inviterId)) as OwnerProfile;
  const petRes = await ddb.send(
    new GetCommand({
      TableName: PETTZI_TABLE_NAME,
      Key: {
        PK: buildPetPkKey(payload.petId),
        SK: buildPetSkMetadata(),
      },
    })
  );
  if (!petRes.Item) {
    throw notFound('Pet not found');
  }

  const pet = fromItemPet(petRes.Item);
  const locale = inviterProfile.locale === 'en' ? 'en' : 'es';
  const petBreed = localizePetBreed(locale, pet.breed, pet.species);
  const petAge = formatAge(pet.birthDate, locale);
  const petPhotoKey = pet.photoThumbnailKey ?? pet.photoKey ?? '';
  const petImageUrl = petPhotoKey
    ? await signPhoto(docsBucket, petPhotoKey, payload.expires)
    : '';
  const inviterPhotoUrl = inviterProfile.profilePhotoKey
    ? await signPhoto(docsBucket, inviterProfile.profilePhotoKey, payload.expires)
    : '';

  return {
    pet: {
      petId: pet.petId,
      name: pet.name,
      breed: petBreed,
      species: pet.species,
      age: petAge,
      imageUrl: petImageUrl,
    },
    inviter: {
      ownerId: inviterProfile.ownerId,
      fullName: inviterProfile.fullName || inviterProfile.email || 'Pettzi',
      imageUrl: inviterPhotoUrl,
    },
    expiresAt: new Date(payload.expires).toISOString(),
  };
};

export const localizePetBreed = (
  locale: 'es' | 'en',
  breed?: string,
  species?: string
) => {
  if (breed && breedLabels[locale][breed]) {
    return breedLabels[locale][breed];
  }
  if (breed) {
    return breed;
  }
  if (species && speciesLabels[locale][species]) {
    return speciesLabels[locale][species];
  }
  return species ?? '';
};
