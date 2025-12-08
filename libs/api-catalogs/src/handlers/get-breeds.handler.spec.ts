import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { handler } from './get-breeds.handler';

describe('get-breeds.handler', () => {
  const baseEvent: APIGatewayProxyEventV2 = {
    version: '2.0',
    routeKey: '',
    rawPath: '',
    rawQueryString: '',
    headers: {},
    requestContext: {
      accountId: '',
      apiId: '',
      domainName: '',
      domainPrefix: '',
      http: {
        method: 'GET',
        path: '/catalogs/breeds',
        protocol: 'HTTP/1.1',
        sourceIp: '',
        userAgent: '',
      },
      requestId: '',
      routeKey: '',
      stage: '$default',
      time: '',
      timeEpoch: 0,
      authorizer: {
        jwt: { claims: { sub: 'owner-1' }, scopes: [] },
      },
    },
    isBase64Encoded: false,
  };

  it('returns all breeds', async () => {
    const res = await handler(baseEvent);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body ?? '{}');
    expect(body.breeds?.length).toBeGreaterThan(0);
  });

  it('filters by species', async () => {
    const res = await handler({
      ...baseEvent,
      queryStringParameters: { species: 'dog' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body ?? '{}');
    expect(body.breeds?.length).toBeGreaterThan(0);
  });

  it('returns badRequest on invalid species', async () => {
    const res = await handler({
      ...baseEvent,
      queryStringParameters: { species: 'invalid' },
    });
    expect(res.statusCode).toBe(400);
  });
});
