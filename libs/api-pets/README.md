# api-pets

This library was generated with [Nx](https://nx.dev).

## Building

Run `nx build api-pets` to build the library.

## Running unit tests

Run `nx test api-pets` to execute the unit tests via [Jest](https://jestjs.io).

# @pettzi/api-pets

## Purpose
CRUD and lifecycle for pets, tied to owner links.

## Responsibilities
- Create/list/get/update/archive pets
- Enforce ownership (PRIMARY/SECONDARY) via PetOwner links
- Use DynamoDB single-table keys from domain-model

## Key deps
- `@pettzi/domain-model`, `@pettzi/utils-dynamo`, AWS SDK v3 (DynamoDB)

## Tests
- `npx nx test api-pets`

## Deploy/usage
- Deployed by `PettziPetsApiStack`

## Docs
- Mintlify: `docs/pets-api`
- OpenAPI: `libs/api-pets/openapi/pets.yml`
