import { CatalogEntry } from './types';
import { EventType, PetSpecies } from './enums';

export const catalogSpecies: CatalogEntry<PetSpecies>[] = [
  { code: PetSpecies.DOG, label: 'Dog' },
  { code: PetSpecies.CAT, label: 'Cat' },
  { code: PetSpecies.BIRD, label: 'Bird' },
  { code: PetSpecies.REPTILE, label: 'Reptile' },
  { code: PetSpecies.OTHER, label: 'Other' },
];

export const catalogBreeds: Record<PetSpecies, CatalogEntry<string>[]> = {
  [PetSpecies.DOG]: [
    { code: 'LABRADOR', label: 'Labrador Retriever' },
    { code: 'GOLDEN', label: 'Golden Retriever' },
    { code: 'MIX', label: 'Mixed / Other' },
  ],
  [PetSpecies.CAT]: [
    { code: 'SIAMESE', label: 'Siamese' },
    { code: 'PERSIAN', label: 'Persian' },
    { code: 'DOMESTIC_SHORTHAIR', label: 'Domestic Shorthair' },
  ],
  [PetSpecies.BIRD]: [
    { code: 'PARROT', label: 'Parrot' },
    { code: 'CANARY', label: 'Canary' },
  ],
  [PetSpecies.REPTILE]: [
    { code: 'IGUANA', label: 'Iguana' },
    { code: 'TURTLE', label: 'Turtle' },
  ],
  [PetSpecies.OTHER]: [{ code: 'OTHER', label: 'Other' }],
};

export const catalogEventTypes: CatalogEntry<EventType>[] = [
  { code: EventType.VACCINE, label: 'Vaccine' },
  { code: EventType.VET_VISIT, label: 'Vet visit' },
  { code: EventType.GROOMING, label: 'Grooming' },
  { code: EventType.OTHER, label: 'Other' },
];

export interface VaccineDefinition extends CatalogEntry<string> {
  recommendedIntervalDays?: number;
}

export const catalogVaccines: VaccineDefinition[] = [
  { code: 'RABIES', label: 'Rabies', recommendedIntervalDays: 365 },
  { code: 'DISTEMPER', label: 'Distemper (DHPP)', recommendedIntervalDays: 365 },
  { code: 'BORDETELLA', label: 'Bordetella', recommendedIntervalDays: 180 },
  { code: 'FVRCP', label: 'FVRCP (cats)', recommendedIntervalDays: 365 },
  { code: 'OTHER', label: 'Other / custom' },
];
