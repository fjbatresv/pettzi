# PETO – Monorepo (Nx + AWS CDK + Serverless Lambdas)

PETO es un gestor de mascotas con enfoque en salud, vacunas, visitas veterinarias, grooming, co-propiedad, documentos y recordatorios automáticos.

---

## Descripción general

PETO permite a los usuarios administrar toda la información relacionada con sus mascotas:

- Perfil de mascota (datos generales, especie, raza, notas, foto)
- Manejo de múltiples dueños (PRIMARY y SECONDARY)
- Eventos de salud:
  - Vacunas
  - Visitas veterinarias
  - Grooming / baños
- Carga y almacenamiento de documentos (S3)
- Recordatorios automáticos de vacunas mediante EventBridge
- Catálogos (especies, razas, vacunas)
- Autenticación con Amazon Cognito
- Base de datos en DynamoDB usando Single-Table Design

El proyecto está diseñado como un SaaS serverless, modular, escalable y de bajo costo.

---

## Tecnologías principales

### Backend / Infraestructura
- AWS CDK (TypeScript)
- AWS Lambda (Node.js 20)
- API Gateway HTTP API
- DynamoDB (Single Table)
- S3 (archivos y documentos)
- SES (envío de correos)
- Cognito (autenticación)
- EventBridge (tareas programadas)

### Frontend
- Angular 21 (SPA)
- Nx como gestor del monorepo

### Herramientas internas
- Nx Monorepo
- TypeScript
- Eslint + Prettier
- Jest para pruebas unitarias
- GitHub Actions o AWS CodeBuild para CI/CD

---

## Arquitectura general (resumen)

La arquitectura está compuesta por:

- Monorepo Nx separando frontend, infraestructura y backend.
- Librerías modulares (auth, pets, owners, events, catalogs, uploads, reminders).
- CDK dividido en stacks independientes.
- DynamoDB como single-table, diseñando claves para patrones de acceso reales.
- Lambdas pequeñas, enfocadas en una responsabilidad.
- API Gateway con JWT Authorizer basado en Cognito.
- S3 para documentos y fotos.
- EventBridge para recordatorios automáticos.

---

## Estructura de carpetas

### Root

```bash
peto/
├── apps/
├── libs/
├── tools/
├── nx.json
├── package.json
├── tsconfig.base.json
└── ARCHITECTURE.md

```

---

## APPS

### Frontend

```bash
apps/web/
├── src/
└── project.json
```

### Infraestructura (CDK)

```bash
apps/peto-cdk/
├── bin/
│   └── peto.ts
├── lib/
│   ├── core-infra.stack.ts
│   ├── auth.stack.ts
│   ├── api-auth.stack.ts
│   ├── api-pets.stack.ts
│   ├── api-owners.stack.ts
│   ├── api-events.stack.ts
│   ├── api-catalogs.stack.ts
│   ├── uploads.stack.ts
│   └── reminders.stack.ts
└── project.json
```

---

## LIBS (Backend por módulo)

### Autenticación

```bash
libs/api-auth/
```

### Pets

```bash
libs/api-pets/
```

### Owners

```bash
libs/api-owners/
```

### Events (vacunas, visitas, grooming, timeline)

```bash
libs/api-events/
```

### Catálogos

```bash
libs/api-catalogs/
```

### Uploads (S3)

```bash
libs/api-uploads/
```

### Reminders (EventBridge)

```bash
libs/api-reminders/
```

## LIBS (Dominio y utilidades)

### Modelos del dominio

```bash
libs/domain-model/
```

### Utilidades DynamoDB

```bash
libs/utils-dynamo/
```

### Constructos CDK reutilizables

```bash
libs/infra-constructs/
```

### Utilidades generales

```bash
libs/shared-utils/
```

---

## Herramientas NX

```bash
tools/
├── scripts/
│   ├── deploy.ts
│   ├── build-all.ts
│   └── clean.ts
└── generators/
├── lambda/
└── stack/
```

---

## Principios de desarrollo

### 1. Serverless First
- Lambdas pequeñas y enfocadas.
- Infraestructura como código usando CDK.
- Alta escalabilidad y disponibilidad sin gestionar servidores.

### 2. Single-Table DynamoDB
- Estructura centrada en patrones de acceso.
- Uso de PK/SK y GSIs según consultas.
- Evitar múltiples tablas para reducir costos y aumentar performance.

### 3. Modularidad con Nx
- Cada módulo tiene su propio bounded context.
- Código compartido en libs reutilizables.
- Builds incrementales y rápidos.

### 4. Seguridad desde el diseño
- Cognito para autenticación
- API Gateway Authorizer
- Validación estricta de inputs

### 5. Desarrollo incremental
- Cada feature es un stack independiente.
- Facilita mantenimiento y despliegues aislados.

### 6. Performance
- Node.js 20 limpio
- Minimizar dependencias
- Cargar solo lo necesario para cada Lambda

---

## Testing

### Pruebas Unitarias
- Se usa Jest.
- Cada Lambda debe incluir tests básicos.
- Utilidades compartidas deben tener cobertura mínima.

### QA Manual
Basado en acceptance criteria del backlog:

- Autenticación
- Pets
- Owners
- Events
- Uploads
- Reminders
- Catálogos

---

## CI/CD

Recomendado:

- GitHub Actions con:
  - Lint
  - Test
  - Build
  - CDK Synth

### Deploy manual

```bash
npx nx run peto-cdk:deploy
```

---

## Convenciones de código

- TypeScript estricto
- camelCase para variables
- PascalCase para constructos y clases
- Validaciones tempranas
- Handlers sin lógica pesada (usar libs)
- Una responsabilidad por archivo
- Prettier obligatorio

---

## Guía para contribuir

1. Crear una rama: ```feat/***```
2. Escribir o actualizar tests si aplica.
3. Formatear código: ```npx nx format```
4. Crear Pull Request.
5. Hacer merge solo cuando todo pase correctamente.

---

## Siguientes pasos

El archivo ```ARCHITECTURE.md``` incluirá:

- Diagramas C4 (niveles 1 a 3)
- Diagrama detallado del backend
- Esquema de DynamoDB Single Table
- Flujos de autenticación
- Flujos de co-dueños y permisos
- Flujos de recordatorios
- Diagrama CDK por stack

## Documentation
- Mintlify docs (local): `cd mintlify && npx mintlify dev`
- Pages live under `mintlify/docs/*.mdx` with OpenAPI specs in `libs/api-*/openapi/*.yml`.

## Current backend stacks
- CoreInfraStack (DynamoDB PetoTable, docs bucket)
- AuthStack (Cognito user pool + client)
- LayersStack (SDK layers: cognito, s3, ses, ddb)
- Auth/Pets/Owners/Events/Reminders/Uploads/Catalogs API stacks (one HttpApi per bounded context)
- SesTemplatesStack (welcome/reset/reminder templates)
- ApiDomainStack (custom domain + basePath mappings per API)

## Runtime / tooling
- Node.js 24.x (required)
- Nx for build/test/deploy (`npx nx <target> <project>`)
- CDK v2 for infra (`npx nx run cdk:deploy -- <StackName>`)
