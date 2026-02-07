import {
  CatalogBreedResponseItem,
  CatalogLocale,
  CatalogSpeciesResponseItem,
  CatalogVaccineResponseItem,
} from './catalogs.types';
import {
  listBreedItems,
  listSpeciesItems,
  listVaccineItems,
} from './catalogs.repository';

export class InvalidSpeciesError extends Error {
  constructor() {
    super('Invalid species');
    this.name = 'InvalidSpeciesError';
  }
}

const resolveLabel = (
  labels: { en?: string; es?: string },
  locale: CatalogLocale
) => {
  const preferred = labels[locale];
  return preferred || labels.en || labels.es || '';
};

const sortByLabel = <T extends { label: string }>(
  items: T[],
  locale: CatalogLocale
) => [...items].sort((a, b) => a.label.localeCompare(b.label, locale));

export const getSpeciesCatalog = async (
  locale: CatalogLocale
): Promise<CatalogSpeciesResponseItem[]> => {
  const items = await listSpeciesItems();
  const mapped = items.map((item) => ({
    code: item.code,
    label: resolveLabel(item.labels, locale),
    eventTypes: item.eventTypes ?? [],
    isActive: item.isActive,
  }));

  return sortByLabel(mapped, locale);
};

export const getBreedsCatalog = async (
  locale: CatalogLocale,
  speciesFilter?: string,
  includeDeprecated = false
): Promise<CatalogBreedResponseItem[]> => {
  const speciesItems = await listSpeciesItems();
  const speciesCodes = new Set(speciesItems.map((item) => item.code));

  if (speciesFilter && !speciesCodes.has(speciesFilter)) {
    throw new InvalidSpeciesError();
  }

  const speciesToLoad = speciesFilter
    ? [speciesFilter]
    : Array.from(speciesCodes);

  const results = await Promise.all(
    speciesToLoad.map(async (speciesCode) => {
      const list = await listBreedItems(speciesCode);
      return list.map((item) => ({
        code: item.code,
        label: resolveLabel(item.labels, locale),
        speciesId: item.speciesCode || speciesCode,
        weightKg: item.weightKg,
        deprecated: item.deprecated,
      }));
    })
  );

  const flattened = results.flat();
  const filtered = includeDeprecated
    ? flattened
    : flattened.filter((item) => !item.deprecated);

  return sortByLabel(filtered, locale);
};

export const getVaccinesCatalog = async (
  locale: CatalogLocale,
  speciesFilter?: string
): Promise<CatalogVaccineResponseItem[]> => {
  if (speciesFilter) {
    const speciesItems = await listSpeciesItems();
    const speciesCodes = new Set(speciesItems.map((item) => item.code));
    if (!speciesCodes.has(speciesFilter)) {
      throw new InvalidSpeciesError();
    }
  }

  const vaccines = await listVaccineItems();
  const filtered = speciesFilter
    ? vaccines.filter(
        (item) => !item.speciesCode || item.speciesCode === speciesFilter
      )
    : vaccines;

  const mapped = filtered.map((item) => ({
    code: item.code,
    label: resolveLabel(item.labels, locale),
    speciesId: item.speciesCode,
    recommendedIntervalDays: item.recommendedIntervalDays,
  }));

  return sortByLabel(mapped, locale);
};
