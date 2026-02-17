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
    code: 'MAINE_COON',
    speciesCode: PetSpecies.CAT,
    labels: { en: 'Maine Coon', es: 'Maine coon' },
  },
  {
    code: 'RAGDOLL',
    speciesCode: PetSpecies.CAT,
    labels: { en: 'Ragdoll', es: 'Ragdoll' },
  },
  {
    code: 'BENGAL',
    speciesCode: PetSpecies.CAT,
    labels: { en: 'Bengal', es: 'Bengali' },
  },
  {
    code: 'BRITISH_SHORTHAIR',
    speciesCode: PetSpecies.CAT,
    labels: { en: 'British Shorthair', es: 'Britanico de pelo corto' },
  },
  {
    code: 'SPHYNX',
    speciesCode: PetSpecies.CAT,
    labels: { en: 'Sphynx', es: 'Esfinge' },
  },
  {
    code: 'ABYSSINIAN',
    speciesCode: PetSpecies.CAT,
    labels: { en: 'Abyssinian', es: 'Abisinio' },
  },
  {
    code: 'RUSSIAN_BLUE',
    speciesCode: PetSpecies.CAT,
    labels: { en: 'Russian Blue', es: 'Azul ruso' },
  },
  {
    code: 'SCOTTISH_FOLD',
    speciesCode: PetSpecies.CAT,
    labels: { en: 'Scottish Fold', es: 'Scottish fold' },
  },
  {
    code: 'NORWEGIAN_FOREST',
    speciesCode: PetSpecies.CAT,
    labels: { en: 'Norwegian Forest', es: 'Bosque noruego' },
  },
  {
    code: 'BIRMAN',
    speciesCode: PetSpecies.CAT,
    labels: { en: 'Birman', es: 'Birmano' },
  },
  {
    code: 'AMERICAN_SHORTHAIR',
    speciesCode: PetSpecies.CAT,
    labels: { en: 'American Shorthair', es: 'Americano de pelo corto' },
  },
  {
    code: 'SIBERIAN_CAT',
    speciesCode: PetSpecies.CAT,
    labels: { en: 'Siberian', es: 'Siberiano' },
  },
  {
    code: 'SAVANNAH',
    speciesCode: PetSpecies.CAT,
    labels: { en: 'Savannah', es: 'Savannah' },
  },
  {
    code: 'ORIENTAL_SHORTHAIR',
    speciesCode: PetSpecies.CAT,
    labels: { en: 'Oriental Shorthair', es: 'Oriental de pelo corto' },
  },
  {
    code: 'DEVON_REX',
    speciesCode: PetSpecies.CAT,
    labels: { en: 'Devon Rex', es: 'Devon rex' },
  },
  {
    code: 'CORNISH_REX',
    speciesCode: PetSpecies.CAT,
    labels: { en: 'Cornish Rex', es: 'Cornish rex' },
  },
  {
    code: 'TURKISH_ANGORA',
    speciesCode: PetSpecies.CAT,
    labels: { en: 'Turkish Angora', es: 'Angora turco' },
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
    code: 'COCKATIEL',
    speciesCode: PetSpecies.BIRD,
    labels: { en: 'Cockatiel', es: 'Cacatua ninfa' },
  },
  {
    code: 'LOVEBIRD',
    speciesCode: PetSpecies.BIRD,
    labels: { en: 'Lovebird', es: 'Inseparable' },
  },
  {
    code: 'BUDGERIGAR',
    speciesCode: PetSpecies.BIRD,
    labels: { en: 'Budgerigar', es: 'Periquito australiano' },
  },
  {
    code: 'MACAW',
    speciesCode: PetSpecies.BIRD,
    labels: { en: 'Macaw', es: 'Guacamaya' },
  },
  {
    code: 'COCKATOO',
    speciesCode: PetSpecies.BIRD,
    labels: { en: 'Cockatoo', es: 'Cacatua' },
  },
  {
    code: 'FINCH',
    speciesCode: PetSpecies.BIRD,
    labels: { en: 'Finch', es: 'Pinzon' },
  },
  {
    code: 'CONURE',
    speciesCode: PetSpecies.BIRD,
    labels: { en: 'Conure', es: 'Conuro' },
  },
  {
    code: 'AFRICAN_GREY',
    speciesCode: PetSpecies.BIRD,
    labels: { en: 'African Grey', es: 'Loro gris africano' },
  },
  {
    code: 'BALL_PYTHON',
    speciesCode: PetSpecies.SNAKE,
    labels: { en: 'Ball Python', es: 'Piton bola' },
  },
  {
    code: 'CORN_SNAKE',
    speciesCode: PetSpecies.SNAKE,
    labels: { en: 'Corn Snake', es: 'Serpiente del maiz' },
  },
  {
    code: 'KING_SNAKE',
    speciesCode: PetSpecies.SNAKE,
    labels: { en: 'King Snake', es: 'Serpiente rey' },
  },
  {
    code: 'BOA_CONSTRICTOR',
    speciesCode: PetSpecies.SNAKE,
    labels: { en: 'Boa Constrictor', es: 'Boa constrictora' },
  },
  {
    code: 'MILK_SNAKE',
    speciesCode: PetSpecies.SNAKE,
    labels: { en: 'Milk Snake', es: 'Serpiente de leche' },
  },
  {
    code: 'GARTER_SNAKE',
    speciesCode: PetSpecies.SNAKE,
    labels: { en: 'Garter Snake', es: 'Serpiente de liga' },
  },
  {
    code: 'ROSY_BOA',
    speciesCode: PetSpecies.SNAKE,
    labels: { en: 'Rosy Boa', es: 'Boa rosada' },
  },
  {
    code: 'HOGNOSE_SNAKE',
    speciesCode: PetSpecies.SNAKE,
    labels: { en: 'Hognose Snake', es: 'Serpiente hocico de cerdo' },
  },
  {
    code: 'RAT_SNAKE',
    speciesCode: PetSpecies.SNAKE,
    labels: { en: 'Rat Snake', es: 'Serpiente rata' },
  },
  {
    code: 'CARPET_PYTHON',
    speciesCode: PetSpecies.SNAKE,
    labels: { en: 'Carpet Python', es: 'Piton alfombra' },
  },
  {
    code: 'PACMAN_FROG',
    speciesCode: PetSpecies.FROG,
    labels: { en: 'Pacman Frog', es: 'Rana pacman' },
  },
  {
    code: 'TREE_FROG',
    speciesCode: PetSpecies.FROG,
    labels: { en: 'Tree Frog', es: 'Rana arboricola' },
  },
  {
    code: 'DART_FROG',
    speciesCode: PetSpecies.FROG,
    labels: { en: 'Dart Frog', es: 'Rana dardo' },
  },
  {
    code: 'BULLFROG',
    speciesCode: PetSpecies.FROG,
    labels: { en: 'Bullfrog', es: 'Rana toro' },
  },
  {
    code: 'WHITES_TREE_FROG',
    speciesCode: PetSpecies.FROG,
    labels: { en: "White's Tree Frog", es: 'Rana de arbol de White' },
  },
  {
    code: 'LEOPARD_FROG',
    speciesCode: PetSpecies.FROG,
    labels: { en: 'Leopard Frog', es: 'Rana leopardo' },
  },
  {
    code: 'TOMATO_FROG',
    speciesCode: PetSpecies.FROG,
    labels: { en: 'Tomato Frog', es: 'Rana tomate' },
  },
  {
    code: 'HORNED_FROG',
    speciesCode: PetSpecies.FROG,
    labels: { en: 'Horned Frog', es: 'Rana cornuda' },
  },
  {
    code: 'FIRE_BELLIED_TOAD',
    speciesCode: PetSpecies.FROG,
    labels: { en: 'Fire Bellied Toad', es: 'Sapo vientre de fuego' },
  },
  {
    code: 'AFRICAN_DWARF_FROG',
    speciesCode: PetSpecies.FROG,
    labels: { en: 'African Dwarf Frog', es: 'Rana enana africana' },
  },
  {
    code: 'RED_EARED_SLIDER',
    speciesCode: PetSpecies.TURTLE,
    labels: { en: 'Red Eared Slider', es: 'Tortuga de orejas rojas' },
  },
  {
    code: 'PAINTED_TURTLE',
    speciesCode: PetSpecies.TURTLE,
    labels: { en: 'Painted Turtle', es: 'Tortuga pintada' },
  },
  {
    code: 'MUSK_TURTLE',
    speciesCode: PetSpecies.TURTLE,
    labels: { en: 'Musk Turtle', es: 'Tortuga almizclera' },
  },
  {
    code: 'MAP_TURTLE',
    speciesCode: PetSpecies.TURTLE,
    labels: { en: 'Map Turtle', es: 'Tortuga mapa' },
  },
  {
    code: 'BOX_TURTLE',
    speciesCode: PetSpecies.TURTLE,
    labels: { en: 'Box Turtle', es: 'Tortuga de caja' },
  },
  {
    code: 'SNAPPING_TURTLE',
    speciesCode: PetSpecies.TURTLE,
    labels: { en: 'Snapping Turtle', es: 'Tortuga mordedora' },
  },
  {
    code: 'SULCATA_TORTOISE',
    speciesCode: PetSpecies.TURTLE,
    labels: { en: 'Sulcata Tortoise', es: 'Tortuga sulcata' },
  },
  {
    code: 'RUSSIAN_TORTOISE',
    speciesCode: PetSpecies.TURTLE,
    labels: { en: 'Russian Tortoise', es: 'Tortuga rusa' },
  },
  {
    code: 'GREEK_TORTOISE',
    speciesCode: PetSpecies.TURTLE,
    labels: { en: 'Greek Tortoise', es: 'Tortuga griega' },
  },
  {
    code: 'LEOPARD_TORTOISE',
    speciesCode: PetSpecies.TURTLE,
    labels: { en: 'Leopard Tortoise', es: 'Tortuga leopardo' },
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
  // Vaccines catalog intentionally disabled for now.
];
