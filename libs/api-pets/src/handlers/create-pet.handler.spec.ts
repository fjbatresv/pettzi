import { handler } from './create-pet.handler';
import { OwnerRole, PetSpecies, toItemPet, toItemPetOwner } from '@peto/domain-model';

var sendMock: jest.Mock;

jest.mock('@aws-sdk/lib-dynamodb', () => {
  const mockSend = jest.fn();
  sendMock = mockSend;
  class Cmd {
    constructor(public input: any) {}
  }
  return {
    DynamoDBDocumentClient: { from: () => ({ send: mockSend }) },
    TransactWriteCommand: Cmd,
  };
});

describe('create-pet.handler', () => {
  beforeEach(() => {
    sendMock.mockReset();
    jest.spyOn(crypto, 'randomUUID').mockReturnValue('pet-1');
  });

  it('creates pet and link', async () => {
    sendMock.mockResolvedValue({});

    const res = await handler({
      body: JSON.stringify({ name: 'Fido', species: PetSpecies.DOG }),
      requestContext: { authorizer: { jwt: { claims: { sub: 'owner-1' } } } },
    } as any);

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body!);
    expect(body.petId).toBe('pet-1');
    expect(sendMock).toHaveBeenCalledTimes(1);
    const input = sendMock.mock.calls[0][0].input;
    expect(input.TransactItems).toHaveLength(2);
  });

  it('validates body', async () => {
    const res = await handler({
      body: JSON.stringify({}),
      requestContext: { authorizer: { jwt: { claims: { sub: 'owner-1' } } } },
    } as any);
    expect(res.statusCode).toBe(400);
  });
});
