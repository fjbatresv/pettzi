import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import {
  CognitoIdentityProviderClient,
  ForgotPasswordCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { badRequest, ok, serverError } from '@peto/utils-dynamo/http';

interface ForgotPasswordPayload {
  email?: string;
}

const cognito = new CognitoIdentityProviderClient({});

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  if (!event.body) {
    return badRequest('Request body is required');
  }

  let payload: ForgotPasswordPayload;
  try {
    payload = JSON.parse(event.body);
  } catch {
    return badRequest('Invalid JSON body');
  }

  const { email } = payload;
  if (!email) {
    return badRequest('email is required');
  }

  try {
    await cognito.send(
      new ForgotPasswordCommand({
        ClientId: process.env.COGNITO_USER_POOL_CLIENT_ID,
        Username: email,
      })
    );

    return ok({ message: 'Password reset code sent.' });
  } catch (error: any) {
    console.error('Forgot password error', { error });
    return serverError('Failed to start password reset');
  }
};
