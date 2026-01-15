import {
  buildUserPk,
  buildUserProfileSk,
  buildPetPk,
  buildPetOwnerSk as buildOwnerFragment,
  buildEventSk,
  buildReminderVaccinationGsiSk,
  buildReminderVaccinationGsiPk,
} from '@pettzi/utils-dynamo/key';

import { EventId, OwnerId, PetId, ReminderId, UserId } from './types';

const toIso = (value: string | Date): string =>
  value instanceof Date ? value.toISOString() : value;

export const buildUserAccountPk = (userId: UserId): string =>
  buildUserPk(userId);
export const buildUserAccountSk = (): string => buildUserProfileSk();

export const buildOwnerProfilePk = (ownerId: OwnerId): string =>
  buildOwnerFragment(ownerId);
export const buildOwnerProfileSk = (): string => buildUserProfileSk();
export const buildOwnerSettingsSk = (): string => 'SETTINGS';

export const buildPetPkKey = (petId: PetId): string => buildPetPk(petId);
export const buildPetSkMetadata = (): string => 'METADATA';

export const buildPetOwnerPk = (petId: PetId): string => buildPetPk(petId);
export const buildPetOwnerSk = (ownerId: OwnerId): string =>
  buildOwnerFragment(ownerId);
export const buildPetOwnerGsi1Pk = (ownerId: OwnerId): string =>
  buildOwnerFragment(ownerId);
export const buildPetOwnerGsi1Sk = (petId: PetId): string => buildPetPk(petId);

export const buildPetEventPk = (petId: PetId): string => buildPetPk(petId);
export const buildPetEventSk = (
  eventDate: string | Date,
  eventId: EventId,
): string => buildEventSk(toIso(eventDate), eventId);

export const buildPetReminderPk = (petId: PetId): string => buildPetPk(petId);
export const buildPetReminderSk = (reminderId: ReminderId): string =>
  `REMINDER#${reminderId}`;

export const buildReminderGsi1Pk = (): string =>
  buildReminderVaccinationGsiPk();
export const buildReminderGsi1Sk = (
  dueDate: string | Date,
  petId: PetId,
  eventId: EventId,
): string => buildReminderVaccinationGsiSk(toIso(dueDate), petId, eventId);
