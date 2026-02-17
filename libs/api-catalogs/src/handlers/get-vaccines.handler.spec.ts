import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { handler } from './get-vaccines.handler';
import { getVaccinesCatalog, InvalidSpeciesError } from '../catalogs.service';

jest.mock('../catalogs.service', () => ({
  getVaccinesCatalog: jest.fn(),
  InvalidSpeciesError: class InvalidSpeciesError extends Error {},
}));

describe('get-vaccines.handler', () => {
  const baseEvent = {
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
        path: '/catalogs/vaccines',
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
  } as APIGatewayProxyEventV2;

  it('returns vaccines', async () => {
    (getVaccinesCatalog as jest.Mock).mockResolvedValueOnce([
      { code: 'RABIES', label: 'Rabies' },
    ]);
    const res = await (handler as any)(baseEvent);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body ?? '{}');
    expect(body.vaccines).toHaveLength(1);
  });

  it('filters by species', async () => {
    (getVaccinesCatalog as jest.Mock).mockResolvedValueOnce([
      { code: 'RABIES', label: 'Rabies' },
    ]);
    const res = await (handler as any)({
      ...baseEvent,
      queryStringParameters: { species: 'dog' },
    });
    expect(res.statusCode).toBe(200);
  });

  it('returns badRequest on invalid species', async () => {
    (getVaccinesCatalog as jest.Mock).mockRejectedValueOnce(
      new InvalidSpeciesError()
    );
    const res = await (handler as any)({
      ...baseEvent,
      queryStringParameters: { species: 'invalid' },
    });
    expect(res.statusCode).toBe(400);
  });
});
