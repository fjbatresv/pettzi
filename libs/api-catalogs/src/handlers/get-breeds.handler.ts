import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { ok, badRequest, serverError } from '@pettzi/utils-dynamo/http';
import { getLocale } from './common';
import { getBreedsCatalog, InvalidSpeciesError } from '../catalogs.service';

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const locale = getLocale(event);
  const speciesParam = event.queryStringParameters?.species;
  const speciesFilter = speciesParam?.toUpperCase();
  const includeDeprecatedParam =
    event.queryStringParameters?.includeDeprecated?.toLowerCase();
  const includeDeprecated =
    includeDeprecatedParam === 'true' || includeDeprecatedParam === '1';

  try {
    const breeds = await getBreedsCatalog(
      locale,
      speciesFilter,
      includeDeprecated
    );
    return ok({ breeds });
  } catch (error) {
    if (error instanceof InvalidSpeciesError) {
      return badRequest('Invalid species');
    }
    console.error('Get breeds error', error);
    return serverError('Failed to load breeds');
  }
};
