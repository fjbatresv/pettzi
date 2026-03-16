import { EventType, OwnerRole, PetSpecies } from './enums';
import {
  buildOwnerProfilePk,
  buildOwnerProfileSk,
  buildPetEventPk,
  buildPetEventSk,
  buildPetOwnerPk,
  buildPetOwnerSk,
  buildPetOwnerGsi1Pk,
  buildPetOwnerGsi1Sk,
  buildPetPkKey,
  buildPetReminderPk,
  buildPetReminderSk,
  buildPetRoutineOccurrencePk,
  buildPetRoutineOccurrenceSk,
  buildPetRoutineActivityPk,
  buildPetRoutineActivitySk,
  buildPetRoutinePk,
  buildPetRoutineSk,
  buildReminderGsi1Pk,
  buildReminderGsi1Sk,
  buildSharedRecordPk,
  buildSharedRecordSk,
  buildSharedRecordGsi1Pk,
  buildSharedRecordGsi1Sk,
  buildUserAccountPk,
  buildUserAccountSk,
  buildPetSkMetadata,
} from './keys';
import {
  OwnerProfile,
  Pet,
  PetEvent,
  PetOwner,
  PetReminder,
  PetRoutine,
  RoutineActivity,
  RoutineOccurrence,
  SharedRecord,
  UserAccount,
} from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DynamoItem = {
  [key: string]: any;
  userId?: any;
  email?: any;
  createdAt?: any;
  updatedAt?: any;
  ownerId?: any;
  fullName?: any;
  firstName?: any;
  lastName?: any;
  phone?: any;
  profilePhotoKey?: any;
  locale?: any;
  petId?: any;
  name?: any;
  species?: any;
  breed?: any;
  birthDate?: any;
  notes?: any;
  color?: any;
  weightKg?: any;
  photoKey?: any;
  photoThumbnailKey?: any;
  isArchived?: any;
  archivedAt?: any;
  role?: any;
  linkedAt?: any;
  eventId?: any;
  eventType?: any;
  eventDate?: any;
  title?: any;
  metadata?: any;
  reminderId?: any;
  dueDate?: any;
  message?: any;
  completedAt?: any;
  routineId?: any;
  activityId?: any;
  routineType?: any;
  ownerUserId?: any;
  status?: any;
  timezone?: any;
  schedule?: any;
  occurrenceId?: any;
  scheduledFor?: any;
  skippedAt?: any;
  completedByUserId?: any;
  token?: any;
  items?: any;
  expiresAt?: any;
  passwordHash?: any;
  passwordSalt?: any;
  ttl?: any;
};

const requireField = (value: unknown, name: string) => {
  if (value === undefined || value === null) {
    throw new Error(`Missing required field ${name}`);
  }
};

const toIso = (value?: Date): string | undefined =>
  value ? value.toISOString() : undefined;

const parseDate = (value?: string): Date | undefined =>
  value ? new Date(value) : undefined;

export const toItemUserAccount = (user: UserAccount): DynamoItem => {
  requireField(user.userId, 'userId');
  requireField(user.email, 'email');
  requireField(user.createdAt, 'createdAt');

  return {
    PK: buildUserAccountPk(user.userId),
    SK: buildUserAccountSk(),
    type: 'UserAccount',
    userId: user.userId,
    email: user.email,
    createdAt: toIso(user.createdAt),
    updatedAt: toIso(user.updatedAt),
  };
};

export const fromItemUserAccount = (item: DynamoItem): UserAccount => ({
  userId: item.userId,
  email: item.email,
  createdAt: new Date(item.createdAt),
  updatedAt: parseDate(item.updatedAt),
});

export const toItemOwnerProfile = (owner: OwnerProfile): DynamoItem => {
  requireField(owner.ownerId, 'ownerId');
  requireField(owner.userId, 'userId');
  requireField(owner.fullName, 'fullName');
  requireField(owner.createdAt, 'createdAt');

  return {
    PK: buildOwnerProfilePk(owner.ownerId),
    SK: buildOwnerProfileSk(),
    type: 'OwnerProfile',
    ownerId: owner.ownerId,
    userId: owner.userId,
    fullName: owner.fullName,
    firstName: owner.firstName,
    lastName: owner.lastName,
    email: owner.email,
    phone: owner.phone,
    profilePhotoKey: owner.profilePhotoKey,
    locale: owner.locale,
    createdAt: toIso(owner.createdAt),
    updatedAt: toIso(owner.updatedAt),
  };
};

export const fromItemOwnerProfile = (item: DynamoItem): OwnerProfile => ({
  ownerId: item.ownerId,
  userId: item.userId,
  fullName: item.fullName,
  firstName: item.firstName,
  lastName: item.lastName,
  email: item.email,
  phone: item.phone,
  profilePhotoKey: item.profilePhotoKey,
  locale: item.locale,
  createdAt: new Date(item.createdAt),
  updatedAt: parseDate(item.updatedAt),
});

export const toItemPet = (pet: Pet): DynamoItem => {
  requireField(pet.petId, 'petId');
  requireField(pet.name, 'name');
  requireField(pet.species, 'species');
  requireField(pet.createdAt, 'createdAt');

  return {
    PK: buildPetPkKey(pet.petId),
    SK: buildPetSkMetadata(),
    type: 'Pet',
    petId: pet.petId,
    ownerId: pet.ownerId,
    name: pet.name,
    species: pet.species,
    breed: pet.breed,
    birthDate: toIso(pet.birthDate),
    notes: pet.notes,
    color: pet.color,
    isNeutered: pet.isNeutered,
    bloodType: pet.bloodType,
    sex: pet.sex,
    weightKg: pet.weightKg,
    photoKey: pet.photoKey,
    photoThumbnailKey: pet.photoThumbnailKey,
    lastGroomingDate: toIso(pet.lastGroomingDate),
    lastVetVisitDate: toIso(pet.lastVetVisitDate),
    healthIndex: pet.healthIndex,
    isArchived: pet.isArchived ?? false,
    archivedAt: toIso(pet.archivedAt),
    createdAt: toIso(pet.createdAt),
    updatedAt: toIso(pet.updatedAt),
  };
};

export const fromItemPet = (item: DynamoItem): Pet => ({
  petId: item.petId,
  ownerId: item.ownerId,
  name: item.name,
  species: item.species as PetSpecies,
  breed: item.breed,
  birthDate: parseDate(item.birthDate),
  notes: item.notes,
  color: item.color,
  isNeutered: item['isNeutered'],
  bloodType: item['bloodType'],
  sex: item['sex'],
  weightKg: item.weightKg,
  photoKey: item.photoKey,
  photoThumbnailKey: item['photoThumbnailKey'],
  lastGroomingDate: parseDate(item['lastGroomingDate']),
  lastVetVisitDate: parseDate(item['lastVetVisitDate']),
  healthIndex: item['healthIndex'],
  isArchived: item.isArchived,
  archivedAt: parseDate(item.archivedAt),
  createdAt: new Date(item.createdAt),
  updatedAt: parseDate(item.updatedAt),
});

export const toItemPetOwner = (link: PetOwner): DynamoItem => {
  requireField(link.petId, 'petId');
  requireField(link.ownerId, 'ownerId');
  requireField(link.role, 'role');
  requireField(link.linkedAt, 'linkedAt');

  return {
    PK: buildPetOwnerPk(link.petId),
    SK: buildPetOwnerSk(link.ownerId),
    GSI1PK: buildPetOwnerGsi1Pk(link.ownerId),
    GSI1SK: buildPetOwnerGsi1Sk(link.petId),
    type: 'PetOwner',
    petId: link.petId,
    ownerId: link.ownerId,
    role: link.role,
    linkedAt: toIso(link.linkedAt),
  };
};

export const fromItemPetOwner = (item: DynamoItem): PetOwner => ({
  petId: item.petId,
  ownerId: item.ownerId,
  role: item.role as OwnerRole,
  linkedAt: new Date(item.linkedAt),
});

export const toItemPetEvent = (event: PetEvent): DynamoItem => {
  requireField(event.petId, 'petId');
  requireField(event.eventId, 'eventId');
  requireField(event.eventType, 'eventType');
  requireField(event.eventDate, 'eventDate');
  requireField(event.createdAt, 'createdAt');

  return {
    PK: buildPetEventPk(event.petId),
    SK: buildPetEventSk(event.eventDate, event.eventId),
    type: 'PetEvent',
    petId: event.petId,
    eventId: event.eventId,
    ownerId: event.ownerId,
    eventType: event.eventType,
    eventDate: toIso(event.eventDate),
    title: event.title,
    notes: event.notes,
    metadata: event.metadata,
    createdAt: toIso(event.createdAt),
    updatedAt: toIso(event.updatedAt),
  };
};

export const fromItemPetEvent = (item: DynamoItem): PetEvent => ({
  petId: item.petId,
  eventId: item.eventId,
  ownerId: item.ownerId,
  eventType: item.eventType as EventType,
  eventDate: new Date(item.eventDate),
  title: item.title,
  notes: item.notes,
  metadata: item.metadata,
  createdAt: new Date(item.createdAt),
  updatedAt: parseDate(item.updatedAt),
});

export const toItemPetReminder = (reminder: PetReminder): DynamoItem => {
  requireField(reminder.petId, 'petId');
  requireField(reminder.reminderId, 'reminderId');
  requireField(reminder.dueDate, 'dueDate');
  requireField(reminder.createdAt, 'createdAt');

  return {
    PK: buildPetReminderPk(reminder.petId),
    SK: buildPetReminderSk(reminder.reminderId),
    GSI1PK: buildReminderGsi1Pk(),
    GSI1SK: buildReminderGsi1Sk(
      reminder.dueDate,
      reminder.petId,
      reminder.eventId ?? reminder.reminderId
    ),
    type: 'PetReminder',
    petId: reminder.petId,
    reminderId: reminder.reminderId,
    ownerId: reminder.ownerId,
    eventId: reminder.eventId,
    dueDate: toIso(reminder.dueDate),
    message: reminder.message,
    metadata: reminder.metadata,
    createdAt: toIso(reminder.createdAt),
    completedAt: toIso(reminder.completedAt),
    ttl: Math.floor(reminder.dueDate.getTime() / 1000),
  };
};

export const fromItemPetReminder = (item: DynamoItem): PetReminder => ({
  petId: item.petId,
  reminderId: item.reminderId,
  ownerId: item.ownerId,
  eventId: item.eventId,
  dueDate: new Date(item.dueDate),
  message: item.message,
  metadata: item.metadata,
  createdAt: new Date(item.createdAt),
  completedAt: parseDate(item.completedAt),
});

export const toItemPetRoutine = (
  routine: PetRoutine
): DynamoItem => {
  requireField(routine.petId, 'petId');
  requireField(routine.routineId, 'routineId');
  requireField(routine.ownerUserId, 'ownerUserId');
  requireField(routine.status, 'status');
  requireField(routine.timezone, 'timezone');
  requireField(routine.createdAt, 'createdAt');
  requireField(routine.updatedAt, 'updatedAt');

  return {
    PK: buildPetRoutinePk(routine.petId),
    SK: buildPetRoutineSk(routine.routineId),
    type: 'PetRoutine',
    petId: routine.petId,
    routineId: routine.routineId,
    ownerUserId: routine.ownerUserId,
    status: routine.status,
    timezone: routine.timezone,
    createdAt: toIso(routine.createdAt),
    updatedAt: toIso(routine.updatedAt),
  };
};

export const fromItemPetRoutine = (item: DynamoItem): PetRoutine => ({
  routineId: item.routineId,
  petId: item.petId,
  ownerUserId: item.ownerUserId,
  status: item.status,
  timezone: item.timezone,
  createdAt: new Date(item.createdAt),
  updatedAt: new Date(item.updatedAt ?? item.createdAt),
});

export const toItemRoutineActivity = (
  activity: RoutineActivity
): DynamoItem => {
  requireField(activity.petId, 'petId');
  requireField(activity.routineId, 'routineId');
  requireField(activity.activityId, 'activityId');
  requireField(activity.ownerUserId, 'ownerUserId');
  requireField(activity.title, 'title');
  requireField(activity.type, 'type');
  requireField(activity.status, 'status');
  requireField(activity.schedule, 'schedule');
  requireField(activity.createdAt, 'createdAt');
  requireField(activity.updatedAt, 'updatedAt');

  return {
    PK: buildPetRoutineActivityPk(activity.petId),
    SK: buildPetRoutineActivitySk(activity.activityId),
    type: 'RoutineActivity',
    petId: activity.petId,
    routineId: activity.routineId,
    activityId: activity.activityId,
    ownerUserId: activity.ownerUserId,
    title: activity.title,
    routineType: activity.type,
    notes: activity.notes,
    status: activity.status,
    schedule: activity.schedule,
    createdAt: toIso(activity.createdAt),
    updatedAt: toIso(activity.updatedAt),
  };
};

export const fromItemRoutineActivity = (
  item: DynamoItem
): RoutineActivity => ({
  activityId: item.activityId,
  routineId: item.routineId,
  petId: item.petId,
  ownerUserId: item.ownerUserId,
  title: item.title,
  type: item.routineType,
  notes: item.notes,
  status: item.status,
  schedule: item.schedule,
  createdAt: new Date(item.createdAt),
  updatedAt: new Date(item.updatedAt ?? item.createdAt),
});

export const toItemRoutineOccurrence = (
  occurrence: RoutineOccurrence
): DynamoItem => {
  requireField(occurrence.petId, 'petId');
  requireField(occurrence.routineId, 'routineId');
  requireField(occurrence.activityId, 'activityId');
  requireField(occurrence.occurrenceId, 'occurrenceId');
  requireField(occurrence.scheduledFor, 'scheduledFor');
  requireField(occurrence.status, 'status');
  requireField(occurrence.createdAt, 'createdAt');
  requireField(occurrence.updatedAt, 'updatedAt');

  return {
    PK: buildPetRoutineOccurrencePk(occurrence.petId),
    SK: buildPetRoutineOccurrenceSk(
      occurrence.scheduledFor,
      occurrence.activityId,
      occurrence.occurrenceId
    ),
    type: 'RoutineOccurrence',
    petId: occurrence.petId,
    routineId: occurrence.routineId,
    activityId: occurrence.activityId,
    occurrenceId: occurrence.occurrenceId,
    scheduledFor: toIso(occurrence.scheduledFor),
    status: occurrence.status,
    completedAt: toIso(occurrence.completedAt),
    skippedAt: toIso(occurrence.skippedAt),
    notes: occurrence.notes,
    completedByUserId: occurrence.completedByUserId,
    createdAt: toIso(occurrence.createdAt),
    updatedAt: toIso(occurrence.updatedAt),
  };
};

export const fromItemRoutineOccurrence = (
  item: DynamoItem
): RoutineOccurrence => ({
  occurrenceId: item.occurrenceId,
  routineId: item.routineId,
  activityId: item.activityId,
  petId: item.petId,
  scheduledFor: new Date(item.scheduledFor),
  status: item.status,
  completedAt: parseDate(item.completedAt),
  skippedAt: parseDate(item.skippedAt),
  notes: item.notes,
  completedByUserId: item.completedByUserId,
  createdAt: new Date(item.createdAt),
  updatedAt: new Date(item.updatedAt ?? item.createdAt),
});

export const toItemRoutineDefinition = toItemRoutineActivity;
export const fromItemRoutineDefinition = fromItemRoutineActivity;

export const toItemSharedRecord = (record: SharedRecord): DynamoItem => {
  requireField(record.token, 'token');
  requireField(record.petId, 'petId');
  requireField(record.ownerId, 'ownerId');
  requireField(record.items, 'items');
  requireField(record.expiresAt, 'expiresAt');
  requireField(record.createdAt, 'createdAt');

  return {
    PK: buildSharedRecordPk(record.token),
    SK: buildSharedRecordSk(record.petId),
    GSI1PK: buildSharedRecordGsi1Pk(record.petId),
    GSI1SK: buildSharedRecordGsi1Sk(record.createdAt, record.token),
    type: 'SharedRecord',
    token: record.token,
    petId: record.petId,
    ownerId: record.ownerId,
    items: record.items,
    expiresAt: toIso(record.expiresAt),
    createdAt: toIso(record.createdAt),
    passwordHash: record.passwordHash,
    passwordSalt: record.passwordSalt,
    ttl: Math.floor(record.expiresAt.getTime() / 1000),
  };
};

export const fromItemSharedRecord = (item: DynamoItem): SharedRecord => ({
  token: item.token,
  petId: item.petId,
  ownerId: item.ownerId,
  items: item.items ?? [],
  expiresAt: new Date(item.expiresAt),
  createdAt: new Date(item.createdAt),
  passwordHash: item.passwordHash,
  passwordSalt: item.passwordSalt,
});
