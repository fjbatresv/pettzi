# api-owners

This library was generated with [Nx](https://nx.dev).

## Building

Run `nx build api-owners` to build the library.

## Running unit tests

Run `nx test api-owners` to execute the unit tests via [Jest](https://jestjs.io).

# @peto/api-owners

## Purpose
Manage owner profile and co-ownership (PRIMARY/SECONDARY) links to pets.

## Responsibilities
- Get current owner profile
- List/add/remove pet owners (with PRIMARY enforcement)

## Key deps
- `@peto/domain-model`, `@peto/utils-dynamo`, AWS SDK v3 (DynamoDB)

## Tests
- `npx nx test api-owners`

## Deploy/usage
- Deployed by `PetoOwnersApiStack`

## Docs
- Mintlify: `docs/owners-api`
- OpenAPI: `libs/api-owners/openapi/owners.yml`
