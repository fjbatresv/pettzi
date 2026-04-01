
# apps/cdk

## Purpose
CDK app that defines all backend stacks for PETTZI (infra + APIs + domain + SES templates).

> Public repo note: these stacks are preserved as infrastructure reference for the original product architecture. Automated GitHub publishing is intentionally disabled.

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
- Use only for manual or self-hosted deployments after reviewing AWS credentials, domains, and environment assumptions.

## Docs
- See Mintlify: `docs/stacks-overview`, `docs/custom-domain`, `docs/ses-templates`.

## AppRegistry
- `PettziApplicationStack` crea la aplicación y el atributo de AppRegistry.
- `PettziAppRegistryAssociationsStack` asocia los stacks ya desplegados a la aplicación.
- Despliegue recomendado:
  1) `npx nx run cdk:deploy -- PettziApplicationStack`
  2) Desplegar Core/Auth/Layers/APIs/SES/Domain
  3) `npx nx run cdk:deploy -- PettziAppRegistryAssociationsStack`
