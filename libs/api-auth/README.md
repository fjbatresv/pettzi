# api-auth

This library was generated with [Nx](https://nx.dev).

## Building

Run `nx build api-auth` to build the library.

## Running unit tests

Run `nx test api-auth` to execute the unit tests via [Jest](https://jestjs.io).

# @pettzi/api-auth

## Purpose
Auth Lambdas for register/login/forgot/confirm backed by Cognito.

## Responsibilities
- Handle email/password flows
- Use `@pettzi/utils-dynamo` for HTTP responses
- Trigger welcome/reset emails via SES templates when configured

## Key deps
- `@pettzi/domain-model`, `@pettzi/utils-dynamo`, AWS SDK v3 (Cognito, SES)

## Tests
- `npx nx test api-auth`

## Deploy/usage
- Deployed by `PettziAuthApiStack` (apps/cdk)

## Docs
- Mintlify: `docs/auth-api`
- OpenAPI: `libs/api-auth/openapi/auth.yml`
