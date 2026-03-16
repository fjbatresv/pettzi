import {
  EventType,
  OwnerRole,
  PetSpecies,
  RoutineOccurrenceStatus,
  RoutineStatus,
  RoutineType,
} from './enums';

// Strongly typed ids (aliases for readability).
export type UserId = string;
export type OwnerId = string;
export type PetId = string;
export type EventId = string;
export type ReminderId = string;
export type RoutineId = string;
export type RoutineActivityId = string;
export type RoutineOccurrenceId = string;
export type SharedRecordToken = string;

export type RoutineSchedule =
  | {
      frequency: 'DAILY';
      times: string[];
    }
  | {
      frequency: 'WEEKLY';
      daysOfWeek: number[];
      times: string[];
    }
  | {
      frequency: 'MONTHLY';
      daysOfMonth: number[];
      times: string[];
    };

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
  isNeutered?: boolean;
  bloodType?: string;
  sex?: string;
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
  ownerId?: OwnerId;
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
  ownerId?: OwnerId;
  eventId?: EventId;
  dueDate: Date;
  message?: string;
  metadata?: Record<string, unknown>;
  recurring?: boolean;
  createdAt: Date;
  completedAt?: Date;
}

export interface PetRoutine {
  routineId: RoutineId;
  petId: PetId;
  ownerUserId: UserId;
  status: RoutineStatus;
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RoutineActivity {
  activityId: RoutineActivityId;
  routineId: RoutineId;
  petId: PetId;
  ownerUserId: UserId;
  title: string;
  type: RoutineType;
  notes?: string;
  status: RoutineStatus;
  schedule: RoutineSchedule;
  createdAt: Date;
  updatedAt: Date;
}

export interface RoutineOccurrence {
  occurrenceId: RoutineOccurrenceId;
  routineId: RoutineId;
  activityId: RoutineActivityId;
  petId: PetId;
  scheduledFor: Date;
  status: RoutineOccurrenceStatus;
  completedAt?: Date;
  skippedAt?: Date;
  notes?: string;
  completedByUserId?: UserId;
  createdAt: Date;
  updatedAt: Date;
}

export type RoutineDefinition = RoutineActivity;

export interface SharedRecord {
  token: SharedRecordToken;
  petId: PetId;
  ownerId: OwnerId;
  items: EventType[];
  expiresAt: Date;
  createdAt: Date;
  passwordHash?: string;
  passwordSalt?: string;
}

export interface CatalogEntry<T extends string> {
  code: T;
  label: string;
  description?: string;
}
