import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import {
  CognitoIdentityProviderClient,
  ConfirmForgotPasswordCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { badRequest, ok, serverError } from '@peto/utils-dynamo/http';

interface ConfirmForgotPasswordPayload {
  email?: string;
  code?: string;
  newPassword?: string;
}

const cognito = new CognitoIdentityProviderClient({});

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  if (!event.body) {
    return badRequest('Request body is required');
  }

  let payload: ConfirmForgotPasswordPayload;
  try {
    payload = JSON.parse(event.body);
  } catch {
    return badRequest('Invalid JSON body');
  }

  const { email, code, newPassword } = payload;
  if (!email || !code || !newPassword) {
    return badRequest('email, code and newPassword are required');
  }

  try {
    await cognito.send(
      new ConfirmForgotPasswordCommand({
        ClientId: process.env.COGNITO_USER_POOL_CLIENT_ID,
        Username: email,
        ConfirmationCode: code,
        Password: newPassword,
      })
    );

    return ok({ message: 'Password has been reset.' });
  } catch (error: any) {
    console.error('Confirm forgot password error', { error });
    return serverError('Failed to confirm password reset');
  }
};
