import { EventType, OwnerRole, PetSpecies } from './enums';

// Strongly typed ids (aliases for readability).
export type UserId = string;
export type OwnerId = string;
export type PetId = string;
export type EventId = string;
export type ReminderId = string;

export interface UserAccount {
  userId: UserId;
  email: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface OwnerProfile {
  ownerId: OwnerId;
  userId: UserId;
  fullName: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  profilePhotoKey?: string;
  locale?: 'es' | 'en';
  createdAt: Date;
  updatedAt?: Date;
}

export interface Pet {
  petId: PetId;
  ownerId?: OwnerId; // convenience link for primary owner
  name: string;
  species: PetSpecies;
  breed?: string;
  birthDate?: Date;
  notes?: string;
  color?: string;
  weightKg?: number;
  photoKey?: string;
  photoThumbnailKey?: string;
  lastGroomingDate?: Date;
  lastVetVisitDate?: Date;
  healthIndex?: number;
  isArchived?: boolean;
  archivedAt?: Date;
  createdAt: Date;
  updatedAt?: Date;
}

export interface PetOwner {
  petId: PetId;
  ownerId: OwnerId;
  role: OwnerRole;
  linkedAt: Date;
}

export interface PetEvent {
  eventId: EventId;
  petId: PetId;
  eventType: EventType;
  eventDate: Date;
  title?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt?: Date;
}

export interface PetReminder {
  reminderId: ReminderId;
  petId: PetId;
  eventId?: EventId;
  dueDate: Date;
  message?: string;
  metadata?: Record<string, unknown>;
  recurring?: boolean;
  createdAt: Date;
  completedAt?: Date;
}

export interface CatalogEntry<T extends string> {
  code: T;
  label: string;
  description?: string;
}
