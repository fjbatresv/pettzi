# AGENTS.md — Guidelines for AI Agents (Codex / Cursor)

This repository is developed using AI agents acting as **implementers**, with a human acting as **architect and final reviewer**.
Agents MUST follow these rules strictly.

---

## 1. Core Principles (Non-Negotiable)

- Do NOT introduce new architecture, patterns, or flows without explicit approval.
- Do NOT change authentication, authorization, or security behavior.
- Do NOT change DynamoDB key patterns or table design.
- Do NOT introduce new AWS services (VPC, NAT, RDS, OpenSearch, etc.).
- Do NOT add heavy dependencies or frameworks.
- Prefer **clarity, predictability, and maintainability** over clever abstractions.

If unsure → STOP and ASK.

---

## 2. Repository Context

- Nx monorepo:
  - `apps/cdk` → AWS CDK stacks
  - `apps/web` → Angular web app
  - `libs/*` → bounded contexts and shared libraries
- Node.js runtime: **Node 24**
- Each backend API:
  - Has its own `libs/api-*`
  - Has its own CDK stack
  - Has a unique base path (`/auth`, `/pets`, `/owners`, `/events`, `/reminders`, `/uploads`, `/catalogs`)
- OpenAPI is the source of truth for APIs.

---

## 3. Coding Rules (Backend)

### Lambda Handlers
- Must be **thin**:
  - parse input
  - validate
  - call service
  - return response
- No business logic in handlers.
- Target ≤ **80 lines per handler**.

### Services / Libs
- Encapsulate domain logic.
- Prefer pure functions.
- Avoid side effects unless necessary.
- Functions should be small and composable.

### DynamoDB
- Follow `TABLE_DESIGN.md` strictly.
- Use domain-model key builders and mappers.
- Prefer `Query` over `Scan`.
- `Scan` requires explicit approval.

---

## 4. Frontend & UX

- Follow existing design system (tokens, spacing, typography).
- Avoid introducing new UI patterns unless requested.
- Optional fields:
  - Do NOT render placeholders like “N/A”
  - Hide the row if empty
- New event types must update:
  - Forms
  - Dashboard
  - Event detail
  - Timeline
  - Translations (ES / EN)

---

## 5. Testing & Quality (Very Important)

### Coverage
- **≥ 80% coverage** for touched files is mandatory.
- If coverage drops, tests must be added.

### Tests must:
- Validate behavior, not implementation details.
- Cover:
  - happy path
  - validation errors
  - edge cases
- Be readable and intention-revealing.

### Tests must NOT:
- Mock everything just to “make it pass”.
- Assert only that a function was called.
- Be snapshots for business logic.

---

## 6. OpenAPI Contract Rules

- Any API change MUST:
  - update OpenAPI (`libs/api-*/openapi/*.yml`)
  - align handlers with the contract
  - update tests accordingly
- Routes, schemas, and error responses must match implementation.

---

## 7. Nx & Tooling

- Always use `nx` to run tasks:
  - `nx lint`
  - `nx test`
  - `nx build`
- Prefer `nx affected` when applicable.
- Do not bypass Nx tooling.

---

## 8. Git & Commits

- One feature or fix per commit.
- Do not mix unrelated changes.
- Commit message format:
  - `feat(web): ...`
  - `fix(api-events): ...`
  - `refactor(shared-utils): ...`

---

## 9. When to STOP and Ask

Agents MUST ask for clarification when:
- Requirements are ambiguous.
- A change impacts multiple bounded contexts.
- A design decision is required.
- Performance or cost tradeoffs appear.
- Data modeling changes are implied.

---

## 10. Definition of DONE

A task is done only when:
- Code follows these rules
- Tests are added and passing
- Coverage is maintained
- OpenAPI is updated (if API)
- `nx lint`, `nx test`, `nx build` pass
