import { APIGatewayProxyEventV2 } from 'aws-lambda';

const DEFAULT_MAX_AGE = 60 * 60 * 24 * 30;

export const buildRefreshCookie = (token: string) => {
  const stage = process.env.STAGE ?? 'dev';
  const secure =
    process.env.COOKIE_SECURE === 'true' ||
    (stage !== 'dev' && stage !== 'local');
  const sameSite = secure ? 'None' : 'Lax';

  const parts = [
    `pettzi.refreshToken=${encodeURIComponent(token)}`,
    'HttpOnly',
    'Path=/',
    `Max-Age=${DEFAULT_MAX_AGE}`,
    `SameSite=${sameSite}`,
  ];
  if (secure) {
    parts.push('Secure');
  }
  return parts.join('; ');
};

export const clearRefreshCookie = () =>
  [
    'pettzi.refreshToken=',
    'HttpOnly',
    'Path=/',
    'Max-Age=0',
    'SameSite=Lax',
  ].join('; ');

export const getRefreshCookie = (event: APIGatewayProxyEventV2) => {
  const cookies = event.cookies ?? [];
  for (const cookie of cookies) {
    const [name, ...rest] = cookie.split('=');
    if (name?.trim() === 'pettzi.refreshToken') {
      return decodeURIComponent(rest.join('='));
    }
  }
  return null;
};
