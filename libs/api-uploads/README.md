# api-uploads

This library was generated with [Nx](https://nx.dev).

## Building

Run `nx build api-uploads` to build the library.

## Running unit tests

Run `nx test api-uploads` to execute the unit tests via [Jest](https://jestjs.io).

# @peto/api-uploads

## Purpose
Provide presigned URLs for pet photos/documents and list/download/delete files.

## Responsibilities
- Validate ownership before issuing URLs
- Generate S3 PUT/GET URLs and list objects under pet prefixes

## Key deps
- `@peto/domain-model`, `@peto/utils-dynamo`, AWS SDK v3 (S3, DynamoDB)

## Tests
- `npx nx test api-uploads`

## Deploy/usage
- Deployed by `PetoUploadsApiStack`

## Docs
- Mintlify: `docs/uploads-api`
- OpenAPI: `libs/api-uploads/openapi/uploads.yml`
