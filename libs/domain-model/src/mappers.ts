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
  buildReminderGsi1Pk,
  buildReminderGsi1Sk,
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
  UserAccount,
} from './types';

type DynamoItem = Record<string, any>;

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
    phone: owner.phone,
    createdAt: toIso(owner.createdAt),
    updatedAt: toIso(owner.updatedAt),
  };
};

export const fromItemOwnerProfile = (item: DynamoItem): OwnerProfile => ({
  ownerId: item.ownerId,
  userId: item.userId,
  fullName: item.fullName,
  phone: item.phone,
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
    weightKg: pet.weightKg,
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
  weightKg: item.weightKg,
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
    eventType: event.eventType,
    eventDate: toIso(event.eventDate),
    notes: event.notes,
    metadata: event.metadata,
    createdAt: toIso(event.createdAt),
    updatedAt: toIso(event.updatedAt),
  };
};

export const fromItemPetEvent = (item: DynamoItem): PetEvent => ({
  petId: item.petId,
  eventId: item.eventId,
  eventType: item.eventType as EventType,
  eventDate: new Date(item.eventDate),
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
    eventId: reminder.eventId,
    dueDate: toIso(reminder.dueDate),
    message: reminder.message,
    createdAt: toIso(reminder.createdAt),
    completedAt: toIso(reminder.completedAt),
  };
};

export const fromItemPetReminder = (item: DynamoItem): PetReminder => ({
  petId: item.petId,
  reminderId: item.reminderId,
  eventId: item.eventId,
  dueDate: new Date(item.dueDate),
  message: item.message,
  createdAt: new Date(item.createdAt),
  completedAt: parseDate(item.completedAt),
});
