# PettziTable – Single Table Design (Domain Model)

Runtime: Node.js 24.x (Lambdas)  
Keys use helpers from `@pettzi/utils-dynamo/key`.

## Key patterns

| Entity          | PK                       | SK                                 | GSI1PK / GSI1SK (if any)                     |
| --------------- | ------------------------ | ---------------------------------- | -------------------------------------------- |
| UserAccount     | `USER#<userId>`          | `PROFILE`                          | —                                            |
| OwnerProfile    | `OWNER#<ownerId>`        | `PROFILE`                          | —                                            |
| Pet             | `PET#<petId>`            | `METADATA`                         | optional: `GSI1` by owner if needed          |
| PetOwner link   | `PET#<petId>`            | `OWNER#<ownerId>`                  | —                                            |
| PetEvent        | `PET#<petId>`            | `EVENT#<isoDate>#<eventId>`        | —                                            |
| PetReminder     | `PET#<petId>`            | `REMINDER#<reminderId>`            | `REMINDER#VACCINATION` / `<due>#PET#<id>#…`  |
| PetRoutine       | `PET#<petId>`          | `ROUTINE#<routineId>`              | —                                            |
| RoutineActivity  | `PET#<petId>`          | `ROUTINE_ACTIVITY#<activityId>`    | —                                            |
| RoutineOccurrence | `PET#<petId>`         | `ROUTINE_OCC#<isoDate>#<activityId>#<occurrenceId>` | —                            |
| Catalog species | `CATALOG#SPECIES`        | `<SPECIES_CODE>`                   | —                                            |
| Catalog breeds  | `CATALOG#BREED#<SPECIES>`| `<BREED_CODE>`                     | —                                            |
| Catalog vaccines| `CATALOG#VACCINE`        | `<VACCINE_CODE>`                   | —                                            |

## Sample items

### UserAccount
```json
{
  "PK": "USER#u123",
  "SK": "PROFILE",
  "type": "UserAccount",
  "userId": "u123",
  "email": "user@example.com",
  "createdAt": "2025-01-01T00:00:00.000Z"
}
```

### Pet
```json
{
  "PK": "PET#pet123",
  "SK": "METADATA",
  "type": "Pet",
  "petId": "pet123",
  "ownerId": "own456",
  "name": "Fido",
  "species": "DOG",
  "createdAt": "2025-01-01T00:00:00.000Z"
}
```

### PetOwner link
```json
{
  "PK": "PET#pet123",
  "SK": "OWNER#own456",
  "type": "PetOwner",
  "petId": "pet123",
  "ownerId": "own456",
  "role": "PRIMARY",
  "linkedAt": "2025-01-01T00:00:00.000Z"
}
```

### PetEvent
```json
{
  "PK": "PET#pet123",
  "SK": "EVENT#2025-02-01T10:00:00.000Z#evt789",
  "type": "PetEvent",
  "petId": "pet123",
  "eventId": "evt789",
  "eventType": "VACCINE",
  "eventDate": "2025-02-01T10:00:00.000Z",
  "createdAt": "2025-02-01T10:00:00.000Z"
}
```

### PetReminder
```json
{
  "PK": "PET#pet123",
  "SK": "REMINDER#rem001",
  "GSI1PK": "REMINDER#VACCINATION",
  "GSI1SK": "2025-02-10T00:00:00.000Z#PET#pet123#evt789",
  "type": "PetReminder",
  "petId": "pet123",
  "reminderId": "rem001",
  "eventId": "evt789",
  "dueDate": "2025-02-10T00:00:00.000Z",
  "createdAt": "2025-01-20T00:00:00.000Z"
}
```

### PetRoutine
```json
{
  "PK": "PET#pet123",
  "SK": "ROUTINE#pet123",
  "type": "PetRoutine",
  "petId": "pet123",
  "routineId": "pet123",
  "ownerUserId": "owner@example.com",
  "status": "ACTIVE",
  "timezone": "America/Guatemala",
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z"
}
```

### RoutineActivity
```json
{
  "PK": "PET#pet123",
  "SK": "ROUTINE_ACTIVITY#act001",
  "type": "RoutineActivity",
  "petId": "pet123",
  "routineId": "pet123",
  "activityId": "act001",
  "ownerUserId": "owner@example.com",
  "title": "Morning walk",
  "routineType": "WALKING",
  "status": "ACTIVE",
  "schedule": { "frequency": "DAILY", "times": ["07:00"] },
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z"
}
```

### RoutineOccurrence
```json
{
  "PK": "PET#pet123",
  "SK": "ROUTINE_OCC#2026-01-02T07:00:00.000Z#act001#occ001",
  "type": "RoutineOccurrence",
  "petId": "pet123",
  "routineId": "pet123",
  "activityId": "act001",
  "occurrenceId": "occ001",
  "scheduledFor": "2026-01-02T07:00:00.000Z",
  "status": "PENDING",
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z"
}
```

## GSI1 for reminders
- GSI1PK = `REMINDER#VACCINATION` (from `buildReminderVaccinationGsiPk`)
- GSI1SK = `<dueIso>#PET#<petId>#<eventId>` (from `buildReminderVaccinationGsiSk`)
- Query upcoming reminders by date range on GSI1.
