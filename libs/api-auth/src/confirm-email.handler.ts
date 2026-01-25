import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import {
  AdminUpdateUserAttributesCommand,
  CognitoIdentityProviderClient,
} from '@aws-sdk/client-cognito-identity-provider';
import { badRequest, ok, serverError } from '@pettzi/utils-dynamo/http';
import crypto from 'crypto';
import { getEmailVerifySecret } from './handlers/email-verify-secret';

const client = new CognitoIdentityProviderClient({});

const parseToken = (token: string, secret?: string): string | null => {
  if (!secret) return null;
  let decoded: string;
  try {
    decoded = Buffer.from(token, 'base64url').toString('utf8');
  } catch {
    return null;
  }

  const [email, expiresStr, signature] = decoded.split(':');
  if (!email || !expiresStr || !signature) return null;

  const expires = Number(expiresStr);
  if (Number.isNaN(expires) || expires < Date.now()) return null;

  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(`${email}:${expires}`)
    .digest('hex');
  const signatureBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSig);

  if (signatureBuf.length !== expectedBuf.length) {
    return null;
  }

  if (!crypto.timingSafeEqual(signatureBuf, expectedBuf)) {
    return null;
  }

  return email;
};

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  if (!event.body) {
    return badRequest('token is required');
  }

  let token: string | undefined;
  try {
    const payload = JSON.parse(event.body);
    token = payload?.token;
  } catch {
    return badRequest('token is required');
  }

  if (!token) {
    return badRequest('token is required');
  }

  const secret = await getEmailVerifySecret();
  const userPoolId = process.env.COGNITO_USER_POOL_ID;
  if (!secret || !userPoolId) {
    return serverError('Email verification not configured');
  }

  const email = parseToken(token, secret);
  if (!email) {
    return badRequest('invalid or expired token');
  }

  try {
    await client.send(
      new AdminUpdateUserAttributesCommand({
        UserPoolId: userPoolId,
        Username: email,
        UserAttributes: [{ Name: 'email_verified', Value: 'true' }],
      })
    );

    return ok({ message: 'Email verified' });
  } catch (err) {
    const errorInfo = {
      code: (err as Error)?.name ?? 'UnknownError',
      message: (err as Error)?.message ?? 'Unknown error',
      stack: (err as Error)?.stack,
    };
    console.error('Verify email error', errorInfo);
    return serverError('Failed to verify email');
  }
};
