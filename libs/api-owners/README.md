# api-owners

This library was generated with [Nx](https://nx.dev).

## Building

Run `nx build api-owners` to build the library.

## Running unit tests

Run `nx test api-owners` to execute the unit tests via [Jest](https://jestjs.io).

# @pettzi/api-owners

## Purpose
Manage owner profile and co-ownership (PRIMARY/SECONDARY) links to pets.

## Responsibilities
- Get current owner profile
- List/add/remove pet owners (with PRIMARY enforcement)

## Key deps
- `@pettzi/domain-model`, `@pettzi/utils-dynamo`, AWS SDK v3 (DynamoDB)

## Tests
- `npx nx test api-owners`

## Deploy/usage
- Deployed by `PettziOwnersApiStack`

## Docs
- Mintlify: `docs/owners-api`
- OpenAPI: `libs/api-owners/openapi/owners.yml`
