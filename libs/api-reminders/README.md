# api-reminders

This library was generated with [Nx](https://nx.dev).

## Building

Run `nx build api-reminders` to build the library.

## Running unit tests

Run `nx test api-reminders` to execute the unit tests via [Jest](https://jestjs.io).

# @pettzi/api-reminders

## Purpose
Expose reminder listings and process due reminders via scheduler.

## Responsibilities
- List reminders for caller or specific pet
- EventBridge rule triggers processor to email due reminders
- Uses DynamoDB GSI1 for due-date queries

## Key deps
- `@pettzi/domain-model`, `@pettzi/utils-dynamo`, AWS SDK v3 (DynamoDB, SES)

## Tests
- `npx nx test api-reminders`

## Deploy/usage
- Deployed by `PettziRemindersApiStack`

## Docs
- Docs: `docs/reference/content/reminders-api.mdx`
- OpenAPI: `libs/api-reminders/openapi/reminders.yml`
