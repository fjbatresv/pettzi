import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { ok, badRequest, serverError } from '@pettzi/utils-dynamo/http';
import { catalogSpecies, PetSpecies } from '@pettzi/domain-model';
import { getLocalizedBreeds } from './catalog-localization';
import { getLocale, getOwnerId } from './common';

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    getOwnerId(event);
  } catch (err) {
    return err as any;
  }

  const locale = getLocale(event);
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
    return ok({ breeds: getLocalizedBreeds(locale, speciesFilter) });
  } catch (error) {
    console.error('Get breeds error', error);
    return serverError('Failed to load breeds');
  }
};
