import { apiPets } from './api-pets';

describe('apiPets', () => {
  it('should work', () => {
    expect(apiPets()).toEqual('api-pets');
  });
});
