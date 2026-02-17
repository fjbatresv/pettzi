import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  buildCatalogBreedPk,
  buildCatalogSpeciesPk,
} from '@pettzi/utils-dynamo/key';
import {
  CatalogBreedItem,
  CatalogSpeciesItem,
} from './catalogs.types';

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE_NAME = process.env.PETTZI_TABLE_NAME ?? '';

const requireTableName = () => {
  if (!TABLE_NAME) {
    throw new Error('Missing PETTZI_TABLE_NAME');
  }
  return TABLE_NAME;
};

const queryByPk = async <T>(pk: string) => {
  const response = await docClient.send(
    new QueryCommand({
      TableName: requireTableName(),
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': pk,
      },
    })
  );

  return (response.Items ?? []) as T[];
};

export const listSpeciesItems = () =>
  queryByPk<CatalogSpeciesItem>(buildCatalogSpeciesPk());

export const listBreedItems = (speciesCode: string) =>
  queryByPk<CatalogBreedItem>(buildCatalogBreedPk(speciesCode));
