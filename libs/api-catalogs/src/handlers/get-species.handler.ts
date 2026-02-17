import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { ok, serverError } from '@pettzi/utils-dynamo/http';
import { getLocale } from './common';
import { getSpeciesCatalog } from '../catalogs.service';

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const locale = getLocale(event);
    const species = await getSpeciesCatalog(locale);
    return ok({ species });
  } catch (error) {
    console.error('Get species error', error);
    return serverError('Failed to load species');
  }
};
