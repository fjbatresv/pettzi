import {
  getBreedsCatalog,
  getSpeciesCatalog,
  getVaccinesCatalog,
  InvalidSpeciesError,
} from './catalogs.service';
import {
  listBreedItems,
  listSpeciesItems,
  listVaccineItems,
} from './catalogs.repository';

jest.mock('./catalogs.repository', () => ({
  listSpeciesItems: jest.fn(),
  listBreedItems: jest.fn(),
  listVaccineItems: jest.fn(),
}));

const speciesItems = [
  {
    code: 'DOG',
    labels: { en: 'Dog', es: 'Perro' },
    eventTypes: ['VACCINE', 'WALK'],
  },
  {
    code: 'CAT',
    labels: { en: 'Cat', es: 'Gato' },
    eventTypes: ['VACCINE'],
  },
];

describe('catalogs.service', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('localizes and sorts species', async () => {
    (listSpeciesItems as jest.Mock).mockResolvedValueOnce(speciesItems);
    const result = await getSpeciesCatalog('es');
    expect(result).toEqual([
      { code: 'CAT', label: 'Gato', eventTypes: ['VACCINE'], isActive: undefined },
      { code: 'DOG', label: 'Perro', eventTypes: ['VACCINE', 'WALK'], isActive: undefined },
    ]);
  });

  it('filters deprecated breeds by default', async () => {
    (listSpeciesItems as jest.Mock).mockResolvedValueOnce(speciesItems);
    (listBreedItems as jest.Mock).mockResolvedValueOnce([
      {
        code: 'LABRADOR',
        speciesCode: 'DOG',
        labels: { en: 'Labrador', es: 'Labrador' },
        deprecated: false,
      },
      {
        code: 'IGUANA',
        speciesCode: 'DOG',
        labels: { en: 'Iguana', es: 'Iguana' },
        deprecated: true,
      },
    ]);
    const result = await getBreedsCatalog('en', 'DOG');
    expect(result).toEqual([
      {
        code: 'LABRADOR',
        label: 'Labrador',
        speciesId: 'DOG',
        weightKg: undefined,
        deprecated: false,
      },
    ]);
  });

  it('includes deprecated breeds when requested', async () => {
    (listSpeciesItems as jest.Mock).mockResolvedValueOnce(speciesItems);
    (listBreedItems as jest.Mock).mockResolvedValueOnce([
      {
        code: 'IGUANA',
        speciesCode: 'DOG',
        labels: { en: 'Iguana', es: 'Iguana' },
        deprecated: true,
      },
    ]);
    const result = await getBreedsCatalog('en', 'DOG', true);
    expect(result).toEqual([
      {
        code: 'IGUANA',
        label: 'Iguana',
        speciesId: 'DOG',
        weightKg: undefined,
        deprecated: true,
      },
    ]);
  });

  it('throws on invalid species', async () => {
    (listSpeciesItems as jest.Mock).mockResolvedValueOnce(speciesItems);
    await expect(getBreedsCatalog('en', 'INVALID')).rejects.toBeInstanceOf(
      InvalidSpeciesError
    );
  });

  it('filters vaccines by species', async () => {
    (listSpeciesItems as jest.Mock).mockResolvedValueOnce(speciesItems);
    (listVaccineItems as jest.Mock).mockResolvedValueOnce([
      {
        code: 'RABIES',
        labels: { en: 'Rabies', es: 'Rabia' },
        speciesCode: 'DOG',
        recommendedIntervalDays: 365,
      },
      {
        code: 'FVRCP',
        labels: { en: 'FVRCP', es: 'FVRCP' },
        speciesCode: 'CAT',
        recommendedIntervalDays: 365,
      },
    ]);
    const result = await getVaccinesCatalog('en', 'DOG');
    expect(result).toEqual([
      {
        code: 'RABIES',
        label: 'Rabies',
        speciesId: 'DOG',
        recommendedIntervalDays: 365,
      },
    ]);
  });
});
