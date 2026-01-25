import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import {
  CognitoIdentityProviderClient,
  RespondToAuthChallengeCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { badRequest, ok, serverError } from '@pettzi/utils-dynamo/http';
import { buildRefreshCookie } from './handlers/cookies';

interface CompletePasswordPayload {
  email?: string;
  session?: string;
  newPassword?: string;
}

const cognito = new CognitoIdentityProviderClient({});

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  if (!event.body) {
    return badRequest('Request body is required');
  }

  let payload: CompletePasswordPayload;
  try {
    payload = JSON.parse(event.body);
  } catch {
    return badRequest('Invalid JSON body');
  }

  const { email, session, newPassword } = payload;
  if (!email || !session || !newPassword) {
    return badRequest('email, session and newPassword are required');
  }

  try {
    const response = await cognito.send(
      new RespondToAuthChallengeCommand({
        ClientId: process.env.COGNITO_USER_POOL_CLIENT_ID,
        ChallengeName: 'NEW_PASSWORD_REQUIRED',
        Session: session,
        ChallengeResponses: {
          USERNAME: email,
          NEW_PASSWORD: newPassword,
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
        ...(authResult.RefreshToken ? { refreshToken: authResult.RefreshToken } : {}),
      },
      undefined,
      cookie ? [cookie] : undefined
    );
  } catch (error: any) {
    console.error('Complete new password error', { error });
    if (error?.name === 'NotAuthorizedException') {
      return badRequest('Invalid session');
    }
    return serverError('Failed to complete password change');
  }
};
