import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  InitiateAuthCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { SESClient, SendTemplatedEmailCommand } from '@aws-sdk/client-ses';
import {
  badRequest,
  conflict,
  created,
  serverError,
} from '@pettzi/utils-dynamo/http';
import crypto from 'crypto';
import type { InitiateAuthCommandOutput } from '@aws-sdk/client-cognito-identity-provider';

interface RegisterPayload {
  email?: string;
  password?: string;
}

const COGNITO_USER_POOL_ID = process.env.COGNITO_USER_POOL_ID;
if (!COGNITO_USER_POOL_ID) {
  throw new Error('COGNITO_USER_POOL_ID is required');
}
const cognito = new CognitoIdentityProviderClient({});
const ses = new SESClient({});

const buildVerificationToken = (email: string, secret?: string) => {
  if (!secret) return null;
  const expires = Date.now() + 1000 * 60 * 60 * 24; // 24h
  const payload = `${email}:${expires}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return Buffer.from(`${payload}:${signature}`).toString('base64url');
};

const anonymizeEmail = (email: string) =>
  crypto.createHash('sha256').update(email).digest('hex');

const createEmailLogContext = (email: string) => {
  const emailId = anonymizeEmail(email);
  if (process.env.NODE_ENV === 'production') {
    return { emailId };
  }
  return { email, emailId };
};

const sanitizeAuthResponse = (resp?: InitiateAuthCommandOutput) => ({
  challengeName: resp?.ChallengeName,
  requestId: resp?.$metadata?.requestId,
  httpStatusCode: resp?.$metadata?.httpStatusCode,
  authenticationResultPresent: !!resp?.AuthenticationResult,
});

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

  console.info('Register request', createEmailLogContext(email));

  try {
    await cognito.send(
      new AdminCreateUserCommand({
        UserPoolId: COGNITO_USER_POOL_ID,
        Username: email,
        UserAttributes: [{ Name: 'email', Value: email }],
        MessageAction: 'SUPPRESS',
        DesiredDeliveryMediums: [],
      })
    );
    console.debug('AdminCreateUser succeeded', createEmailLogContext(email));

    await cognito.send(
      new AdminSetUserPasswordCommand({
        UserPoolId: COGNITO_USER_POOL_ID,
        Username: email,
        Password: password,
        Permanent: true,
      })
    );
    console.debug(
      'AdminSetUserPassword succeeded',
      createEmailLogContext(email)
    );

    // Auto-confirm so the user can log in immediately while keeping email unverified.
    // Auto-initiate auth to return tokens to the client.
    const authResp = await cognito.send(
      new InitiateAuthCommand({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: process.env.COGNITO_USER_POOL_CLIENT_ID,
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password,
        },
      })
    );

    const authResult = authResp?.AuthenticationResult;
    if (!authResult?.AccessToken || !authResult?.IdToken) {
      console.error('InitiateAuth missing tokens', sanitizeAuthResponse(authResp));
      return serverError('Failed to start session after registration');
    }

    const emailVerifySecret = process.env.EMAIL_VERIFY_SECRET;
    const emailVerifyBaseUrl = process.env.EMAIL_VERIFY_BASE_URL;
    const token = buildVerificationToken(email, emailVerifySecret);
    if (!token) {
      console.warn(
        'Verification token not generated; EMAIL_VERIFY_SECRET missing',
        createEmailLogContext(email)
      );
    }
    const verificationLink =
      token && emailVerifyBaseUrl
        ? `${emailVerifyBaseUrl}?token=${token}`
        : undefined;

    if (process.env.SES_FROM_EMAIL && process.env.SES_WELCOME_TEMPLATE_NAME) {
      try {
        await ses.send(
          new SendTemplatedEmailCommand({
            Source: process.env.SES_FROM_EMAIL,
            Destination: { ToAddresses: [email] },
            Template: process.env.SES_WELCOME_TEMPLATE_NAME,
            TemplateData: JSON.stringify({
              userName: email,
              email,
              verificationLink,
            }),
          })
        );
        console.debug('Welcome email sent', {
          ...createEmailLogContext(email),
          template: process.env.SES_WELCOME_TEMPLATE_NAME,
        });
      } catch (sesErr) {
        console.error(
          'Failed to send welcome email',
          createEmailLogContext(email),
          sesErr
        );
      }
    } else {
      console.warn('Skipping welcome email; SES not configured', {
        sesFromEmail: process.env.SES_FROM_EMAIL,
        template: process.env.SES_WELCOME_TEMPLATE_NAME,
      });
    }

    return created({
      message: 'User registered. Please confirm your email.',
      idToken: authResult.IdToken,
      accessToken: authResult.AccessToken,
      refreshToken: authResult.RefreshToken,
      tokenType: authResult.TokenType,
      expiresIn: authResult.ExpiresIn,
    });
  } catch (error: any) {
    const code = error?.name;

    if (code === 'UsernameExistsException') {
      return conflict('User already exists');
    }
    if (
      code === 'InvalidParameterException' ||
      code === 'InvalidPasswordException'
    ) {
      return badRequest(error.message ?? 'Invalid parameters');
    }

    console.error('Register error', { error });
    return serverError('Failed to register user');
  }
};
