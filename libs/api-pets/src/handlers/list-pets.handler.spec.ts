import { handler } from './list-pets.handler';
import { PetSpecies, toItemPetOwner, toItemPet } from '@peto/domain-model';

var sendMock: jest.Mock;

jest.mock('@aws-sdk/lib-dynamodb', () => {
  const mockSend = jest.fn();
  sendMock = mockSend;
  class Cmd {
    constructor(public input: any) {}
  }
  return {
    DynamoDBDocumentClient: { from: () => ({ send: mockSend }) },
    QueryCommand: Cmd,
    BatchGetCommand: Cmd,
  };
});

describe('list-pets.handler', () => {
  beforeEach(() => {
    sendMock.mockReset();
  });

  it('lists pets for owner', async () => {
    sendMock
      .mockResolvedValueOnce({
        Items: [
          {
            petId: 'pet-1',
            ownerId: 'owner-1',
            GSI1PK: 'OWNER#owner-1',
            GSI1SK: 'PET#pet-1',
          },
        ],
      })
      .mockResolvedValueOnce({
        Responses: {
          [process.env.PETO_TABLE_NAME ?? '']: [
            toItemPet({
              petId: 'pet-1',
              ownerId: 'owner-1',
              name: 'Fido',
              species: PetSpecies.DOG,
              createdAt: new Date(),
            }),
          ],
        },
      });

    const res = await handler({
      requestContext: { authorizer: { jwt: { claims: { sub: 'owner-1' } } } },
    } as any);

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body!);
    expect(body.pets).toHaveLength(1);
  });

  it('returns empty list', async () => {
    sendMock.mockResolvedValueOnce({ Items: [] });
    const res = await handler({
      requestContext: { authorizer: { jwt: { claims: { sub: 'owner-1' } } } },
    } as any);
    expect(res.statusCode).toBe(200);
  });
});
