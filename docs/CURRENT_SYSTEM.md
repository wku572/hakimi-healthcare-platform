# Current System

This file records the current repository state as an as-built snapshot.

## Monorepo Foundation

- npm workspaces are used across `apps/*` and `packages/*`.
- TypeScript is configured in strict mode.
- ESLint, Prettier, and workspace scripts are wired from the root package.
- `.env.example` remains placeholder-only.

## Implemented Application Surfaces

- `apps/web` renders the Hakimi / ሀኪሜ landing page and confirms the platform foundation is ready.
- `apps/api` exposes the HTTP API, schema verification, migration runner, and reminder worker entry points.
- `packages/shared` centralizes shared API types and response envelopes.

## Implemented API Domains

- Facilities support create, list, retrieve, update, and soft delete.
- Practitioners support create, list, retrieve, update, and soft delete.
- Practitioner facility assignments support create, list, update, and soft delete.
- Patients support create with initial facility registration, list, retrieve, update, and soft delete.
- Appointments support create, list, retrieve, update, and cancel without deletion.
- Health endpoints expose liveness and readiness probes.
- Appointment reminders are processed by a separate PostgreSQL-backed worker.

## Current Data And Runtime Posture

- SQL-first migrations define the schema.
- Applied migrations are immutable by convention.
- Schema verification checks column lengths, nullability, defaults, constraints, and indexes.
- Public routes use parameterized SQL through repositories and stable JSON errors through centralized middleware.
- Unexpected errors are sanitized before they reach the client.
- The API and reminder worker emit vendor-neutral structured JSON events through a closed privacy-safe field allowlist.
- API responses include an opaque `X-Request-ID`, and request logs use normalized route templates rather than concrete identifiers.
- Reminder diagnostics contain aggregate cycle counts and no per-reminder identifiers or content.
- Authentication and authorization remain absent from runtime behavior and OpenAPI. Sprint 14 documentation proposes a future identity and access-control baseline but does not enforce it.

## Current Documentation Posture

- [REQUIREMENTS.md](./REQUIREMENTS.md) is the single canonical requirements register.
- [TRACEABILITY.md](./TRACEABILITY.md) maps every public API operation to requirements and tests.
- [DECISIONS.md](./DECISIONS.md) and [OPEN_DECISIONS.md](./OPEN_DECISIONS.md) keep unresolved policy questions visible.
- [ACCESS_CONTROL_BASELINE.md](./ACCESS_CONTROL_BASELINE.md) contains separately reviewable proposals for `OPEN-03`, `OPEN-04`, and `OPEN-05`; all remain pending product-owner approval.
