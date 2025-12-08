import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { ok, serverError } from '@peto/utils-dynamo/http';
import { catalogSpecies } from '@peto/domain-model';
import { getOwnerId } from './common';

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    getOwnerId(event);
  } catch (err) {
    return err as any;
  }

  try {
    return ok({ species: catalogSpecies });
  } catch (error) {
    console.error('Get species error', error);
    return serverError('Failed to load species');
  }
};
