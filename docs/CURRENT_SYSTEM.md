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
- Sprint 15 implements the approved synthetic-data-only workforce OIDC resource-server, default-deny operation and field policy, server-derived authorization context, facility isolation, local session activity, and privacy-preserving denial boundary. It does not authorize production or real patient-data processing, and patient-facing capabilities remain blocked.
- Migration 006 persists authoritative workforce actors, role assignments, facility scopes, practitioner bindings, activation state, revocation state, and local sessions. Controlled provisioning is non-HTTP and accepts no sensitive command-line arguments.
- All 24 `/api/v1` operations require workforce authentication; the two health operations remain public. `DELETE /api/v1/patients/:patientId` remains authorization-blocked, and practitioner access to standalone patient records remains blocked pending `OPEN-09`.
- No durable security or clinical audit store, retention schedule, patient-link or merge workflow, legal applicability determination, production deployment target, or accepted operational RACI exists.
- Current records and tests use synthetic data only. Sprint 15 implementation does not authorize production deployment or processing of real patient data.

## Current Documentation Posture

- [REQUIREMENTS.md](./REQUIREMENTS.md) is the single canonical requirements register.
- [TRACEABILITY.md](./TRACEABILITY.md) maps every public API operation to requirements and tests.
- [DECISIONS.md](./DECISIONS.md) and [OPEN_DECISIONS.md](./OPEN_DECISIONS.md) keep unresolved policy questions visible.
- [ACCESS_CONTROL_BASELINE.md](./ACCESS_CONTROL_BASELINE.md) records the accountable approval for `OPEN-03`, `OPEN-04`, and `OPEN-05`, their blocked patient-facing remainder, the synthetic-data-only boundary, and the bounded Sprint 15 constraints.
- [SPRINT_15_IMPLEMENTATION_SPEC.md](./SPRINT_15_IMPLEMENTATION_SPEC.md) is the binding persistence, OIDC resource-server, provisioning, authorization, and synthetic-test specification implemented by Sprint 15.
- [PRODUCTION_READINESS_GOVERNANCE.md](./PRODUCTION_READINESS_GOVERNANCE.md) is the `PROPOSED FOR REVIEW` Sprint 16 decision package. Its privacy, audit, retention, identity, legal, ownership, and production-gate controls are not approved current behavior.
