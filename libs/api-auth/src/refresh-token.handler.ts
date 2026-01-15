import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { badRequest, ok, serverError, unauthorized } from '@pettzi/utils-dynamo/http';
import { buildRefreshCookie, getRefreshCookie } from './handlers/cookies';

interface RefreshPayload {
  refreshToken?: string;
}

const cognito = new CognitoIdentityProviderClient({});

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  let refreshToken = getRefreshCookie(event);
  if (!refreshToken && event.body) {
    try {
      const payload = JSON.parse(event.body) as RefreshPayload;
      refreshToken = payload.refreshToken ?? refreshToken;
    } catch {
      return badRequest('Invalid JSON body');
    }
  }

  if (!refreshToken) {
    return badRequest('refreshToken is required');
  }

  try {
    const response = await cognito.send(
      new InitiateAuthCommand({
        AuthFlow: 'REFRESH_TOKEN_AUTH',
        ClientId: process.env.COGNITO_USER_POOL_CLIENT_ID,
        AuthParameters: {
          REFRESH_TOKEN: refreshToken,
        },
      })
    );

    const authResult = response.AuthenticationResult;
    if (!authResult?.IdToken || !authResult.AccessToken) {
      return serverError('Invalid auth response from Cognito');
    }

    const cookie =
      authResult.RefreshToken != null
        ? buildRefreshCookie(authResult.RefreshToken)
        : undefined;

    return ok(
      {
        idToken: authResult.IdToken,
        accessToken: authResult.AccessToken,
      },
      undefined,
      cookie ? [cookie] : undefined
    );
  } catch (error: any) {
    const code = error?.name;
    if (code === 'NotAuthorizedException') {
      return unauthorized('Invalid refresh token');
    }

    console.error('Refresh token error', { error });
    return serverError('Failed to refresh token');
  }
};
