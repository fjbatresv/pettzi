import { handler } from './get-pet.handler';
import { PetSpecies, toItemPet } from '@peto/domain-model';

jest.mock('@aws-sdk/lib-dynamodb', () => {
  const mockSend = jest.fn();
  class Cmd {
    constructor(public input: any) {}
  }
  return {
    DynamoDBDocumentClient: { from: () => ({ send: mockSend }) },
    GetCommand: Cmd,
    __sendMock: mockSend,
  };
});

const { __sendMock: sendMock } = jest.requireMock('@aws-sdk/lib-dynamodb') as {
  __sendMock: jest.Mock;
};

describe('get-pet.handler', () => {
  beforeEach(() => sendMock.mockReset());

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
      });

    const res = await handler({
      pathParameters: { petId: 'pet-1' },
      requestContext: { authorizer: { jwt: { claims: { sub: 'owner-1' } } } },
    } as any);

    expect(res.statusCode).toBe(200);
  });

  it('unauthorized when not owner', async () => {
    sendMock.mockResolvedValueOnce({ Item: undefined });
    const res = await handler({
      pathParameters: { petId: 'pet-1' },
      requestContext: { authorizer: { jwt: { claims: { sub: 'owner-1' } } } },
    } as any);
    expect(res.statusCode).toBe(401);
  });
});
