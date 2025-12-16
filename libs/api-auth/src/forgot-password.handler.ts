import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import {
  CognitoIdentityProviderClient,
  AdminSetUserPasswordCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { SESClient, SendTemplatedEmailCommand } from '@aws-sdk/client-ses';
import { badRequest, ok, serverError } from '@pettzi/utils-dynamo/http';
import crypto from 'crypto';

interface ForgotPasswordPayload {
  email?: string;
}

const cognito = new CognitoIdentityProviderClient({});
const ses = new SESClient({});

const TEMP_PASSWORD_LENGTH = 10;

const generateTemporaryPassword = () => {
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const symbols = '!@#$%^&*';
  const all = `${lower}${upper}${digits}${symbols}`;
  const buf = crypto.randomBytes(TEMP_PASSWORD_LENGTH);
  const chars = Array.from({ length: TEMP_PASSWORD_LENGTH }, (_, i) =>
    all[buf[i] % all.length],
  );

  chars[0] = lower[crypto.randomInt(lower.length)];
  chars[1] = digits[crypto.randomInt(digits.length)];
  return chars.join('');
};

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

  if (!process.env.COGNITO_USER_POOL_ID) {
    console.error('COGNITO_USER_POOL_ID is missing');
    return serverError('Configuration missing');
  }

  try {
    const temporaryPassword = generateTemporaryPassword();

    await cognito.send(
      new AdminSetUserPasswordCommand({
        UserPoolId: process.env.COGNITO_USER_POOL_ID,
        Username: email,
        Password: temporaryPassword,
        Permanent: false,
      })
    );

    const templateName = process.env.SES_RESET_TEMPLATE_NAME;
    const fromEmail = process.env.SES_FROM_EMAIL;

    if (templateName && fromEmail) {
      await ses.send(
        new SendTemplatedEmailCommand({
          Source: fromEmail,
          Destination: { ToAddresses: [email] },
          Template: templateName,
          TemplateData: JSON.stringify({
            email,
            temporaryPassword,
          }),
        })
      );
    } else {
      console.warn('Forgot password email skipped, SES config missing', {
        templateName,
        fromEmail,
      });
    }

    return ok({
      message:
        'Temporary password sent. Use it to login and then change your password.',
    });
  } catch (error: any) {
    console.error('Forgot password error', { error });
    if (error?.name === 'UserNotFoundException') {
      return badRequest('User does not exist');
    }
    return serverError('Failed to reset password');
  }
};
