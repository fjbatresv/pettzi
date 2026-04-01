# PETTZI

[![Status](https://img.shields.io/badge/status-public_reference-4c1?style=flat-square)](./README.md)
[![Portfolio](https://img.shields.io/badge/purpose-portfolio-6f42c1?style=flat-square)](./README.md)
[![Node.js](https://img.shields.io/badge/node-24-339933?style=flat-square&logo=node.js&logoColor=white)](./README.md)
[![Angular](https://img.shields.io/badge/angular-21-DD0031?style=flat-square&logo=angular&logoColor=white)](./README.md)
[![Nx](https://img.shields.io/badge/nx-monorepo-143055?style=flat-square&logo=nx&logoColor=white)](./README.md)
[![AWS](https://img.shields.io/badge/aws-serverless-FF9900?style=flat-square&logo=amazonaws&logoColor=white)](./README.md)
[![License](https://img.shields.io/badge/license-all_rights_reserved-lightgrey?style=flat-square)](./LICENSE.md)

PETTZI es un monorepo full-stack para gestión de mascotas construido con `Nx`, `Angular`, `AWS CDK` y `AWS Lambda`.

Originalmente fue concebido como un producto SaaS para salud, recordatorios, documentos y co-propiedad de mascotas. Hoy se publica como **referencia técnica y proyecto de portafolio**.

## Estado del proyecto

- El producto no continúa como servicio comercial.
- La decisión se tomó después de concluir que la propuesta no era viable comercialmente.
- El repositorio se conserva para mostrar decisiones de arquitectura, organización del monorepo y diseño backend/frontend.
- El workflow automático de despliegue en GitHub Actions fue desactivado intencionalmente.
- La infraestructura y los docs de despliegue se mantienen como referencia para estudio o self-hosting.

## Qué demuestra este repositorio

- Arquitectura serverless modular sobre AWS.
- Monorepo `Nx` con separación por bounded contexts.
- APIs backend desacopladas por dominio (`auth`, `pets`, `owners`, `events`, `reminders`, `uploads`, `catalogs`).
- Lambdas delgadas con lógica movida a servicios y librerías reutilizables.
- Uso de `DynamoDB` con single-table design orientado por access patterns.
- Frontend `Angular` conectado a una arquitectura backend basada en contratos OpenAPI.

## Stack principal

### Backend e infraestructura
- `AWS CDK v2`
- `AWS Lambda` sobre `Node.js 24`
- `API Gateway HTTP API`
- `DynamoDB`
- `S3`
- `SES`
- `Cognito`
- `EventBridge`

### Frontend y tooling
- `Angular 21`
- `Nx`
- `TypeScript`
- `Jest`
- `ESLint`
- `Prettier`
- `GitHub Actions` para CI

## Arquitectura en una mirada

- `apps/web`: aplicación Angular.
- `apps/cdk`: definición de stacks de infraestructura.
- `libs/api-*`: bounded contexts y handlers por API.
- `libs/domain-model`: modelos, claves y mapeos del dominio.
- `libs/utils-dynamo`, `libs/shared-utils`, `libs/infra-constructs`: utilidades y componentes reutilizables.

### Bounded contexts
- `Auth`: autenticación y perfil de usuario.
- `Pets`: CRUD de mascotas.
- `Owners`: relación de dueños y co-dueños.
- `Events`: timeline y eventos de salud.
- `Reminders`: recordatorios programados.
- `Uploads`: documentos y fotos vía URLs firmadas.
- `Catalogs`: catálogos de apoyo.

## Estructura del monorepo

```text
pettzi/
├── apps/
│   ├── cdk/
│   └── web/
├── libs/
│   ├── api-auth/
│   ├── api-catalogs/
│   ├── api-events/
│   ├── api-owners/
│   ├── api-pets/
│   ├── api-reminders/
│   ├── api-uploads/
│   ├── domain-model/
│   ├── infra-constructs/
│   ├── shared-utils/
│   └── utils-dynamo/
├── docs/
├── ARCHITECTURE.md
├── DESIGN-SYSTEM.md
└── TABLE_DESIGN.md
```

## Cómo explorarlo localmente

### Requisitos
- `Node.js 24`
- `npm`
- AWS solo si quieres levantar o self-hostear la infraestructura

### Comandos útiles

```bash
npm install
npx nx graph
npx nx run-many -t lint test
```

### Documentación local

- Start with `docs/README.md`
- Browse reference pages under `docs/reference/content/`

### Variables de entorno

- Usa `.env.example` como referencia.
- No se incluyen secretos reales ni configuración operativa activa en el árbol actual.

## Infraestructura y despliegue

- La arquitectura de despliegue original sigue documentada en el repositorio.
- El despliegue automático desde GitHub Actions está desactivado.
- Si quieres reutilizar esta base para self-hosting, revisa primero variables, dominios, secretos y supuestos de AWS.

## Documentación clave

- `ARCHITECTURE.md` — arquitectura general y decisiones técnicas.
- `TABLE_DESIGN.md` — diseño de DynamoDB y patrones de acceso.
- `DESIGN-SYSTEM.md` — lineamientos visuales del frontend.
- `apps/cdk/README.md` — guía de infraestructura CDK.
- `docs/reference/content/overview.mdx` — overview navegable.
- `docs/reference/content/quickstart.mdx` — primeros pasos.

## Calidad y contribución

- `CONTRIBUTING.md` — guía de contribución.
- `SECURITY.md` — reporte responsable de vulnerabilidades.
- `CODE_OF_CONDUCT.md` — expectativas de convivencia.
- `LICENSE.md` — estado actual de licencia.

## Por qué este repo sigue público

Aunque PETTZI no avanzó como producto comercial, el código sigue siendo valioso como muestra de:

- diseño de backend por dominios
- organización de un monorepo `Nx`
- integración entre frontend, infraestructura y APIs
- decisiones pragmáticas para un producto serverless real

Si quieres revisar algo en particular, empieza por `ARCHITECTURE.md`, `TABLE_DESIGN.md` y `apps/cdk/src/main.ts`.
