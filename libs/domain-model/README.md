# domain-model

This library was generated with [Nx](https://nx.dev).

## Building

Run `nx build domain-model` to build the library.

## Running unit tests

Run `nx test domain-model` to execute the unit tests via [Jest](https://jestjs.io).

# @pettzi/domain-model

## Purpose
Central domain types, key builders, mappers, and catalogs for the single-table design.

## Responsibilities
- Enums/types for pets, owners, events, reminders
- Key builders (PK/SK/GSI) and mappers to/from DynamoDB items
- Catalog data (species, breeds, vaccines)

## Key deps
- None beyond TypeScript/tslib; consumed by all API libs

## Tests
- `npx nx test domain-model`

## Docs
- Docs: `docs/reference/content/data-model.mdx`
- Table design: `TABLE_DESIGN.md`
