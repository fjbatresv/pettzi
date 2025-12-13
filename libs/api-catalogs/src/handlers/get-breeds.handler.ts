import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { ok, badRequest, serverError } from '@pettzi/utils-dynamo/http';
import {
  catalogBreeds,
  catalogSpecies,
  PetSpecies,
} from '@pettzi/domain-model';
import { getOwnerId } from './common';

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    getOwnerId(event);
  } catch (err) {
    return err as any;
  }

  const speciesParam = event.queryStringParameters?.species;
  let speciesFilter: PetSpecies | undefined;
  if (speciesParam) {
    const match = catalogSpecies.find(
      (s) => s.code.toLowerCase() === speciesParam.toLowerCase()
    );
    if (!match) {
      return badRequest('Invalid species');
    }
    speciesFilter = match.code;
  }

  try {
    if (speciesFilter) {
      return ok({ breeds: catalogBreeds[speciesFilter] ?? [] });
    }
    const allBreeds = Object.entries(catalogBreeds).flatMap(([species, breeds]) =>
      breeds.map((b) => ({ ...b, speciesId: species }))
    );
    return ok({ breeds: allBreeds });
  } catch (error) {
    console.error('Get breeds error', error);
    return serverError('Failed to load breeds');
  }
};
