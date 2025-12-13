// libs/utils-dynamo/src/keys.ts

/**
 * Keys and helpers for PettziTable (Single Table Design).
 *
 * All PK/SK builders should be defined here to avoid string duplication
 * across lambdas.
 */

export type EntityType =
  | 'USER'
  | 'OWNER_PET'
  | 'PET'
  | 'PET_OWNER'
  | 'EVENT'
  | 'CATALOG_SPECIES'
  | 'CATALOG_BREED'
  | 'CATALOG_VACCINE';

/**
 * USER
 * ------------------------------------------------------------------ */
export const buildUserPk = (userId: string): string => `USER#${userId}`;
export const buildUserProfileSk = (): string => 'PROFILE';

export const buildUserPetSk = (petId: string): string => `PET#${petId}`;

/**
 * PET
 * ------------------------------------------------------------------ */
export const buildPetPk = (petId: string): string => `PET#${petId}`;
export const buildPetProfileSk = (): string => 'PROFILE';

export const buildPetOwnerSk = (userId: string): string => `OWNER#${userId}`;

/**
 * EVENTS
 * ------------------------------------------------------------------ */
/**
 * SK pattern: EVENT#<ISO_DATE>#<EVENT_ID>
 * Example: EVENT#2025-01-01T00:00:00.000Z#evt_123
 */
export const buildEventSk = (isoDate: string, eventId: string): string =>
  `EVENT#${isoDate}#${eventId}`;

/**
 * CATALOGS
 * ------------------------------------------------------------------ */
/**
 * Species catalog:
 *  PK = CATALOG#SPECIES
 *  SK = <SPECIES_CODE>
 */
export const buildCatalogSpeciesPk = (): string => 'CATALOG#SPECIES';
export const buildCatalogSpeciesSk = (speciesCode: string): string =>
  speciesCode;

/**
 * Breed catalog:
 *  PK = CATALOG#BREED#<SPECIES_CODE>
 *  SK = <BREED_CODE>
 */
export const buildCatalogBreedPk = (speciesCode: string): string =>
  `CATALOG#BREED#${speciesCode}`;
export const buildCatalogBreedSk = (breedCode: string): string => breedCode;

/**
 * Vaccine catalog:
 *  PK = CATALOG#VACCINE
 *  SK = <VACCINE_CODE>
 */
export const buildCatalogVaccinePk = (): string => 'CATALOG#VACCINE';
export const buildCatalogVaccineSk = (vaccineCode: string): string =>
  vaccineCode;

/**
 * REMINDERS (GSI1)
 * ------------------------------------------------------------------ */
/**
 * GSI1PK for vaccination reminders:
 *  GSI1PK = REMINDER#VACCINATION
 *  GSI1SK = <nextDueDate>#PET#<petId>#<eventId>
 */
export const buildReminderVaccinationGsiPk = (): string =>
  'REMINDER#VACCINATION';

export const buildReminderVaccinationGsiSk = (
  nextDueIsoDate: string,
  petId: string,
  eventId: string,
): string => `${nextDueIsoDate}#PET#${petId}#${eventId}`;