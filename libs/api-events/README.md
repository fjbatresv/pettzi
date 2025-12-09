# api-events

This library was generated with [Nx](https://nx.dev).

## Building

Run `nx build api-events` to build the library.

## Running unit tests

Run `nx test api-events` to execute the unit tests via [Jest](https://jestjs.io).

# @peto/api-events

## Purpose
Manage pet events (vaccines, vet visits, grooming) and optional reminders.

## Responsibilities
- CRUD operations on events per pet
- Ownership validation via PetOwner link
- Optional creation/update of reminders from event payload

## Key deps
- `@peto/domain-model`, `@peto/utils-dynamo`, AWS SDK v3 (DynamoDB)

## Tests
- `npx nx test api-events`

## Deploy/usage
- Deployed by `PetoEventsApiStack`

## Docs
- Mintlify: `docs/events-api`
- OpenAPI: `libs/api-events/openapi/events.yml`
