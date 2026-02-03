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
    AFGHAN_HOUND: 'Afghan Hound',
    AIREDALE_TERRIER: 'Airedale Terrier',
    AKITA: 'Akita',
    ALASKAN_MALAMUTE: 'Alaskan Malamute',
    AMERICAN_BULLDOG: 'American Bulldog',
    AMERICAN_ESKIMO_DOG: 'American Eskimo Dog',
    AMERICAN_FOXHOUND: 'American Foxhound',
    AMERICAN_PIT_BULL_TERRIER: 'American Pit Bull Terrier',
    AMERICAN_STAFFORDSHIRE_TERRIER: 'American Staffordshire Terrier',
    AUSTRALIAN_CATTLE_DOG: 'Australian Cattle Dog',
    AUSTRALIAN_SHEPHERD: 'Australian Shepherd',
    AUSTRALIAN_TERRIER: 'Australian Terrier',
    BASENJI: 'Basenji',
    BASSET_HOUND: 'Basset Hound',
    BEAGLE: 'Beagle',
    BELGIAN_MALINOIS: 'Belgian Malinois',
    BERNESE_MOUNTAIN_DOG: 'Bernese Mountain Dog',
    BICHON_FRISE: 'Bichon Frise',
    BORDER_COLLIE: 'Border Collie',
    BORDER_TERRIER: 'Border Terrier',
    BOSTON_TERRIER: 'Boston Terrier',
    BOXER: 'Boxer',
    BRITTANY: 'Brittany',
    BULL_TERRIER: 'Bull Terrier',
    BULLDOG: 'Bulldog',
    BULLMASTIFF: 'Bullmastiff',
    CAIRN_TERRIER: 'Cairn Terrier',
    CANE_CORSO: 'Cane Corso',
    CAVALIER_KING_CHARLES_SPANIEL: 'Cavalier King Charles Spaniel',
    CHIHUAHUA: 'Chihuahua',
    CHOW_CHOW: 'Chow Chow',
    COCKER_SPANIEL: 'Cocker Spaniel',
    COLLIE: 'Collie',
    DACHSHUND: 'Dachshund',
    DALMATIAN: 'Dalmatian',
    DOBERMAN_PINSCHER: 'Doberman Pinscher',
    ENGLISH_SETTER: 'English Setter',
    ENGLISH_SPRINGER_SPANIEL: 'English Springer Spaniel',
    FRENCH_BULLDOG: 'French Bulldog',
    GERMAN_SHEPHERD_DOG: 'German Shepherd Dog',
    GERMAN_SHORTHAIRED_POINTER: 'German Shorthaired Pointer',
    GOLDEN: 'Golden Retriever',
    GREAT_DANE: 'Great Dane',
    GREYHOUND: 'Greyhound',
    HAVANESE: 'Havanese',
    JACK_RUSSELL_TERRIER: 'Jack Russell Terrier',
    LABRADOR: 'Labrador Retriever',
    MALTESE: 'Maltese',
    MINIATURE_PINSCHER: 'Miniature Pinscher',
    MINIATURE_SCHNAUZER: 'Miniature Schnauzer',
    MIX: 'Mixed / Other',
    NEWFOUNDLAND: 'Newfoundland',
    POMERANIAN: 'Pomeranian',
    POODLE: 'Poodle',
    PUG: 'Pug',
    ROTTWEILER: 'Rottweiler',
    SAINT_BERNARD: 'Saint Bernard',
    SAMOYED: 'Samoyed',
    SHETLAND_SHEEPDOG: 'Shetland Sheepdog',
    SHIBA_INU: 'Shiba Inu',
    SHIH_TZU: 'Shih Tzu',
    SIBERIAN_HUSKY: 'Siberian Husky',
    STAFFORDSHIRE_BULL_TERRIER: 'Staffordshire Bull Terrier',
    WEIMARANER: 'Weimaraner',
    WEST_HIGHLAND_WHITE_TERRIER: 'West Highland White Terrier',
    YORKSHIRE_TERRIER: 'Yorkshire Terrier',
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
    AFGHAN_HOUND: 'Lebrel afgano',
    AIREDALE_TERRIER: 'Terrier de Airedale',
    AKITA: 'Akita',
    ALASKAN_MALAMUTE: 'Malamute de Alaska',
    AMERICAN_BULLDOG: 'Bulldog americano',
    AMERICAN_ESKIMO_DOG: 'Perro esquimal americano',
    AMERICAN_FOXHOUND: 'Foxhound americano',
    AMERICAN_PIT_BULL_TERRIER: 'Pitbull americano',
    AMERICAN_STAFFORDSHIRE_TERRIER: 'Staffordshire terrier americano',
    AUSTRALIAN_CATTLE_DOG: 'Perro boyero australiano',
    AUSTRALIAN_SHEPHERD: 'Pastor australiano',
    AUSTRALIAN_TERRIER: 'Terrier australiano',
    BASENJI: 'Basenji',
    BASSET_HOUND: 'Basset hound',
    BEAGLE: 'Beagle',
    BELGIAN_MALINOIS: 'Pastor belga malinois',
    BERNESE_MOUNTAIN_DOG: 'Boyero de Berna',
    BICHON_FRISE: 'Bichon frise',
    BORDER_COLLIE: 'Border collie',
    BORDER_TERRIER: 'Terrier border',
    BOSTON_TERRIER: 'Terrier de Boston',
    BOXER: 'Boxer',
    BRITTANY: 'Brittany',
    BULL_TERRIER: 'Bull terrier',
    BULLDOG: 'Bulldog',
    BULLMASTIFF: 'Bullmastiff',
    CAIRN_TERRIER: 'Terrier cairn',
    CANE_CORSO: 'Cane corso',
    CAVALIER_KING_CHARLES_SPANIEL: 'Cavalier King Charles spaniel',
    CHIHUAHUA: 'Chihuahua',
    CHOW_CHOW: 'Chow chow',
    COCKER_SPANIEL: 'Cocker spaniel',
    COLLIE: 'Collie',
    DACHSHUND: 'Salchicha',
    DALMATIAN: 'Dalmata',
    DOBERMAN_PINSCHER: 'Doberman pinscher',
    ENGLISH_SETTER: 'Setter ingles',
    ENGLISH_SPRINGER_SPANIEL: 'Springer spaniel ingles',
    FRENCH_BULLDOG: 'Bulldog frances',
    GERMAN_SHEPHERD_DOG: 'Pastor aleman',
    GERMAN_SHORTHAIRED_POINTER: 'Pointer aleman de pelo corto',
    GOLDEN: 'Golden Retriever',
    GREAT_DANE: 'Gran danes',
    GREYHOUND: 'Galgo',
    HAVANESE: 'Bichon habanero',
    JACK_RUSSELL_TERRIER: 'Jack Russell terrier',
    LABRADOR: 'Labrador Retriever',
    MALTESE: 'Maltes',
    MINIATURE_PINSCHER: 'Pinscher miniatura',
    MINIATURE_SCHNAUZER: 'Schnauzer miniatura',
    MIX: 'Mestizo / Otro',
    NEWFOUNDLAND: 'Terranova',
    POMERANIAN: 'Pomerania',
    POODLE: 'Poodle',
    PUG: 'Pug',
    ROTTWEILER: 'Rottweiler',
    SAINT_BERNARD: 'San Bernardo',
    SAMOYED: 'Samoyedo',
    SHETLAND_SHEEPDOG: 'Pastor de Shetland',
    SHIBA_INU: 'Shiba inu',
    SHIH_TZU: 'Shih tzu',
    SIBERIAN_HUSKY: 'Husky siberiano',
    STAFFORDSHIRE_BULL_TERRIER: 'Staffordshire bull terrier',
    WEIMARANER: 'Weimaraner',
    WEST_HIGHLAND_WHITE_TERRIER: 'West Highland white terrier',
    YORKSHIRE_TERRIER: 'Yorkshire terrier',
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
