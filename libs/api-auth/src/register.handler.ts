import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  InitiateAuthCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { SESClient, SendTemplatedEmailCommand } from '@aws-sdk/client-ses';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import {
  badRequest,
  conflict,
  created,
  serverError,
} from '@pettzi/utils-dynamo/http';
import crypto from 'crypto';
import type { InitiateAuthCommandOutput } from '@aws-sdk/client-cognito-identity-provider';
import { toItemOwnerProfile } from '@pettzi/domain-model';
import { docClient, PETTZI_TABLE_NAME } from './handlers/common';
import { buildRefreshCookie } from './handlers/cookies';

interface RegisterPayload {
  name?: string;
  email?: string;
  password?: string;
  locale?: 'es' | 'en';
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

const decodeJwtSub = (token: string | undefined) => {
  if (!token) return null;
  const [, payload] = token.split('.');
  if (!payload) return null;
  try {
    const decoded = Buffer.from(payload, 'base64url').toString('utf8');
    const parsed = JSON.parse(decoded) as { sub?: string };
    return parsed?.sub ?? null;
  } catch {
    return null;
  }
};

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  if (!PETTZI_TABLE_NAME) {
    return serverError('PETTZI_TABLE_NAME is required');
  }
  if (!event.body) {
    return badRequest('Request body is required');
  }

  let payload: RegisterPayload;
  try {
    payload = JSON.parse(event.body);
  } catch {
    return badRequest('Invalid JSON body');
  }

  const { name, email, password, locale } = payload;
  if (!name || !email || !password) {
    return badRequest('name, email and password are required');
  }
  const selectedLocale = locale === 'en' ? 'en' : 'es';
  const fullName = name.trim();
  const nameParts = fullName.split(/\s+/).filter(Boolean);
  const firstName = nameParts[0] ?? '';
  const lastName = nameParts.slice(1).join(' ');

  console.info('Register request', createEmailLogContext(email));

  try {
    const createResponse = await cognito.send(
      new AdminCreateUserCommand({
        UserPoolId: COGNITO_USER_POOL_ID,
        Username: email,
        UserAttributes: [
          { Name: 'email', Value: email },
          { Name: 'name', Value: fullName },
          ...(firstName ? [{ Name: 'given_name', Value: firstName }] : []),
          ...(lastName ? [{ Name: 'family_name', Value: lastName }] : []),
        ],
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
      console.error(
        'InitiateAuth missing tokens',
        sanitizeAuthResponse(authResp)
      );
      return serverError('Failed to start session after registration');
    }

    const ownerId =
      createResponse?.User?.Attributes?.find((attr) => attr.Name === 'sub')
        ?.Value ?? decodeJwtSub(authResult.IdToken);

    if (!ownerId) {
      console.error('Missing ownerId after registration', {
        ...createEmailLogContext(email),
        userAttributes: createResponse?.User?.Attributes?.map((attr) => attr.Name),
      });
      return serverError('Failed to register user');
    }

    const createdAt = new Date();
    await docClient.send(
      new PutCommand({
        TableName: PETTZI_TABLE_NAME,
        Item: {
          ...toItemOwnerProfile({
            ownerId,
            userId: ownerId,
            fullName: fullName || email,
            email,
            firstName: firstName || undefined,
            lastName: lastName || undefined,
            locale: selectedLocale,
            createdAt,
            updatedAt: createdAt,
          }),
        },
        ConditionExpression: 'attribute_not_exists(PK)',
      })
    );

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

    const templateName =
      selectedLocale === 'en'
        ? process.env.SES_WELCOME_TEMPLATE_NAME_EN
        : process.env.SES_WELCOME_TEMPLATE_NAME_ES;
    const fallbackTemplate = process.env.SES_WELCOME_TEMPLATE_NAME;

    if (process.env.SES_FROM_EMAIL && (templateName || fallbackTemplate)) {
      try {
        await ses.send(
          new SendTemplatedEmailCommand({
            Source: process.env.SES_FROM_EMAIL,
            Destination: { ToAddresses: [email] },
            Template: templateName ?? fallbackTemplate ?? '',
            TemplateData: JSON.stringify({
              userName: fullName || email,
              email,
              verificationLink,
            }),
          })
        );
        console.debug('Welcome email sent', {
          ...createEmailLogContext(email),
          template: templateName ?? fallbackTemplate,
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

    const cookie =
      authResult.RefreshToken != null
        ? buildRefreshCookie(authResult.RefreshToken)
        : undefined;

    return created(
      {
        message: 'User registered. Please confirm your email.',
        idToken: authResult.IdToken,
        accessToken: authResult.AccessToken,
        tokenType: authResult.TokenType,
        expiresIn: authResult.ExpiresIn,
      },
      undefined,
      cookie ? [cookie] : undefined
    );
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
