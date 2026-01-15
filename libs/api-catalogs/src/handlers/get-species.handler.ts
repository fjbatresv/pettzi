import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { ok, serverError } from '@pettzi/utils-dynamo/http';
import { getLocalizedSpecies } from './catalog-localization';
import { getLocale, getOwnerId } from './common';

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    getOwnerId(event);
  } catch (err) {
    return err as any;
  }

  try {
    const locale = getLocale(event);
    return ok({ species: getLocalizedSpecies(locale) });
  } catch (error) {
    console.error('Get species error', error);
    return serverError('Failed to load species');
  }
};
