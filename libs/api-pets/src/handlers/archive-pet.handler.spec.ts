import { handler } from './archive-pet.handler';
import { PetSpecies, OwnerRole, toItemPet } from '@pettzi/domain-model';

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

    const res = await handler({
      pathParameters: { petId: 'pet-1' },
      requestContext: { authorizer: { jwt: { claims: { sub: 'owner-1' } } } },
    } as any);

    expect(res.statusCode).toBe(200);
  });

  it('forbids non-owner', async () => {
    sendMock.mockResolvedValueOnce({ Item: undefined });
    const res = await handler({
      pathParameters: { petId: 'pet-1' },
      requestContext: { authorizer: { jwt: { claims: { sub: 'owner-1' } } } },
    } as any);
    expect(res.statusCode).toBe(401);
  });
});
