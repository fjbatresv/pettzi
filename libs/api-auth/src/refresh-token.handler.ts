import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { badRequest, ok, serverError, unauthorized } from '@pettzi/utils-dynamo/http';

interface RefreshPayload {
  refreshToken?: string;
}

const cognito = new CognitoIdentityProviderClient({});

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  if (!event.body) {
    return badRequest('Request body is required');
  }

  let payload: RefreshPayload;
  try {
    payload = JSON.parse(event.body);
  } catch {
    return badRequest('Invalid JSON body');
  }

  const { refreshToken } = payload;
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

    return ok({
      idToken: authResult.IdToken,
      accessToken: authResult.AccessToken,
      refreshToken: authResult.RefreshToken,
    });
  } catch (error: any) {
    const code = error?.name;
    if (code === 'NotAuthorizedException') {
      return unauthorized('Invalid refresh token');
    }

    console.error('Refresh token error', { error });
    return serverError('Failed to refresh token');
  }
};
