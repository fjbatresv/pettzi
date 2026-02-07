export type CatalogLocale = 'es' | 'en';

export type CatalogLabels = {
  en: string;
  es: string;
};

export type WeightRange = {
  min?: number;
  max?: number;
};

export type BreedWeightKg = {
  male?: WeightRange;
  female?: WeightRange;
};

export interface CatalogSpeciesItem {
  code: string;
  labels: CatalogLabels;
  eventTypes: string[];
  isActive?: boolean;
}

export interface CatalogBreedItem {
  code: string;
  speciesCode: string;
  labels: CatalogLabels;
  weightKg?: BreedWeightKg;
  deprecated?: boolean;
}

export interface CatalogVaccineItem {
  code: string;
  labels: CatalogLabels;
  speciesCode?: string;
  recommendedIntervalDays?: number;
}

export interface CatalogSpeciesResponseItem {
  code: string;
  label: string;
  eventTypes: string[];
  isActive?: boolean;
}

export interface CatalogBreedResponseItem {
  code: string;
  label: string;
  speciesId: string;
  weightKg?: BreedWeightKg;
  deprecated?: boolean;
}

export interface CatalogVaccineResponseItem {
  code: string;
  label: string;
  speciesId?: string;
  recommendedIntervalDays?: number;
}
