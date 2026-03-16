# Pet Routines

## Concept

Each pet has a single routine container. That routine is made of many activities that the owner normally does through the day.

Examples:

- Feed at `09:00` and `21:00` every day
- Walk at `08:00` every day
- Play at `13:00` every day
- Go to the park at `10:00` every Sunday

This feature is not meant to send a push reminder every time an activity is due. The main experience is:

1. Show the pet routine ordered by time of day in the web dashboard.
2. Let the owner mark activities as completed or skipped.
3. Support a daily review flow later without coupling routine completions to events or reminders.

## Scope

- One routine container per pet
- Multiple routine activities per pet
- Daily, weekly and monthly schedules
- Short materialized occurrence window for today/history UI
- No automatic `events` creation
- No per-occurrence notifications

## Domain Model

### PetRoutine

Single container for a pet:

- `routineId`
- `petId`
- `ownerUserId`
- `timezone`
- `status`
- `createdAt`
- `updatedAt`

### RoutineActivity

An item inside the pet routine:

- `activityId`
- `routineId`
- `petId`
- `ownerUserId`
- `title`
- `type`
- `notes?`
- `status`
- `schedule`
- `createdAt`
- `updatedAt`

### RoutineOccurrence

Materialized execution state for an activity at a concrete date/time:

- `occurrenceId`
- `routineId`
- `activityId`
- `petId`
- `scheduledFor`
- `status`
- `completedAt?`
- `skippedAt?`
- `notes?`
- `completedByUserId?`
- `createdAt`
- `updatedAt`

## Scheduling Rules

### Daily

```json
{
  "frequency": "DAILY",
  "times": ["08:00", "21:00"]
}
```

### Weekly

```json
{
  "frequency": "WEEKLY",
  "daysOfWeek": [0],
  "times": ["10:00"]
}
```

`daysOfWeek` uses `0-6` for `Sunday-Saturday`.

### Monthly

```json
{
  "frequency": "MONTHLY",
  "daysOfMonth": [1, 15],
  "times": ["09:00"]
}
```

## Persistence

Single-table DynamoDB stays unchanged at the table level. The feature uses pet-scoped items:

- routine container: `PK=PET#<petId>`, `SK=ROUTINE#<routineId>`
- routine activity: `PK=PET#<petId>`, `SK=ROUTINE_ACTIVITY#<activityId>`
- routine occurrence: `PK=PET#<petId>`, `SK=ROUTINE_OCC#<scheduledFor>#<activityId>#<occurrenceId>`

No scans are allowed. All reads are `Query` by pet partition key.

## Occurrence Strategy

- Materialize only a short window
- Suggested window: last `14` days + next `30` days
- `COMPLETED`, `SKIPPED` and `MISSED` occurrences remain available for short history
- Regeneration happens:
  - when reading `today`
  - when reading `history`
  - after creating, updating or deleting an activity
  - after updating routine timezone/status

## Business Rules

- A pet may have zero or one routine container
- Creating the first activity creates the routine container if needed
- `ACTIVE` routine + `ACTIVE` activity generate occurrences
- `PAUSED` routine or activity stops generating new pending occurrences
- `ARCHIVED` routine blocks activity mutations and occurrence actions
- Completing or skipping an occurrence does not create a pet event
- Past pending occurrences become `MISSED` when the window is synced

## API Surface

- `GET /pets/{petId}/routine`
- `PUT /pets/{petId}/routine`
- `POST /pets/{petId}/routine/activities`
- `PATCH /pets/{petId}/routine/activities/{activityId}`
- `DELETE /pets/{petId}/routine/activities/{activityId}`
- `GET /pets/{petId}/routine/today`
- `GET /pets/{petId}/routine/history`
- `POST /pets/{petId}/routine/occurrences/{occurrenceId}/complete`
- `POST /pets/{petId}/routine/occurrences/{occurrenceId}/skip`

OpenAPI remains the source of truth in [`/Users/javierbatres/Documents/pettzi/libs/api-routines/openapi/routines.yml`](/Users/javierbatres/Documents/pettzi/libs/api-routines/openapi/routines.yml).

## UX Expectations

- The dashboard keeps the current timeline tab
- The routines tab shows:
  - routine activities ordered by scheduled time for today
  - actions to complete and skip
  - activity editor for create/update
  - short history
- Optional fields should be hidden when empty
- Reminders remain separate from routines
