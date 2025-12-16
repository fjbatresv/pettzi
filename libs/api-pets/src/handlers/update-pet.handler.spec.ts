import { handler } from './update-pet.handler';
import { PetSpecies, toItemPet } from '@pettzi/domain-model';

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

describe('update-pet.handler', () => {
  beforeEach(() => sendMock.mockReset());

  it('updates pet fields', async () => {
    sendMock
      .mockResolvedValueOnce({ Item: { PK: 'PET#pet-1', SK: 'OWNER#owner-1' } })
      .mockResolvedValueOnce({
        Attributes: toItemPet({
          petId: 'pet-1',
          ownerId: 'owner-1',
          name: 'Fido',
          species: PetSpecies.DOG,
          createdAt: new Date(),
          notes: 'updated',
        }),
      });

    const res = await (handler as any)({
      pathParameters: { petId: 'pet-1' },
      body: JSON.stringify({ notes: 'updated' }),
      requestContext: { authorizer: { jwt: { claims: { sub: 'owner-1' } } } },
    } as any);

    expect(res.statusCode).toBe(200);
  });

  it('returns 400 when no fields', async () => {
    const res = await (handler as any)({
      pathParameters: { petId: 'pet-1' },
      body: JSON.stringify({}),
      requestContext: { authorizer: { jwt: { claims: { sub: 'owner-1' } } } },
    } as any);
    expect(res.statusCode).toBe(400);
  });
});
