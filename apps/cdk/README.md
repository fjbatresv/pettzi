
# apps/cdk

## Purpose
CDK app that defines all backend stacks for PETO (infra + APIs + domain + SES templates).

## Responsibilities
- Core infra (DynamoDB table, S3 docs bucket)
- Cognito user pool/client
- Layers for shared SDK deps
- HttpApi stacks per bounded context (auth, pets, owners, events, reminders, uploads, catalogs)
- SES templates and custom domain mappings

## Key dependencies
- aws-cdk-lib v2, constructs v10
- Nx target `cdk:deploy`

## Tests / build
- `npx nx run cdk:lint`
- `npx nx run cdk:build:production`

## Deploy
- `npx nx run cdk:deploy -- <StackName ...>`

## Docs
- See Mintlify: `docs/stacks-overview`, `docs/custom-domain`, `docs/ses-templates`.
