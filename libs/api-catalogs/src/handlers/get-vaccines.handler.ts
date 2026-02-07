import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { ok, badRequest, serverError } from '@pettzi/utils-dynamo/http';
import { getLocale } from './common';
import { getVaccinesCatalog, InvalidSpeciesError } from '../catalogs.service';

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const locale = getLocale(event);
  const speciesParam = event.queryStringParameters?.species;
  const speciesFilter = speciesParam?.toUpperCase();

  try {
    const vaccines = await getVaccinesCatalog(locale, speciesFilter);
    return ok({ vaccines });
  } catch (error) {
    if (error instanceof InvalidSpeciesError) {
      return badRequest('Invalid species');
    }
    console.error('Get vaccines error', error);
    return serverError('Failed to load vaccines');
  }
};
