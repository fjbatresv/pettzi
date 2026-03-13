# DynamoDB Single-Table Design — PettziTable

This document reflects the **current** DynamoDB usage in the codebase.
Source of truth: `@pettzi/domain-model` + `@pettzi/utils-dynamo/key`.

## 1) Table Keys

- **PK** (string)
- **SK** (string)
- **GSI1PK** (string)
- **GSI1SK** (string)

### Common attributes (observed)
- `type` is used instead of `entityType` (e.g. `Pet`, `PetOwner`, `PetEvent`, `PetReminder`, `SharedRecord`).
- `createdAt` / `updatedAt` are present on most items (not all).
- `ttl` (epoch seconds) is used for TTL on reminders and shared records.

## 2) Key prefixes

Partition prefixes:
- `USER#<userId>`
- `OWNER#<ownerId>`
- `PET#<petId>`
- `SHARED_RECORD#<token>`
- `INVITE#<inviteeIdLower>`
- Catalogs: `CATALOG#SPECIES`, `CATALOG#BREED#<SPECIES>`, `CATALOG#VACCINE`

Sort key prefixes:
- `PROFILE`
- `SETTINGS`
- `METADATA`
- `OWNER#<ownerId>`
- `EVENT#<isoDate>#<eventId>`
- `REMINDER#<reminderId>`
- `ROUTINE#<routineId>`
- `ROUTINE_OCC#<isoDate>#<routineId>#<occurrenceId>`
- `PET#<petId>#INVITER#<inviterIdLower>`
- `PET#<petId>` (for shared record item)
- `SHARED_RECORD#<isoDate>#<token>` (GSI1 sort key)

GSI1PK prefixes:
- `OWNER#<ownerId>` (list pets by owner)
- `REMINDER#VACCINATION` (due reminders by date)
- `PET#<petId>` (list shared records by pet)

## 3) Core items and access patterns

### 3.1 UserAccount (reserved)
- **PK**: `USER#<userId>`
- **SK**: `PROFILE`
- **Notes**: defined in domain model, not currently used by API handlers.

Example:
```json
{
  "PK": "USER#u_123",
  "SK": "PROFILE",
  "type": "UserAccount",
  "userId": "u_123",
  "email": "user@example.com",
  "createdAt": "2026-01-28T00:00:00.000Z"
}
```

### 3.2 OwnerProfile
- **PK**: `OWNER#<ownerId>`
- **SK**: `PROFILE`

Example:
```json
{
  "PK": "OWNER#owner@example.com",
  "SK": "PROFILE",
  "type": "OwnerProfile",
  "ownerId": "owner@example.com",
  "userId": "owner@example.com",
  "fullName": "Javier Perez",
  "email": "owner@example.com",
  "createdAt": "2026-01-28T00:00:00.000Z",
  "updatedAt": "2026-01-28T00:00:00.000Z"
}
```

**Access**
- `GetItem(PK=OWNER#<ownerId>, SK=PROFILE)`

### 3.3 OwnerSettings (settings + notifications)
- **PK**: `OWNER#<ownerId>`
- **SK**: `SETTINGS`

Example:
```json
{
  "PK": "OWNER#owner@example.com",
  "SK": "SETTINGS",
  "theme": "light",
  "weightUnit": "kg",
  "distanceUnit": "m",
  "notifyVetVisits": true,
  "notifyMedicationReminders": true,
  "notifyGroomingAppointments": true,
  "createdAt": "2026-01-28T00:00:00.000Z",
  "updatedAt": "2026-01-28T00:00:00.000Z"
}
```

**Access**
- `GetItem(PK=OWNER#<ownerId>, SK=SETTINGS)`
- `UpdateItem(PK=OWNER#<ownerId>, SK=SETTINGS)`

### 3.4 Pet (metadata)
- **PK**: `PET#<petId>`
- **SK**: `METADATA`

Example:
```json
{
  "PK": "PET#p_456",
  "SK": "METADATA",
  "type": "Pet",
  "petId": "p_456",
  "ownerId": "owner@example.com",
  "name": "Luna",
  "species": "DOG",
  "createdAt": "2026-01-28T00:00:00.000Z",
  "updatedAt": "2026-01-28T00:00:00.000Z"
}
```

**Access**
- `GetItem(PK=PET#<petId>, SK=METADATA)`

### 3.5 PetOwner link (pet -> owners)
- **PK**: `PET#<petId>`
- **SK**: `OWNER#<ownerId>`
- **GSI1PK**: `OWNER#<ownerId>`
- **GSI1SK**: `PET#<petId>`

Example:
```json
{
  "PK": "PET#p_456",
  "SK": "OWNER#owner@example.com",
  "GSI1PK": "OWNER#owner@example.com",
  "GSI1SK": "PET#p_456",
  "type": "PetOwner",
  "petId": "p_456",
  "ownerId": "owner@example.com",
  "role": "PRIMARY",
  "linkedAt": "2026-01-28T00:00:00.000Z"
}
```

**Access**
- List owners of a pet:
  - `Query(PK=PET#<petId>, begins_with(SK, "OWNER#"))`
- List pets for an owner (GSI1):
  - `Query(GSI1PK=OWNER#<ownerId>)`

### 3.6 PetEvent
- **PK**: `PET#<petId>`
- **SK**: `EVENT#<isoDate>#<eventId>`

Example:
```json
{
  "PK": "PET#p_456",
  "SK": "EVENT#2026-01-28T18:30:00.000Z#evt_789",
  "type": "PetEvent",
  "petId": "p_456",
  "eventId": "evt_789",
  "ownerId": "owner@example.com",
  "eventType": "VACCINE",
  "eventDate": "2026-01-28T18:30:00.000Z",
  "title": "Rabies vaccine",
  "notes": "Annual booster",
  "metadata": { "nextDueAt": "2027-01-28T00:00:00.000Z" },
  "createdAt": "2026-01-28T18:30:10.000Z",
  "updatedAt": "2026-01-28T18:30:10.000Z"
}
```

**Access**
- List events by pet:
  - `Query(PK=PET#<petId>, begins_with(SK, "EVENT#"), ScanIndexForward=false)`
- Get specific event:
  - `GetItem(PK=PET#<petId>, SK=EVENT#<isoDate>#<eventId>)`

### 3.7 PetReminder
- **PK**: `PET#<petId>`
- **SK**: `REMINDER#<reminderId>`
- **GSI1PK**: `REMINDER#VACCINATION`
- **GSI1SK**: `<dueIso>#PET#<petId>#<eventId>`

Example:
```json
{
  "PK": "PET#p_456",
  "SK": "REMINDER#r_100",
  "GSI1PK": "REMINDER#VACCINATION",
  "GSI1SK": "2026-02-01T19:30:00.000Z#PET#p_456#evt_789",
  "type": "PetReminder",
  "petId": "p_456",
  "reminderId": "r_100",
  "ownerId": "owner@example.com",
  "eventId": "evt_789",
  "dueDate": "2026-02-01T19:30:00.000Z",
  "message": "Vacuna de refuerzo",
  "metadata": { "periodicity": { "type": "daily", "time": "19:30" } },
  "ruleName": "reminder-r_100",
  "createdAt": "2026-01-28T18:31:00.000Z",
  "ttl": 1764684600
}
```

**Access**
- List reminders by pet:
  - `Query(PK=PET#<petId>, begins_with(SK, "REMINDER#"))`
- List due vaccination reminders by date (GSI1):
  - `Query(GSI1PK=REMINDER#VACCINATION, begins_with(GSI1SK, "YYYY-MM-DD"))`

### 3.8 SharedRecord (share pet record)
- **PK**: `SHARED_RECORD#<token>`
- **SK**: `PET#<petId>`
- **GSI1PK**: `PET#<petId>`
- **GSI1SK**: `SHARED_RECORD#<isoDate>#<token>`

Example:
```json
{
  "PK": "SHARED_RECORD#token123",
  "SK": "PET#p_456",
  "GSI1PK": "PET#p_456",
  "GSI1SK": "SHARED_RECORD#2026-01-28T18:35:00.000Z#token123",
  "type": "SharedRecord",
  "token": "token123",
  "petId": "p_456",
  "ownerId": "owner@example.com",
  "items": ["VACCINE", "WEIGHT"],
  "expiresAt": "2026-02-04T18:35:00.000Z",
  "createdAt": "2026-01-28T18:35:00.000Z",
  "ttl": 1765132500
}
```

**Access**
- Get shared record by token:
  - `GetItem(PK=SHARED_RECORD#<token>, SK=PET#<petId>)`
- List shared records for a pet (GSI1):
  - `Query(GSI1PK=PET#<petId>, begins_with(GSI1SK, "SHARED_RECORD#"))`

### 3.9 Pending pet invites
- **PK**: `INVITE#<inviteeIdLower>`
- **SK**: `PET#<petId>#INVITER#<inviterIdLower>`

Example:
```json
{
  "PK": "INVITE#invitee@example.com",
  "SK": "PET#p_456#INVITER#owner@example.com",
  "inviteeId": "invitee@example.com",
  "inviterId": "owner@example.com",
  "petId": "p_456",
  "token": "...",
  "expiresAt": 1765132500,
  "createdAt": 1764527700
}
```

**Access**
- List pending invites for an invitee:
  - `Query(PK=INVITE#<inviteeIdLower>)`
- Delete a specific invite:
  - `DeleteItem(PK=INVITE#<inviteeIdLower>, SK=PET#<petId>#INVITER#<inviterIdLower>)`

### 3.10 Catalogs
- Species: `PK=CATALOG#SPECIES`, `SK=<SPECIES_CODE>`
- Breeds: `PK=CATALOG#BREED#<SPECIES>`, `SK=<BREED_CODE>`
- Vaccines: `PK=CATALOG#VACCINE`, `SK=<VACCINE_CODE>`

Common attributes:
- Species: `code`, `labels` (`{en, es}`), `eventTypes`, `isActive?`
- Breeds: `code`, `speciesCode`, `labels`, `weightKg` (`male/female` ranges), `deprecated?`
- Vaccines: `code`, `labels`, `speciesCode?`, `recommendedIntervalDays?`

## 4) GSI1 usage summary

GSI1 is shared across multiple item types. Disambiguation comes from distinct prefixes:
- `GSI1PK = OWNER#<ownerId>` → list pets for owner (PetOwner link items)
- `GSI1PK = REMINDER#VACCINATION` → list vaccination reminders by due date
- `GSI1PK = PET#<petId>` → list shared records for a pet

## 5) Notes and constraints

- Event ordering relies on the ISO timestamp in `SK` (`EVENT#<isoDate>#<eventId>`).
- Reminders are stored under the pet partition (no separate REMINDER partition).
- Avoid storing large payloads directly in DynamoDB; keep references in `metadata`.
