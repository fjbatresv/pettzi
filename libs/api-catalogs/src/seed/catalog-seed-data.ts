import { EventType, PetSpecies } from '@pettzi/domain-model';
import {
  CatalogBreedItem,
  CatalogSpeciesItem,
  CatalogVaccineItem,
} from '../catalogs.types';

const allEventTypes = Object.values(EventType);

export const speciesSeed: CatalogSpeciesItem[] = [
  {
    code: PetSpecies.DOG,
    labels: { en: 'Dog', es: 'Perro' },
    eventTypes: allEventTypes,
  },
  {
    code: PetSpecies.CAT,
    labels: { en: 'Cat', es: 'Gato' },
    eventTypes: allEventTypes,
  },
  {
    code: PetSpecies.BIRD,
    labels: { en: 'Bird', es: 'Ave' },
    eventTypes: allEventTypes,
  },
  {
    code: PetSpecies.REPTILE,
    labels: { en: 'Reptile', es: 'Reptil' },
    eventTypes: allEventTypes,
  },
  {
    code: PetSpecies.SNAKE,
    labels: { en: 'Snake', es: 'Serpiente' },
    eventTypes: allEventTypes,
  },
  {
    code: PetSpecies.FROG,
    labels: { en: 'Frog', es: 'Rana' },
    eventTypes: allEventTypes,
  },
  {
    code: PetSpecies.TURTLE,
    labels: { en: 'Turtle', es: 'Tortuga' },
    eventTypes: allEventTypes,
  },
  {
    code: PetSpecies.OTHER,
    labels: { en: 'Other', es: 'Otro' },
    eventTypes: allEventTypes,
  },
];

export const breedsSeed: CatalogBreedItem[] = [
  {
    code: 'AFGHAN_HOUND',
    speciesCode: PetSpecies.DOG,
    labels: { en: 'Afghan Hound', es: 'Lebrel afgano' },
  },
  {
    code: 'AIREDALE_TERRIER',
    speciesCode: PetSpecies.DOG,
    labels: { en: 'Airedale Terrier', es: 'Terrier de Airedale' },
  },
  {
    code: 'AKITA',
    speciesCode: PetSpecies.DOG,
    labels: { en: 'Akita', es: 'Akita' },
  },
  {
    code: 'ALASKAN_MALAMUTE',
    speciesCode: PetSpecies.DOG,
    labels: { en: 'Alaskan Malamute', es: 'Malamute de Alaska' },
  },
  {
    code: 'AMERICAN_BULLDOG',
    speciesCode: PetSpecies.DOG,
    labels: { en: 'American Bulldog', es: 'Bulldog americano' },
  },
  {
    code: 'AMERICAN_ESKIMO_DOG',
    speciesCode: PetSpecies.DOG,
    labels: { en: 'American Eskimo Dog', es: 'Perro esquimal americano' },
  },
  {
    code: 'AMERICAN_FOXHOUND',
    speciesCode: PetSpecies.DOG,
    labels: { en: 'American Foxhound', es: 'Foxhound americano' },
  },
  {
    code: 'AMERICAN_PIT_BULL_TERRIER',
    speciesCode: PetSpecies.DOG,
    labels: { en: 'American Pit Bull Terrier', es: 'Pitbull americano' },
  },
  {
    code: 'AMERICAN_STAFFORDSHIRE_TERRIER',
    speciesCode: PetSpecies.DOG,
    labels: {
      en: 'American Staffordshire Terrier',
      es: 'Staffordshire terrier americano',
    },
  },
  {
    code: 'AUSTRALIAN_CATTLE_DOG',
    speciesCode: PetSpecies.DOG,
    labels: { en: 'Australian Cattle Dog', es: 'Perro boyero australiano' },
  },
  {
    code: 'AUSTRALIAN_SHEPHERD',
    speciesCode: PetSpecies.DOG,
    labels: { en: 'Australian Shepherd', es: 'Pastor australiano' },
  },
  {
    code: 'AUSTRALIAN_TERRIER',
    speciesCode: PetSpecies.DOG,
    labels: { en: 'Australian Terrier', es: 'Terrier australiano' },
  },
  {
    code: 'BASENJI',
    speciesCode: PetSpecies.DOG,
    labels: { en: 'Basenji', es: 'Basenji' },
  },
  {
    code: 'BASSET_HOUND',
    speciesCode: PetSpecies.DOG,
    labels: { en: 'Basset Hound', es: 'Basset hound' },
  },
  {
    code: 'BEAGLE',
    speciesCode: PetSpecies.DOG,
    labels: { en: 'Beagle', es: 'Beagle' },
  },
  {
    code: 'BELGIAN_MALINOIS',
    speciesCode: PetSpecies.DOG,
    labels: { en: 'Belgian Malinois', es: 'Pastor belga malinois' },
  },
  {
    code: 'BERNESE_MOUNTAIN_DOG',
    speciesCode: PetSpecies.DOG,
    labels: { en: 'Bernese Mountain Dog', es: 'Boyero de Berna' },
  },
  {
    code: 'BICHON_FRISE',
    speciesCode: PetSpecies.DOG,
    labels: { en: 'Bichon Frise', es: 'Bichon frise' },
  },
  {
    code: 'BORDER_COLLIE',
    speciesCode: PetSpecies.DOG,
    labels: { en: 'Border Collie', es: 'Border collie' },
  },
  {
    code: 'BORDER_TERRIER',
    speciesCode: PetSpecies.DOG,
    labels: { en: 'Border Terrier', es: 'Terrier border' },
  },
  {
    code: 'BOSTON_TERRIER',
    speciesCode: PetSpecies.DOG,
    labels: { en: 'Boston Terrier', es: 'Terrier de Boston' },
  },
  {
    code: 'BOXER',
    speciesCode: PetSpecies.DOG,
    labels: { en: 'Boxer', es: 'Boxer' },
  },
  {
    code: 'BRITTANY',
    speciesCode: PetSpecies.DOG,
    labels: { en: 'Brittany', es: 'Brittany' },
  },
  {
    code: 'BULL_TERRIER',
    speciesCode: PetSpecies.DOG,
    labels: { en: 'Bull Terrier', es: 'Bull terrier' },
  },
  {
    code: 'BULLDOG',
    speciesCode: PetSpecies.DOG,
    labels: { en: 'Bulldog', es: 'Bulldog' },
  },
  {
    code: 'BULLMASTIFF',
    speciesCode: PetSpecies.DOG,
    labels: { en: 'Bullmastiff', es: 'Bullmastiff' },
  },
  {
    code: 'CAIRN_TERRIER',
    speciesCode: PetSpecies.DOG,
    labels: { en: 'Cairn Terrier', es: 'Terrier cairn' },
  },
  {
    code: 'CANE_CORSO',
    speciesCode: PetSpecies.DOG,
    labels: { en: 'Cane Corso', es: 'Cane corso' },
  },
  {
    code: 'CAVALIER_KING_CHARLES_SPANIEL',
    speciesCode: PetSpecies.DOG,
    labels: {
      en: 'Cavalier King Charles Spaniel',
      es: 'Cavalier King Charles spaniel',
    },
  },
  {
    code: 'CHIHUAHUA',
    speciesCode: PetSpecies.DOG,
    labels: { en: 'Chihuahua', es: 'Chihuahua' },
  },
  {
    code: 'CHOW_CHOW',
    speciesCode: PetSpecies.DOG,
    labels: { en: 'Chow Chow', es: 'Chow chow' },
  },
  {
    code: 'COCKER_SPANIEL',
    speciesCode: PetSpecies.DOG,
    labels: { en: 'Cocker Spaniel', es: 'Cocker spaniel' },
  },
  {
    code: 'COLLIE',
    speciesCode: PetSpecies.DOG,
    labels: { en: 'Collie', es: 'Collie' },
  },
  {
    code: 'DACHSHUND',
    speciesCode: PetSpecies.DOG,
    labels: { en: 'Dachshund', es: 'Salchicha' },
  },
  {
    code: 'DALMATIAN',
    speciesCode: PetSpecies.DOG,
    labels: { en: 'Dalmatian', es: 'Dalmata' },
  },
  {
    code: 'DOBERMAN_PINSCHER',
    speciesCode: PetSpecies.DOG,
    labels: { en: 'Doberman Pinscher', es: 'Doberman pinscher' },
  },
  {
    code: 'ENGLISH_SETTER',
    speciesCode: PetSpecies.DOG,
    labels: { en: 'English Setter', es: 'Setter ingles' },
  },
  {
    code: 'ENGLISH_SPRINGER_SPANIEL',
    speciesCode: PetSpecies.DOG,
    labels: {
      en: 'English Springer Spaniel',
      es: 'Springer spaniel ingles',
    },
  },
  {
    code: 'FRENCH_BULLDOG',
    speciesCode: PetSpecies.DOG,
    labels: { en: 'French Bulldog', es: 'Bulldog frances' },
  },
  {
    code: 'GERMAN_SHEPHERD_DOG',
    speciesCode: PetSpecies.DOG,
    labels: { en: 'German Shepherd Dog', es: 'Pastor aleman' },
  },
  {
    code: 'GERMAN_SHORTHAIRED_POINTER',
    speciesCode: PetSpecies.DOG,
    labels: {
      en: 'German Shorthaired Pointer',
      es: 'Pointer aleman de pelo corto',
    },
  },
  {
    code: 'GOLDEN',
    speciesCode: PetSpecies.DOG,
    labels: { en: 'Golden Retriever', es: 'Golden Retriever' },
  },
  {
    code: 'GREAT_DANE',
    speciesCode: PetSpecies.DOG,
    labels: { en: 'Great Dane', es: 'Gran danes' },
  },
  {
    code: 'GREYHOUND',
    speciesCode: PetSpecies.DOG,
    labels: { en: 'Greyhound', es: 'Galgo' },
  },
  {
    code: 'HAVANESE',
    speciesCode: PetSpecies.DOG,
    labels: { en: 'Havanese', es: 'Bichon habanero' },
  },
  {
    code: 'JACK_RUSSELL_TERRIER',
    speciesCode: PetSpecies.DOG,
    labels: { en: 'Jack Russell Terrier', es: 'Jack Russell terrier' },
  },
  {
    code: 'LABRADOR',
    speciesCode: PetSpecies.DOG,
    labels: { en: 'Labrador Retriever', es: 'Labrador Retriever' },
  },
  {
    code: 'MALTESE',
    speciesCode: PetSpecies.DOG,
    labels: { en: 'Maltese', es: 'Maltes' },
  },
  {
    code: 'MINIATURE_PINSCHER',
    speciesCode: PetSpecies.DOG,
    labels: { en: 'Miniature Pinscher', es: 'Pinscher miniatura' },
  },
  {
    code: 'MINIATURE_SCHNAUZER',
    speciesCode: PetSpecies.DOG,
    labels: { en: 'Miniature Schnauzer', es: 'Schnauzer miniatura' },
  },
  {
    code: 'MIX',
    speciesCode: PetSpecies.DOG,
    labels: { en: 'Mixed / Other', es: 'Mestizo / Otro' },
  },
  {
    code: 'NEWFOUNDLAND',
    speciesCode: PetSpecies.DOG,
    labels: { en: 'Newfoundland', es: 'Terranova' },
  },
  {
    code: 'POMERANIAN',
    speciesCode: PetSpecies.DOG,
    labels: { en: 'Pomeranian', es: 'Pomerania' },
  },
  {
    code: 'POODLE',
    speciesCode: PetSpecies.DOG,
    labels: { en: 'Poodle', es: 'Poodle' },
  },
  {
    code: 'PUG',
    speciesCode: PetSpecies.DOG,
    labels: { en: 'Pug', es: 'Pug' },
  },
  {
    code: 'ROTTWEILER',
    speciesCode: PetSpecies.DOG,
    labels: { en: 'Rottweiler', es: 'Rottweiler' },
  },
  {
    code: 'SAINT_BERNARD',
    speciesCode: PetSpecies.DOG,
    labels: { en: 'Saint Bernard', es: 'San Bernardo' },
  },
  {
    code: 'SAMOYED',
    speciesCode: PetSpecies.DOG,
    labels: { en: 'Samoyed', es: 'Samoyedo' },
  },
  {
    code: 'SHETLAND_SHEEPDOG',
    speciesCode: PetSpecies.DOG,
    labels: { en: 'Shetland Sheepdog', es: 'Pastor de Shetland' },
  },
  {
    code: 'SHIBA_INU',
    speciesCode: PetSpecies.DOG,
    labels: { en: 'Shiba Inu', es: 'Shiba inu' },
  },
  {
    code: 'SHIH_TZU',
    speciesCode: PetSpecies.DOG,
    labels: { en: 'Shih Tzu', es: 'Shih tzu' },
  },
  {
    code: 'SIBERIAN_HUSKY',
    speciesCode: PetSpecies.DOG,
    labels: { en: 'Siberian Husky', es: 'Husky siberiano' },
  },
  {
    code: 'STAFFORDSHIRE_BULL_TERRIER',
    speciesCode: PetSpecies.DOG,
    labels: {
      en: 'Staffordshire Bull Terrier',
      es: 'Staffordshire bull terrier',
    },
  },
  {
    code: 'WEIMARANER',
    speciesCode: PetSpecies.DOG,
    labels: { en: 'Weimaraner', es: 'Weimaraner' },
  },
  {
    code: 'WEST_HIGHLAND_WHITE_TERRIER',
    speciesCode: PetSpecies.DOG,
    labels: {
      en: 'West Highland White Terrier',
      es: 'West Highland white terrier',
    },
  },
  {
    code: 'YORKSHIRE_TERRIER',
    speciesCode: PetSpecies.DOG,
    labels: { en: 'Yorkshire Terrier', es: 'Yorkshire terrier' },
  },
  {
    code: 'SIAMESE',
    speciesCode: PetSpecies.CAT,
    labels: { en: 'Siamese', es: 'Siames' },
  },
  {
    code: 'PERSIAN',
    speciesCode: PetSpecies.CAT,
    labels: { en: 'Persian', es: 'Persa' },
  },
  {
    code: 'DOMESTIC_SHORTHAIR',
    speciesCode: PetSpecies.CAT,
    labels: { en: 'Domestic Short hair', es: 'Pelo corto domestico' },
  },
  {
    code: 'PARROT',
    speciesCode: PetSpecies.BIRD,
    labels: { en: 'Parrot', es: 'Loro' },
  },
  {
    code: 'CANARY',
    speciesCode: PetSpecies.BIRD,
    labels: { en: 'Canary', es: 'Canario' },
  },
  {
    code: 'IGUANA',
    speciesCode: PetSpecies.REPTILE,
    labels: { en: 'Iguana', es: 'Iguana' },
    deprecated: true,
  },
  {
    code: 'TURTLE',
    speciesCode: PetSpecies.REPTILE,
    labels: { en: 'Turtle', es: 'Tortuga' },
    deprecated: true,
  },
  {
    code: 'OTHER',
    speciesCode: PetSpecies.OTHER,
    labels: { en: 'Other', es: 'Otro' },
  },
];

export const vaccinesSeed: CatalogVaccineItem[] = [
  {
    code: 'RABIES',
    labels: { en: 'Rabies', es: 'Rabia' },
    recommendedIntervalDays: 365,
  },
  {
    code: 'DISTEMPER',
    labels: { en: 'Distemper (DHPP)', es: 'Moquillo (DHPP)' },
    recommendedIntervalDays: 365,
  },
  {
    code: 'BORDETELLA',
    labels: { en: 'Bordetella', es: 'Bordetella' },
    recommendedIntervalDays: 180,
  },
  {
    code: 'FVRCP',
    labels: { en: 'FVRCP (cats)', es: 'FVRCP (gatos)' },
    recommendedIntervalDays: 365,
    speciesCode: PetSpecies.CAT,
  },
  {
    code: 'OTHER',
    labels: { en: 'Other / custom', es: 'Otra / personalizada' },
  },
];
