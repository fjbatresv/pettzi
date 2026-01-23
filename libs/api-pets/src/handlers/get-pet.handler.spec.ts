import { handler } from './get-pet.handler';
import { PetSpecies, toItemPet } from '@pettzi/domain-model';
import { APIGatewayProxyEventV2 } from 'aws-lambda';

jest.mock('@aws-sdk/lib-dynamodb', () => {
  const mockSend = jest.fn();
  class Cmd {
    constructor(public input: any) {}
  }
  return {
    DynamoDBDocumentClient: { from: () => ({ send: mockSend }) },
    GetCommand: Cmd,
    QueryCommand: Cmd,
    __sendMock: mockSend,
  };
});

const { __sendMock: sendMock } = jest.requireMock('@aws-sdk/lib-dynamodb') as {
  __sendMock: jest.Mock;
};

describe('get-pet.handler', () => {
  beforeEach(() => sendMock.mockReset());

  const defaultRequestContext = {
    accountId: '',
    apiId: '',
    domainName: '',
    domainPrefix: '',
    http: {
      method: 'GET',
      path: '/pets/pet-1',
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
      jwt: { claims: { sub: 'owner-1' } },
    },
  };

  const buildEvent = (overrides: Partial<APIGatewayProxyEventV2> = {}) => {
    const baseEvent: APIGatewayProxyEventV2 = {
      version: '2.0',
      routeKey: '',
      rawPath: '',
      rawQueryString: '',
      headers: {},
      requestContext: {
        ...defaultRequestContext,
        http: {
          ...defaultRequestContext.http,
        },
      },
      isBase64Encoded: false,
      pathParameters: null,
      body: null,
      queryStringParameters: null,
    };
    const mergedRequestContext = {
      ...baseEvent.requestContext,
      ...overrides.requestContext,
      http: {
        ...baseEvent.requestContext.http,
        ...(overrides.requestContext?.http ?? {}),
      },
    };
    return {
      ...baseEvent,
      ...overrides,
      requestContext: mergedRequestContext,
    } as APIGatewayProxyEventV2;
  };

  it('returns pet when owner link exists', async () => {
    sendMock
      .mockResolvedValueOnce({ Item: { PK: 'PET#pet-1', SK: 'OWNER#owner-1' } })
      .mockResolvedValueOnce({
        Item: toItemPet({
          petId: 'pet-1',
          ownerId: 'owner-1',
          name: 'Fido',
          species: PetSpecies.DOG,
          createdAt: new Date(),
        }),
      })
      .mockResolvedValueOnce({ Items: [] });

    const res = await handler(
      buildEvent({
        pathParameters: { petId: 'pet-1' },
      })
    );

    expect(res.statusCode).toBe(200);
  });

  it('unauthorized when not owner', async () => {
    sendMock.mockResolvedValueOnce({ Item: undefined });
    const res = await handler(
      buildEvent({
        pathParameters: { petId: 'pet-1' },
        requestContext: { authorizer: undefined },
      })
    );
    expect(res.statusCode).toBe(401);
  });
});
