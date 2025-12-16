import { handler } from './archive-pet.handler';
import { PetSpecies, OwnerRole, toItemPet } from '@pettzi/domain-model';
import { APIGatewayProxyEventV2 } from 'aws-lambda';

jest.mock('@aws-sdk/lib-dynamodb', () => {
  const mockSend = jest.fn();
  class Cmd {
    constructor(public input: any) {}
  }
  return {
    DynamoDBDocumentClient: { from: () => ({ send: mockSend }) },
    GetCommand: Cmd,
    UpdateCommand: Cmd,
    __sendMock: mockSend,
  };
});

const { __sendMock: sendMock } = jest.requireMock('@aws-sdk/lib-dynamodb') as {
  __sendMock: jest.Mock;
};

describe('archive-pet.handler', () => {
  beforeEach(() => sendMock.mockReset());

  const buildEvent = (overrides: Partial<APIGatewayProxyEventV2> = {}) => {
    const baseBody = {
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
          method: 'DELETE',
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
      },
      isBase64Encoded: false,
      pathParameters: null,
      body: null,
      queryStringParameters: null,
    };
    return {
      ...baseBody,
      ...overrides,
      requestContext: {
        ...baseBody.requestContext,
        ...overrides.requestContext,
        http: {
          ...baseBody.requestContext.http,
          ...(overrides.requestContext?.http ?? {}),
        },
      },
      pathParameters: overrides.pathParameters ?? baseBody.pathParameters,
    } as APIGatewayProxyEventV2;
  };

  it('archives pet for primary owner', async () => {
    sendMock
      .mockResolvedValueOnce({
        Item: { PK: 'PET#pet-1', SK: 'OWNER#owner-1', role: OwnerRole.PRIMARY },
      })
      .mockResolvedValueOnce({
        Attributes: toItemPet({
          petId: 'pet-1',
          ownerId: 'owner-1',
          name: 'Fido',
          species: PetSpecies.DOG,
          createdAt: new Date(),
          isArchived: true,
        }),
      });

    const res = await handler(
      buildEvent({
        pathParameters: { petId: 'pet-1' },
      })
    );

    expect(res.statusCode).toBe(200);
  });

  it('forbids non-owner', async () => {
    sendMock.mockResolvedValueOnce({ Item: undefined });
    const res = await handler(
      buildEvent({
        pathParameters: { petId: 'pet-1' },
      })
    );
    expect(res.statusCode).toBe(401);
  });
});
