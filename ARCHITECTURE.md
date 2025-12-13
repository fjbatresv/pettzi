# Arquitectura de PETTZI

Este documento describe la arquitectura de alto nivel y de detalle del sistema PETTZI, utilizando el modelo C4 y diagramas adicionales para el modelo de datos y flujos principales.

---

## 1. Resumen de la arquitectura

PETTZI es una aplicación web serverless que permite gestionar información de mascotas, propietarios y eventos de salud (vacunas, visitas, grooming), con almacenamiento de documentos y recordatorios automáticos.

Componentes principales:

- Frontend SPA (Angular 21) en `apps/web`.
- Backend basado en AWS Lambda + API Gateway HTTP API.
- Almacenamiento en DynamoDB con diseño de tabla única (Single Table Design).
- Almacenamiento de archivos en Amazon S3.
- Autenticación con Amazon Cognito.
- Recordatorios con EventBridge y correos enviados con Amazon SES.
- Infraestructura declarada con AWS CDK en `apps/cdk`.

---

## 2. C4 – Nivel 1: Diagrama de Contexto

Este diagrama muestra PETTZI como sistema y los actores externos que lo usan.

```mermaid
flowchart LR
    subgraph Users["Usuarios"]
        owner["Dueño de Mascota"]
        coOwner["Co-dueño"]
        vet["Veterinario / Groomer (futuro)"]
    end

    pettzi["Sistema PETTZI\n(Frontend + Backend Serverless)"]

    email["Proveedor de correo\n(SES / Email del usuario)"]

    owner -->|Gestiona mascotas, eventos, documentos| pettzi
    coOwner -->|Accede a mascotas compartidas| pettzi
    vet -->|"Consulta información compartida (futuro)"| pettzi

    pettzi -->|Notificaciones de recordatorios| email
```

## 3. C4 - Nivel 2: Diagrama de Contenedores

Este diagrama muestra los contenedores principales SPA, API, infraestructura serverless y servicios de AWS.

```mermaid
flowchart LR

    user["Navegador Web\n(Angular SPA)"]

    subgraph PETTZI["PETTZI en AWS"]
        webApp["Frontend SPA\napps/web (Angular 21)"]

        subgraph Backend["Backend Serverless"]
            apiGw["API Gateway HTTP API"]
            subgraph Lambdas["Lambdas por dominio"]
                authFns["Auth Lambdas\n(api-auth)"]
                petsFns["Pets Lambdas\n(api-pets)"]
                ownersFns["Owners Lambdas\n(api-owners)"]
                eventsFns["Events Lambdas\n(api-events)"]
                catalogsFns["Catalogs Lambdas\n(api-catalogs)"]
                uploadsFns["Uploads Lambdas\n(api-uploads)"]
                remindersFns["Reminders Lambda\n(api-reminders)"]
            end
        end

        subgraph Data["Datos"]
            ddb["DynamoDB\nPettziTable (Single Table)"]
            s3["S3\nBucket de documentos e imágenes"]
        end

        subgraph Identity["Identidad y correo"]
            cognito["Cognito User Pool"]
            ses["SES\nEnvío de correos"]
        end

        eventBridge["EventBridge\nReglas de recordatorios"]
    end

    user -->|HTTPS\nAngular SPA| webApp
    webApp -->|HTTP JSON| apiGw

    apiGw --> authFns
    apiGw --> petsFns
    apiGw --> ownersFns
    apiGw --> eventsFns
    apiGw --> catalogsFns
    apiGw --> uploadsFns

    authFns --> cognito
    petsFns --> ddb
    ownersFns --> ddb
    eventsFns --> ddb
    catalogsFns --> ddb
    uploadsFns --> s3

    eventBridge --> remindersFns
    remindersFns --> ddb
    remindersFns --> ses
```

## 4. C4 - Nivel 3: Componentes backend (Lambadas y dominios)

Este diagrama detalla componentes lógicos en el backend: Lambdas por dominio y sus relaciones con DynamoDB y otros servicios.

```mermaid
flowchart TB

    subgraph API["API Gateway HTTP API"]
        routeAuth["Rutas /auth/*"]
        routePets["Rutas /pets/*"]
        routeOwners["Rutas /pets/:id/owners*"]
        routeEvents["Rutas /pets/:id/events*"]
        routeCatalogs["Rutas /catalogs/*"]
        routeUploads["Rutas /uploads/*"]
    end

    subgraph Auth["Módulo Auth (libs/api-auth)"]
        authRegister["Lambda auth-register\nPOST /auth/register"]
        authLogin["Lambda auth-login\nPOST /auth/login"]
        authForgot["Lambda auth-forgot-password\nPOST /auth/forgot-password"]
        authReset["Lambda auth-reset-password\nPOST /auth/reset-password"]
    end

    subgraph Pets["Módulo Pets (libs/api-pets)"]
        petsCreate["Lambda createPet\nPOST /pets"]
        petsList["Lambda listMyPets\nGET /my/pets"]
        petsGet["Lambda getPet\nGET /pets/{petId}"]
        petsUpdate["Lambda updatePet\nPUT /pets/{petId}"]
    end

    subgraph Owners["Módulo Owners (libs/api-owners)"]
        ownerLink["Lambda linkOwner\nPOST /pets/{petId}/owners"]
        ownerList["Lambda listOwners\nGET /pets/{petId}/owners"]
        ownerUpdateRole["Lambda updateOwnerRole\nPUT /pets/{petId}/owners/{ownerId}"]
    end

    subgraph Events["Módulo Events (libs/api-events)"]
        vaccCreate["Lambda createVaccination"]
        vaccList["Lambda listVaccinations"]
        visitCreate["Lambda createVisit"]
        groomCreate["Lambda createGrooming"]
        timeline["Lambda listEventsTimeline"]
    end

    subgraph Catalogs["Módulo Catalogs (libs/api-catalogs)"]
        speciesList["Lambda listSpecies"]
        breedsList["Lambda listBreedsForSpecies"]
        vaccinesList["Lambda listVaccinesCatalog"]
    end

    subgraph Uploads["Módulo Uploads (libs/api-uploads)"]
        presign["Lambda presignUpload"]
    end

    subgraph Reminders["Módulo Reminders (libs/api-reminders)"]
        remindersProcess["Lambda reminders-process"]
    end

    ddb["DynamoDB\nPettziTable"]
    s3["S3\npettzi-docs"]
    cognito["Cognito User Pool"]
    ses["SES"]
    eventBridge["EventBridge\nReglas diarias"]

    routeAuth --> authRegister
    routeAuth --> authLogin
    routeAuth --> authForgot
    routeAuth --> authReset

    routePets --> petsCreate
    routePets --> petsList
    routePets --> petsGet
    routePets --> petsUpdate

    routeOwners --> ownerLink
    routeOwners --> ownerList
    routeOwners --> ownerUpdateRole

    routeEvents --> vaccCreate
    routeEvents --> vaccList
    routeEvents --> visitCreate
    routeEvents --> groomCreate
    routeEvents --> timeline

    routeCatalogs --> speciesList
    routeCatalogs --> breedsList
    routeCatalogs --> vaccinesList

    routeUploads --> presign

    authRegister --> cognito
    authLogin --> cognito
    authForgot --> cognito
    authReset --> cognito

    petsCreate --> ddb
    petsList --> ddb
    petsGet --> ddb
    petsUpdate --> ddb

    ownerLink --> ddb
    ownerList --> ddb
    ownerUpdateRole --> ddb

    vaccCreate --> ddb
    vaccList --> ddb
    visitCreate --> ddb
    groomCreate --> ddb
    timeline --> ddb

    speciesList --> ddb
    breedsList --> ddb
    vaccinesList --> ddb

    presign --> s3

    eventBridge --> remindersProcess
    remindersProcess --> ddb
    remindersProcess --> ses
```

## 5. Modelo de datos - Single Table en DynamoDB

La tabla principal se llama PettziTable y utiliza Single Table Design.
Campos base: PK, SK, GSI1PK, GSI1SK, entityType, más atributos específicos.

```mermaid
flowchart TB

    subgraph PettziTable["PettziTable (Single Table)"]

        userProfile["USER PROFILE
PK = USER#<userId>
SK = PROFILE
entityType = USER
email, name, createdAt, ..."]

        userPet["OWNER_PET
PK = USER#<userId>
SK = PET#<petId>
entityType = OWNER_PET
petId, role = PRIMARY|SECONDARY, createdAt"]

        petProfile["PET PROFILE
PK = PET#<petId>
SK = PROFILE
entityType = PET
primaryOwnerId, name, species, breed, birthDate, notes"]

        petOwner["PET_OWNER
PK = PET#<petId>
SK = OWNER#<userId>
entityType = PET_OWNER
role = PRIMARY|SECONDARY"]

        eventItem["EVENT
PK = PET#<petId>
SK = EVENT#<date>#<eventId>
entityType = EVENT
eventType = VACCINATION|VISIT|GROOMING
fields específicos por tipo"]

        catalogSpecies["CATALOG_SPECIES
PK = CATALOG#SPECIES
SK = <SPECIES_CODE>
entityType = CATALOG_SPECIES
label, active"]

        catalogBreed["CATALOG_BREED
PK = CATALOG#BREED#<SPECIES_CODE>
SK = <BREED_CODE>
entityType = CATALOG_BREED
label, active"]

        catalogVaccine["CATALOG_VACCINE
PK = CATALOG#VACCINE
SK = <VACCINE_CODE>
entityType = CATALOG_VACCINE
label, defaultIntervalDays, active"]

        reminderIdx["REMINDER INDEX GSI1
GSI1PK = REMINDER#VACCINATION
GSI1SK = <nextDueDate>#PET#<petId>#<eventId>"]
    end

    userProfile --> userPet
    userPet --> petProfile
    petProfile --> petOwner
    petProfile --> eventItem
    eventItem --> reminderIdx

    catalogSpecies --> catalogBreed
    catalogVaccine --> eventItem
```

## 6. Flujo de Autenticación

Flujo simplificado de registro, login y uso de JWT.

```mermaid
sequenceDiagram
    participant U as Usuario
    participant W as SPA Web
    participant A as API Gateway
    participant L as Auth Lambdas
    participant C as Cognito

    U->>W: Completa formulario de registro
    W->>A: POST /auth/register (email, password)
    A->>L: auth-register
    L->>C: SignUp / AdminCreateUser
    C-->>L: Usuario creado
    L-->>A: 201 Created
    A-->>W: Confirmación de registro

    U->>W: Inicia sesión
    W->>A: POST /auth/login (email, password)
    A->>L: auth-login
    L->>C: InitiateAuth (USER_PASSWORD_AUTH)
    C-->>L: Tokens JWT
    L-->>W: idToken / accessToken

    U->>W: Navega a /my/pets
    W->>A: GET /my/pets (Authorization: Bearer <token>)
    A->>A: JWT Authorizer valida token
    A->>Pets Lambda: listMyPets con claims (sub)
    Pets Lambda->>DynamoDB: Query OWNER_PET
    DynamoDB-->>Pets Lambda: Lista de mascotas
    Pets Lambda-->>W: JSON con mascotas
```

## 7. Flujo de multi-owner (co-dueños)

Flujo para agregar un co-dueño a una mascota

```mermaid
sequenceDiagram
    participant Owner as Dueño principal
    participant W as SPA Web
    participant A as API Gateway
    participant O as Owners Lambda
    participant D as DynamoDB

    Owner->>W: Agregar co-dueño (email o userId)
    W->>A: POST /pets/{petId}/owners (userId)
    A->>O: owners-link
    O->>D: Crear ITEM OWNER_PET (PK=USER#coOwnerId, SK=PET#petId)
    O->>D: Crear ITEM PET_OWNER (PK=PET#petId, SK=OWNER#coOwnerId)
    D-->>O: OK
    O-->>W: Confirmación

    Owner->>W: Ver lista de dueños
    W->>A: GET /pets/{petId}/owners
    A->>O: owners-list
    O->>D: Query PK=PET#petId (OWNER items)
    D-->>O: Lista de dueños
    O-->>W: PRIMARY + SECONDARY
```

## 8. Flujo de recordatorios de vacunas

Flujo nocturno de EventBridge para enviar recordatorios de vacunas próximas

```mermaid
sequenceDiagram
    participant E as EventBridge (Regla diaria)
    participant R as reminders-process Lambda
    participant D as DynamoDB
    participant S as SES
    participant U as Usuario

    E->>R: Evento programado (rate 1 day)
    R->>D: Query GSI1 (GSI1PK = REMINDER#VACCINATION, fecha entre hoy y X días)
    D-->>R: Lista de eventos próximos
    loop Por cada evento próximo
        R->>S: Enviar correo de recordatorio (email del dueño)
        S-->>U: Email de recordatorio de vacuna
    end
```

## 9. Stacks de CDK

Los stacks de CDK se organizan de forma modular:

	•	CoreInfraStack
	•	Define PettziTable (DynamoDB).
	•	Define bucket S3 para documentos.
	•	Configura SES (dominio o email verificado).
	•	AuthStack
	•	Define User Pool de Cognito.
	•	Define App Client.
	•	ApiAuthStack
	•	Define lambdas de auth (register, login, forgot, reset).
	•	Define rutas /auth/* en API Gateway.
	•	ApiPetsStack
	•	ApiOwnersStack
	•	ApiEventsStack
	•	ApiCatalogsStack
	•	UploadsStack
	•	RemindersStack
	•	Cada uno define sus lambdas y rutas.
	•	Todos referencian la misma tabla PettziTable.
	•	RemindersStack además crea la regla de EventBridge.

## 10. Notas de diseño
	•	Las lambdas deben usar helpers comunes ubicados en libs/utils-dynamo (para claves, respuestas HTTP, etc).
	•	Los modelos del dominio se definen en libs/domain-model y se reutilizan en distintas lambdas.
	•	El frontend se comunica únicamente con API Gateway; no accede directo a servicios de AWS.
	•	La evolución futura puede incluir:
	•	•	Roles adicionales (veterinarios, grooming shops).
	•	•	Planes de suscripción.
	•	•	Multi-tenant por organización.
## Custom domain strategy
- One HttpApi per bounded context; basePath mapping applied via ApiDomainStack.
- Base paths: /auth, /pets, /owners, /events, /reminders, /uploads, /catalogs.
- Internal routes and OpenAPI specs omit the basePath (added only at mapping).

## Email & notifications
- SES templates provisioned by SesTemplatesStack (welcome, reset, reminders).
- Auth API sends welcome/reset emails via SES (templated); Reminders processor emails due reminders.
- EventBridge scheduled rule triggers reminder processor daily.

## Infra recap (CDK)
- CoreInfraStack: DynamoDB PettziTable (single-table + GSI1), S3 docs bucket.
- AuthStack: Cognito user pool + client.
- LayersStack: SDK layers (cognito, s3, ses, ddb).
- API stacks: Auth/Pets/Owners/Events/Reminders/Uploads/Catalogs (HttpApi + Lambdas).
- SesTemplatesStack: SES templates.
- ApiDomainStack: custom domain + API mappings + Route53 alias.

For deeper docs see Mintlify under `mintlify/docs`.

## AppRegistry
- `PettziApplicationStack` define la aplicación y atributos en Service Catalog AppRegistry.
- `PettziAppRegistryAssociationsStack` asocia todos los stacks (core, auth, layers, APIs, SES, dominio) a la aplicación para observabilidad y trazabilidad.
