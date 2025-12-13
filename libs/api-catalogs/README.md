# api-catalogs

This library was generated with [Nx](https://nx.dev).

## Building

Run `nx build api-catalogs` to build the library.

## Running unit tests

Run `nx test api-catalogs` to execute the unit tests via [Jest](https://jestjs.io).

# @pettzi/api-catalogs

## Purpose
Serve read-only catalogs (species, breeds, vaccines) to clients.

## Responsibilities
- Read in-memory catalogs from `@pettzi/domain-model/catalogs`
- Filter by species when requested

## Key deps
- `@pettzi/domain-model`, `@pettzi/utils-dynamo`

## Tests
- `npx nx test api-catalogs`

## Deploy/usage
- Deployed by `PettziCatalogsApiStack`

## Docs
- Mintlify: `docs/catalogs-api`
- OpenAPI: `libs/api-catalogs/openapi/catalogs.yml`
