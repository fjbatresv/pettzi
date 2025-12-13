import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import {
  badRequest,
  ok,
  serverError,
  unauthorized,
} from '@pettzi/utils-dynamo/http';

interface LoginPayload {
  email?: string;
  password?: string;
}

const cognito = new CognitoIdentityProviderClient({});

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  if (!event.body) {
    return badRequest('Request body is required');
  }

  let payload: LoginPayload;
  try {
    payload = JSON.parse(event.body);
  } catch {
    return badRequest('Invalid JSON body');
  }

  const { email, password } = payload;
  if (!email || !password) {
    return badRequest('email and password are required');
  }

  try {
    const response = await cognito.send(
      new InitiateAuthCommand({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: process.env.COGNITO_USER_POOL_CLIENT_ID,
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password,
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
      return unauthorized('Invalid email or password');
    }
    if (code === 'UserNotConfirmedException') {
      return unauthorized('User is not confirmed');
    }

    console.error('Login error', { error });
    return serverError('Failed to login');
  }
};
