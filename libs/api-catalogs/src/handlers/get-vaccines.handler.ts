import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { ok, badRequest, serverError } from '@peto/utils-dynamo/http';
import {
  catalogVaccines,
  catalogSpecies,
  PetSpecies,
} from '@peto/domain-model';
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
    const vaccines = speciesFilter
      ? catalogVaccines.filter((v) => !v.speciesId || v.speciesId === speciesFilter)
      : catalogVaccines;
    return ok({ vaccines });
  } catch (error) {
    console.error('Get vaccines error', error);
    return serverError('Failed to load vaccines');
  }
};
