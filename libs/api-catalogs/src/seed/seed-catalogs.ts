import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  BatchWriteCommand,
  DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
import {
  buildCatalogBreedPk,
  buildCatalogBreedSk,
  buildCatalogSpeciesPk,
  buildCatalogSpeciesSk,
  buildCatalogVaccinePk,
  buildCatalogVaccineSk,
} from '@pettzi/utils-dynamo/key';
import {
  breedsSeed,
  speciesSeed,
  vaccinesSeed,
} from './catalog-seed-data';

const TABLE_NAME = process.env.PETTZI_TABLE_NAME ?? '';
const DRY_RUN = process.argv.includes('--dry-run');

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const requireTableName = () => {
  if (!TABLE_NAME) {
    throw new Error('Missing PETTZI_TABLE_NAME');
  }
  return TABLE_NAME;
};

const chunk = <T>(items: T[], size: number) => {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
};

const buildRequests = () => {
  const speciesRequests = speciesSeed.map((item) => ({
    PutRequest: {
      Item: {
        PK: buildCatalogSpeciesPk(),
        SK: buildCatalogSpeciesSk(item.code),
        type: 'CatalogSpecies',
        code: item.code,
        labels: item.labels,
        eventTypes: item.eventTypes,
        isActive: item.isActive,
      },
    },
  }));

  const breedRequests = breedsSeed.map((item) => ({
    PutRequest: {
      Item: {
        PK: buildCatalogBreedPk(item.speciesCode),
        SK: buildCatalogBreedSk(item.code),
        type: 'CatalogBreed',
        code: item.code,
        speciesCode: item.speciesCode,
        labels: item.labels,
        weightKg: item.weightKg,
        deprecated: item.deprecated,
      },
    },
  }));

  const vaccineRequests = vaccinesSeed.map((item) => ({
    PutRequest: {
      Item: {
        PK: buildCatalogVaccinePk(),
        SK: buildCatalogVaccineSk(item.code),
        type: 'CatalogVaccine',
        code: item.code,
        labels: item.labels,
        speciesCode: item.speciesCode,
        recommendedIntervalDays: item.recommendedIntervalDays,
      },
    },
  }));

  return [...speciesRequests, ...breedRequests, ...vaccineRequests];
};

const seed = async () => {
  const requests = buildRequests();
  const batches = chunk(requests, 25);
  if (DRY_RUN) {
    console.info(`Dry run: ${requests.length} items ready.`);
    return;
  }

  for (const batch of batches) {
    await docClient.send(
      new BatchWriteCommand({
        RequestItems: {
          [requireTableName()]: batch,
        },
      })
    );
  }

  console.info(`Seeded ${requests.length} catalog items.`);
};

seed().catch((error) => {
  console.error('Catalog seed failed', error);
  process.exit(1);
});
