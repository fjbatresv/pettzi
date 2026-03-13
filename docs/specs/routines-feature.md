# OpenSpec: Pet Routines Feature

-   **Project:** Pettzi
-   **Feature:** Pet Routines
-   **Status:** Draft
-   **Owner:** Javier Batres
-   **Audience:** Architecture, Backend, Frontend, AI agents
    (Codex/Cursor)

------------------------------------------------------------------------

## 1. Summary

This document defines the **Pet Routines** feature for Pettzi.

The goal is to support **recurrent day-to-day pet care activities** that
are not best represented as one-time reminders or event-based alerts.

Examples: - Feeding - Walking - Daily medication - Grooming habits -
Hydration - Training sessions

This feature is different from **Reminders**.

### Distinction

-   **Reminders** are for specific time-based notifications or scheduled
    future actions.
-   **Routines** are for repeated habits, checklists, and recurring care
    activities that may happen multiple times per day or per week.

------------------------------------------------------------------------

## 2. Problem Statement

The current product supports reminders and pet events, but not recurring
care habits.

Users need a way to define and track routines such as: - Walk Luna every
day at 7:00 AM and 6:00 PM - Feed Cooper every day at 8:00 AM and 8:00
PM - Give medication every 12 hours - Brush Milo every Sunday

Without routines, users are forced to misuse reminders or events for
ongoing recurring activities.

------------------------------------------------------------------------

## 3. Goals

### Primary goals

-   Allow users to create recurring routines for a pet.
-   Allow users to mark each occurrence as completed or skipped.
-   Show routines in the dashboard and pet detail views.
-   Support flexible recurrence patterns.
-   Keep reminders and routines conceptually separate.

### Secondary goals

-   Allow future analytics such as adherence/streaks/completion rates.
-   Allow future caregiver/co-owner collaboration on routines.

------------------------------------------------------------------------

## 4. Non-Goals

This feature does NOT include: - Complex calendar exceptions - Full
RRULE syntax - Multi-step workflows inside a routine - IoT
integrations - Public sharing of routines - Billing/tier restrictions

------------------------------------------------------------------------

## 5. Conceptual Model

### Reminder vs Routine

**Reminder** - Vaccines - Vet appointments - Buy food - Grooming
appointment

**Routine** - Feeding - Walking - Daily medication - Weekly brushing

------------------------------------------------------------------------

## 6. User Stories

### Create routine

As a pet owner, I want to define a routine for my pet so I can
consistently track regular care activities.

### View routine list

As a pet owner, I want to see all routines for a pet so I know what
needs to be done.

### Complete occurrence

As a pet owner, I want to mark a routine occurrence as completed so I
can track care history.

### Skip occurrence

As a pet owner, I want to skip an occurrence when needed so the system
reflects reality.

### Edit routine

As a pet owner, I want to update schedule, title, notes, and recurrence.

### Pause routine

As a pet owner, I want to pause a routine without deleting it.

------------------------------------------------------------------------

## 7. Functional Requirements

### Routine definition fields

-   routineId
-   petId
-   ownerUserId
-   title
-   type
-   notes (optional)
-   status (ACTIVE, PAUSED, ARCHIVED)
-   timezone
-   schedule definition
-   createdAt
-   updatedAt

### Routine types

-   FEEDING
-   WALKING
-   MEDICATION
-   HYGIENE
-   TRAINING
-   CUSTOM

### Occurrence fields

-   occurrenceId
-   routineId
-   petId
-   scheduledFor
-   status (PENDING, COMPLETED, SKIPPED, MISSED)
-   completedAt
-   skippedAt
-   notes
-   completedByUserId

------------------------------------------------------------------------

## 8. UX Behavior

### Create routine flow

User chooses: - title - type - notes - recurrence - time(s)

Example: - Feed every day at 8:00 AM and 8:00 PM - Walk weekdays at 6:00
PM - Medication every 12 hours

### Completion flow

User marks occurrence as completed.

### Skip flow

User marks occurrence as skipped.

### Pause flow

Paused routines stop generating occurrences.

------------------------------------------------------------------------

## 9. Data Model

### RoutineDefinition

``` json
{
  "routineId": "rt_123",
  "petId": "pet_123",
  "ownerUserId": "user_123",
  "title": "Morning walk",
  "type": "WALKING",
  "notes": "15 minutes minimum",
  "status": "ACTIVE",
  "timezone": "America/Guatemala",
  "schedule": {
    "frequency": "DAILY",
    "times": ["07:00"]
  },
  "createdAt": "2026-01-28T00:00:00.000Z",
  "updatedAt": "2026-01-28T00:00:00.000Z"
}
```

### RoutineOccurrence

``` json
{
  "occurrenceId": "ro_123",
  "routineId": "rt_123",
  "petId": "pet_123",
  "scheduledFor": "2026-01-29T07:00:00.000Z",
  "status": "PENDING",
  "completedAt": null,
  "skippedAt": null,
  "completedByUserId": null,
  "notes": null
}
```

------------------------------------------------------------------------

## 10. API Proposal

Base path: `/routines`

-   POST /routines
-   GET /routines
-   GET /routines/{routineId}
-   PUT /routines/{routineId}
-   DELETE /routines/{routineId}

Occurrences:

-   GET /routines/{routineId}/occurrences
-   POST /routines/occurrences/{occurrenceId}/complete
-   POST /routines/occurrences/{occurrenceId}/skip

Pet queries:

-   GET /pets/{petId}/routines/upcoming

------------------------------------------------------------------------

## 11. Architecture Notes

### Bounded Context

This feature should be implemented as a **new bounded context**:

-   `api-routines`
-   `routines-api-stack`

Reasons: - Routines differ conceptually from reminders - They have
different lifecycle rules - They will evolve independently

------------------------------------------------------------------------

## 12. Recommended MVP Scope

### In scope

-   Create/edit/delete routines
-   Hourly interval recurrence
-   Daily/weekly/monthly recurrence
-   Multiple times per day
-   Occurrence completion
-   Dashboard display
-   Pet detail routine list

### Out of scope

-   Advanced recurrence rules
-   Analytics
-   Notifications generated by routines
-   Public sharing

------------------------------------------------------------------------

## 13. Notes for AI Agents

Agents implementing this feature must:

-   Keep handlers thin
-   Maintain OpenAPI contracts
-   Add unit tests for:
    -   recurrence logic
    -   completion behavior
    -   skip behavior
    -   filtering
-   Avoid mixing routines with reminders
