import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { handler } from './get-species.handler';
import { getSpeciesCatalog } from '../catalogs.service';

jest.mock('../catalogs.service', () => ({
  getSpeciesCatalog: jest.fn(),
}));

describe('get-species.handler', () => {
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
        path: '/catalogs/species',
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

  it('returns species', async () => {
    (getSpeciesCatalog as jest.Mock).mockResolvedValueOnce([
      { code: 'DOG', label: 'Dog', eventTypes: ['VACCINE'] },
    ]);
    const res = await (handler as any)(baseEvent);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body ?? '{}');
    expect(body.species).toEqual([
      { code: 'DOG', label: 'Dog', eventTypes: ['VACCINE'] },
    ]);
  });

  it('returns species without auth', async () => {
    (getSpeciesCatalog as jest.Mock).mockResolvedValueOnce([
      { code: 'CAT', label: 'Cat', eventTypes: ['VET_VISIT'] },
    ]);
    const res = await (handler as any)({
      ...baseEvent,
      requestContext: { ...baseEvent.requestContext, authorizer: undefined },
    });
    expect(res.statusCode).toBe(200);
  });
});
