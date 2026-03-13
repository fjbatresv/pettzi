export enum PetSpecies {
  DOG = 'DOG',
  CAT = 'CAT',
  BIRD = 'BIRD',
  REPTILE = 'REPTILE',
  SNAKE = 'SNAKE',
  FROG = 'FROG',
  TURTLE = 'TURTLE',
  OTHER = 'OTHER',
}

export enum EventType {
  VACCINE = 'VACCINE',
  VET_VISIT = 'VET_VISIT',
  MEDICATION = 'MEDICATION',
  WEIGHT = 'WEIGHT',
  GROOMING = 'GROOMING',
  INCIDENT = 'INCIDENT',
  WALK = 'WALK',
  FEEDING = 'FEEDING',
  OTHER = 'OTHER',
}

export enum RoutineType {
  FEEDING = 'FEEDING',
  WALKING = 'WALKING',
  MEDICATION = 'MEDICATION',
  HYGIENE = 'HYGIENE',
  TRAINING = 'TRAINING',
  CUSTOM = 'CUSTOM',
}

export enum RoutineStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  ARCHIVED = 'ARCHIVED',
}

export enum RoutineOccurrenceStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  SKIPPED = 'SKIPPED',
  MISSED = 'MISSED',
}

export enum OwnerRole {
  PRIMARY = 'PRIMARY',
  SECONDARY = 'SECONDARY',
}
