import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import {
  CognitoIdentityProviderClient,
  SignUpCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import {
  SESClient,
  SendTemplatedEmailCommand,
} from '@aws-sdk/client-ses';
import {
  badRequest,
  conflict,
  created,
  serverError,
} from '@pettzi/utils-dynamo/http';

interface RegisterPayload {
  email?: string;
  password?: string;
}

const cognito = new CognitoIdentityProviderClient({});
const ses = new SESClient({});

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  if (!event.body) {
    return badRequest('Request body is required');
  }

  let payload: RegisterPayload;
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
    await cognito.send(
      new SignUpCommand({
        ClientId: process.env.COGNITO_USER_POOL_CLIENT_ID,
        Username: email,
        Password: password,
        UserAttributes: [{ Name: 'email', Value: email }],
      })
    );

    if (process.env.SES_FROM_EMAIL && process.env.SES_WELCOME_TEMPLATE_NAME) {
      try {
        await ses.send(
          new SendTemplatedEmailCommand({
            Source: process.env.SES_FROM_EMAIL,
            Destination: { ToAddresses: [email] },
            Template: process.env.SES_WELCOME_TEMPLATE_NAME,
            TemplateData: JSON.stringify({ userName: email }),
          })
        );
      } catch (sesErr) {
        console.error('Failed to send welcome email', sesErr);
      }
    }

    return created({ message: 'User registered. Please confirm your email.' });
  } catch (error: any) {
    const code = error?.name;

    if (code === 'UsernameExistsException') {
      return conflict('User already exists');
    }
    if (code === 'InvalidParameterException' || code === 'InvalidPasswordException') {
      return badRequest(error.message ?? 'Invalid parameters');
    }

    console.error('Register error', { error });
    return serverError('Failed to register user');
  }
};
