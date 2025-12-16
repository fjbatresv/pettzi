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
### Auth API overview
- `POST /auth/register`: creates the user, auto-confirms it, fires the SES welcome template with the verification link and returns JWTs.
- `POST /auth/login`: authenticates with email/password. If Cognito signals `NEW_PASSWORD_REQUIRED` (temporary password flow) it returns `{ challenge: 'NEW_PASSWORD_REQUIRED', session }` (fails fast with a 400 if Cognito omits the session); otherwise it returns the JWTs. Ensure the client stores the session before calling `/complete-new-password`.
- `POST /auth/forgot-password`: generates a temporary password, sets it in Cognito (permanent=false), and sends it through the SES reset template so the user can log in immediately.
- `POST /auth/complete-new-password`: consumes the `session` from the challenge and the desired new password, completes the `NEW_PASSWORD_REQUIRED` challenge and returns JWTs.
- `POST /auth/confirm-email`: verifies the HMAC-backed token that was embedded in the welcome email; token is provided in the JSON payload (`{ token: '...' }`).

## Key deps
- `@pettzi/domain-model`, `@pettzi/utils-dynamo`, AWS SDK v3 (Cognito, SES)

## Tests
- `npx nx test api-auth`

## Deploy/usage
- Deployed by `PettziAuthApiStack` (apps/cdk)

## Docs
- Mintlify: `docs/auth-api`
- OpenAPI: `libs/api-auth/openapi/auth.yml`
