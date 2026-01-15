import { catalogBreeds, catalogSpecies, catalogVaccines, PetSpecies } from '@pettzi/domain-model';
import type { CatalogLocale } from './common';

const speciesLabels: Record<CatalogLocale, Record<PetSpecies, string>> = {
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

const breedLabels: Record<CatalogLocale, Record<string, string>> = {
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

const vaccineLabels: Record<CatalogLocale, Record<string, string>> = {
  en: {
    RABIES: 'Rabies',
    DISTEMPER: 'Distemper (DHPP)',
    BORDETELLA: 'Bordetella',
    FVRCP: 'FVRCP (cats)',
    OTHER: 'Other / custom',
  },
  es: {
    RABIES: 'Rabia',
    DISTEMPER: 'Moquillo (DHPP)',
    BORDETELLA: 'Bordetella',
    FVRCP: 'FVRCP (gatos)',
    OTHER: 'Otra / personalizada',
  },
};

const localizeLabel = (
  locale: CatalogLocale,
  code: string,
  fallback: string,
  labels: Record<CatalogLocale, Record<string, string>>
) => labels[locale][code] ?? fallback;

export const getLocalizedSpecies = (locale: CatalogLocale) =>
  catalogSpecies.map((item) => ({
    ...item,
    label: localizeLabel(locale, item.code, item.label, speciesLabels),
  }));

export const getLocalizedBreeds = (
  locale: CatalogLocale,
  speciesFilter?: PetSpecies
) => {
  const breeds = speciesFilter
    ? catalogBreeds[speciesFilter] ?? []
    : Object.entries(catalogBreeds).flatMap(([species, list]) =>
        list.map((b) => ({ ...b, speciesId: species }))
      );

  return breeds.map((item) => ({
    ...item,
    label: localizeLabel(locale, item.code, item.label, breedLabels),
  }));
};

export const getLocalizedVaccines = (
  locale: CatalogLocale,
  speciesFilter?: PetSpecies
) => {
  const vaccines = speciesFilter
    ? catalogVaccines.filter((v) => {
        const speciesId = (v as { speciesId?: string }).speciesId;
        return !speciesId || speciesId === speciesFilter;
      })
    : catalogVaccines;

  return vaccines.map((item) => ({
    ...item,
    label: localizeLabel(locale, item.code, item.label, vaccineLabels),
  }));
};
