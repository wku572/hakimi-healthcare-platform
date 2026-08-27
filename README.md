# Hakimi / ሀኪሜ

Hakimi is a Practo-like healthcare appointment platform for Ethiopia.
This repository starts as a monorepo foundation for the web app, API, shared types, and future DevOps work.

## Workspace Layout

- `apps/web` - React + Vite frontend
- `apps/api` - Node.js + Express API
- `packages/shared` - shared TypeScript types and contracts
- `docs` - project documentation
- `infrastructure` - empty structure for future DevOps configuration
- `.github/workflows` - reserved for future CI/CD
- `compose.yaml` - production-shaped local container stack for the API, worker, migrations, and PostgreSQL
- `apps/api/database/migrations/up` - ordered SQL migration files
- `apps/api/database/migrations/down` - matching rollback SQL files

## Prerequisites

- Node.js 24+
- npm 11+
- Docker Desktop or Docker Engine with Compose v2

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Prepare local environment variables:

   - Review `.env.example` for development-only placeholders.
   - If `.env` already exists, keep it and add only missing values.
   - If `.env` does not exist, create it from `.env.example`.

The API expects:

- `PORT`
- `NODE_ENV`
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `DATABASE_URL`
- `LOG_LEVEL`
- `OIDC_ISSUER`
- `OIDC_AUDIENCE`
- `OIDC_JWKS_URI`
- `OIDC_ALLOWED_ALGORITHMS`
- `OIDC_REQUIRED_ACR_VALUES`
- `OIDC_CLOCK_TOLERANCE_SECONDS`
- `REMINDER_WORKER_ID`
- `REMINDER_POLL_INTERVAL_MS`
- `REMINDER_BATCH_SIZE`
- `REMINDER_LEASE_MS`
- `REMINDER_MAX_ATTEMPTS`
- `REMINDER_BACKOFF_BASE_MS`
- `REMINDER_BACKOFF_CAP_MS`

3. Start PostgreSQL for local development:

   ```bash
   npm run db:up
   ```

4. Check container health:

   ```bash
   npm run db:status
   ```

5. Start the development servers:

   ```bash
   npm run dev
   ```

## Containerized Deployment

The repository now includes a production-shaped container stack built from one reusable application image.

Build the image directly:

```bash
docker build -t hakimi-healthcare-platform:local .
```

The reusable image supports these runtime commands:

- API: `node server.js`
- Worker: `node reminders/worker.js`
- Migration status: `node migrate.js status`
- Schema verification: `node schema-verify.js`

Start the complete stack:

```bash
docker compose up --build
```

The stack includes:

- `postgres` - local PostgreSQL with a persistent named volume
- `migrate` - a one-shot migration service that runs before the app processes
- `api` - the HTTP API
- `worker` - the reminder worker

The migration service is intentionally separate from the app processes. If it fails, the API and worker do not start.

Useful checks:

```bash
docker compose config
docker compose ps
docker compose logs -f migrate api worker
```

Health endpoints:

- Liveness: `GET /health/live`
- Readiness: `GET /health/ready`

The Compose health check uses Node's built-in `fetch` from inside the final image, so it does not depend on `curl`.

The API and worker write newline-delimited structured JSON to stdout and stderr. Every event includes `timestamp`, `severity`, `service`, and `eventCode`; `LOG_LEVEL` remains the environment control for severity filtering. The logging boundary uses stable event codes and a closed field allowlist so runtime diagnostics remain vendor-neutral and privacy-safe.

Graceful shutdown:

- The API closes its HTTP server and PostgreSQL pool on `SIGINT` and `SIGTERM`.
- The reminder worker stops polling and closes its PostgreSQL pool on `SIGINT` and `SIGTERM`.

Environment configuration:

- `.env.example` contains placeholders only.
- The containers expect environment variables to be injected at runtime.
- If you want local convenience values, create a private `.env` file from `.env.example`.
- `LOG_LEVEL` accepts `info`, `warn`, or `error` and defaults to `info`.

Runtime observability:

- Every API response includes an opaque `X-Request-ID` for correlation.
- Valid incoming IDs must be lowercase RFC 4122 UUID v4 values; missing or invalid values are replaced cryptographically.
- Request logs use normalized route templates and never include query values, headers, bodies, cookies, concrete healthcare identifiers, raw errors, SQL, stack traces, or secrets.
- Readiness checks emit opaque `POSTGRES_CONNECTIVITY_SUCCEEDED` or `POSTGRES_CONNECTIVITY_FAILED` events without changing their established HTTP responses.
- An HTTP listener startup failure emits `API_STARTUP_FAILED` once, closes the PostgreSQL pool, and exits with code `1` even if pool cleanup fails.
- Reminder worker events contain aggregate cycle counts only and never contain reminder content or row-level identifiers.
- The stable event catalogue and diagnostic procedures are documented in [docs/OPERATIONS_RUNBOOK.md](docs/OPERATIONS_RUNBOOK.md).

PostgreSQL persistence:

- The `postgres_data_sprint2` named volume persists data across normal `docker compose down` and `docker compose up` cycles.
- `docker compose down -v` deletes the database volume and is destructive.

Troubleshooting:

- If `migrate` fails, inspect `docker compose logs -f migrate` first.
- If the API stays unhealthy, confirm the database is reachable and migrations completed successfully.
- If the worker exits, inspect `docker compose logs -f worker` and verify `DATABASE_URL`.

Rollback warning:

- `npm run db:migrate:down` rolls back only the latest migration.
- Backward-incompatible schema changes should be introduced with a new migration, not by editing an applied one.

Production limits:

- Sprint 15 implements a workforce-only OIDC resource-server and server-derived access-control baseline for synthetic data.
- Production deployment, real patient-data processing, patient accounts, login, recovery, and HTTP role administration are not authorized.
- Do not bake secrets into the image or commit production credentials.
- Use environment injection or an external secret manager in real deployments.

## Workforce Access Control

The 24 `/api/v1` operations require a short-lived OIDC bearer access token. The API validates an asymmetric signature, exact issuer and audience, bounded token age, approved workforce MFA `acr`, and required OIDC session claims. The two health operations remain public.

Authorization is default deny. Tokens identify an issuer, subject, and identity-provider session only; they never supply roles, facility scopes, practitioner links, activation state, or revocation state. The API derives that immutable context from the Sprint 15 PostgreSQL authority tables on every request:

- `workforce_actors`
- `workforce_role_assignments`
- `workforce_sessions`

The approved workforce roles are `PLATFORM_ADMIN`, `FACILITY_ADMIN`, `SCHEDULER`, `PRACTITIONER`, and `OPERATIONS_OPERATOR`. No `PATIENT` role can be provisioned. `DELETE /api/v1/patients/:patientId` remains policy-blocked, and practitioners cannot access standalone patient records pending the unresolved appointment-policy decision.

All Sprint 15 use is limited to fictional, synthetic records. The implementation does not authorize production deployment or processing of real patient data.

### Controlled Provisioning

Workforce authority is managed only through the local non-HTTP command:

```bash
npm run access:provision
```

The command accepts no sensitive command-line arguments. In an interactive terminal it reads one strict JSON command without echoing the payload. Supported authority actions are `PROVISION_ACTOR`, `ACTIVATE_ACTOR`, `DEACTIVATE_ACTOR`, `REVOKE_SESSIONS`, `BIND_PRACTITIONER`, `ASSIGN_ROLE`, and `DEACTIVATE_ROLE`. The idempotent recovery actions `REVOKE_FACILITY_SESSIONS`, `REVOKE_PRACTITIONER_SESSIONS`, and `REVOKE_ASSIGNMENT_SESSIONS` retry only the required session revocation after a committed lifecycle change; they do not replay the facility, practitioner, or assignment mutation. Every action runs in one PostgreSQL transaction, uses lifecycle updates rather than hard deletion, and emits only an opaque result event with an aggregate affected-row count.

The final authorization transaction locks the actor and exact target resources, revalidates the operation-specific grant and current resource state, and updates session activity only when that same target grant remains valid. Dedicated `workforce_actors.activated_at` and `workforce_role_assignments.activated_at` epochs advance atomically when a lifecycle transition expands or removes scope. An epoch newer than the OIDC authentication time remains unavailable to the existing identity until revocation and reauthentication complete. General facility, practitioner, and assignment `updated_at` audit timestamps are never used as authorization evidence, so ordinary profile and descriptive edits do not require reauthentication.

On Windows, use the interactive terminal path. On POSIX systems only, noninteractive input must come from a regular permission-restricted file on an encrypted local temporary volume; pipes are rejected. Never place provisioning payloads in source control, shell history, synchronized folders, tickets, or logs. This controlled command is not a role-administration API and does not define a production identity-management workflow.

Authentication failures return generic `401 AUTHENTICATION_REQUIRED` with `WWW-Authenticate: Bearer`. Insufficient grants return generic `403 FORBIDDEN`; absent and out-of-scope resources use the operation's privacy-preserving `404` envelope. These responses never disclose token, claim, role, scope, session, SQL, or patient details.

## Migrations

The API uses SQL-first migrations under:

- `apps/api/database/migrations/up`
- `apps/api/database/migrations/down`

Migration filenames are ordered and immutable, for example:

- `001_create_healthcare_facilities.sql`

The migration runner maintains a `schema_migrations` table with:

- `version`
- `name`
- `checksum`
- `applied_at`

The checksum is computed from the `up` migration content. If an applied file changes later, the runner fails instead of silently drifting.

Important:

- Do not edit an already-applied migration.
- Add a new migration for follow-up schema changes.
- `npm run db:migrate:down` rolls back only the most recently applied migration.
- Down migrations can be destructive, so use them carefully.
- The API does not apply migrations automatically at startup.

## Facilities API

The production-shaped facilities API lives under `/api/v1/facilities`.

Route summary:

- `POST /api/v1/facilities` - create a facility
- `GET /api/v1/facilities` - list facilities with pagination and filters
- `GET /api/v1/facilities/:id` - fetch one facility by UUID
- `PATCH /api/v1/facilities/:id` - update a facility
- `DELETE /api/v1/facilities/:id` - soft delete by setting `isActive` to `false`

Validation and normalization rules:

- Request bodies are strict JSON objects.
- Unknown properties are rejected.
- `code` is trimmed and stored in uppercase.
- `email` is trimmed and stored in lowercase.
- Blank optional strings become `null`.
- `DELETE` does not remove rows from PostgreSQL.
- Reactivation happens through `PATCH /api/v1/facilities/:id` with `isActive: true`.
- Workforce operations require the Sprint 15 OIDC and server-derived authorization boundary described above.

Create and update accept these fields:

- `code`
- `name`
- `facilityType`
- `licenseNumber`
- `phone`
- `email`
- `region`
- `city`
- `addressLine`
- `isActive`

List query parameters:

- `page` default `1`
- `pageSize` default `20`, maximum `100`
- `facilityType`
- `region`
- `city`
- `isActive`
- `search`

Stable error format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      {
        "field": "name",
        "message": "Name is required"
      }
    ]
  }
}
```

Example create request:

```bash
curl -X POST http://127.0.0.1:3001/api/v1/facilities \
  -H "Content-Type: application/json" \
  -d '{
    "code": "ADD-CLINIC-001",
    "name": "Addis Sunrise Clinic",
    "facilityType": "clinic",
    "licenseNumber": "LIC-ADD-001",
    "phone": "+251911111111",
    "email": "contact@addissunrise.example",
    "region": "Addis Ababa",
    "city": "Addis Ababa",
    "addressLine": "Bole Road",
    "isActive": true
  }'
```

PowerShell example for reading a facility:

```powershell
Invoke-RestMethod http://127.0.0.1:3001/api/v1/facilities/11111111-1111-4111-8111-111111111111
```

Example list request:

```bash
curl "http://127.0.0.1:3001/api/v1/facilities?page=1&pageSize=20&city=Addis%20Ababa&isActive=true"
```

Soft-delete behavior:

- `DELETE /api/v1/facilities/:id` returns HTTP 204 with no body.
- The row remains readable by ID after deletion.
- `isActive=false` filters can still find the deactivated facility.
- A second `DELETE` for the same row still returns HTTP 204.

OpenAPI validation:

```bash
npm run api:docs:validate
```

## Practitioners API

The practitioners API lives under `/api/v1/practitioners`.

Route summary:

- `POST /api/v1/practitioners` - create a practitioner
- `GET /api/v1/practitioners` - list practitioners with pagination and filters
- `GET /api/v1/practitioners/:id` - fetch one practitioner by UUID
- `PATCH /api/v1/practitioners/:id` - update a practitioner
- `DELETE /api/v1/practitioners/:id` - soft delete by setting `isActive` to `false`
- `POST /api/v1/practitioners/:practitionerId/facilities` - create a facility assignment
- `GET /api/v1/practitioners/:practitionerId/facilities` - list active and inactive assignments
- `PATCH /api/v1/practitioners/:practitionerId/facilities/:assignmentId` - update an assignment
- `DELETE /api/v1/practitioners/:practitionerId/facilities/:assignmentId` - soft delete an assignment

Practitioner fields:

- `code`
- `firstName`
- `middleName`
- `lastName`
- `profession`
- `licenseNumber`
- `phone`
- `email`
- `bio`
- `isActive`

Validation and normalization rules:

- `code` is trimmed and stored in uppercase.
- `email` is trimmed and stored in lowercase.
- Blank optional strings become `null`.
- `profession` is stored as a free-form string because no fixed profession enum exists yet.
- Unknown properties are rejected.
- `PATCH` bodies must not be empty.

List filters:

- `page` default `1`
- `pageSize` default `20`, maximum `100`
- `profession`
- `isActive`
- `facilityId`
- `search`

Search is case-insensitive across `code`, `firstName`, `middleName`, `lastName`, `profession`, and `licenseNumber`.

Assignment rules:

- `facilityId` is required when creating an assignment.
- `isPrimary=true` and `isActive=true` clear the previous active primary assignment atomically.
- `facilityId` cannot be changed on `PATCH`.
- `DELETE` deactivates the assignment and clears `isPrimary`.
- Inactive practitioners and facilities remain queryable, but they cannot receive new active assignments.
- Repeating `DELETE` on an assignment remains `204`.

Example practitioner create request:

```bash
curl -X POST http://127.0.0.1:3001/api/v1/practitioners \
  -H "Content-Type: application/json" \
  -d '{
    "code": "PRAC-001",
    "firstName": "Mekdes",
    "middleName": "A.",
    "lastName": "Tadesse",
    "profession": "general practitioner",
    "licenseNumber": "MED-001",
    "phone": "+251911111111",
    "email": "mekdes@example.org",
    "bio": "Integration test practitioner",
    "isActive": true
  }'
```

Example assignment create request:

```bash
curl -X POST http://127.0.0.1:3001/api/v1/practitioners/11111111-1111-4111-8111-111111111111/facilities \
  -H "Content-Type: application/json" \
  -d '{
    "facilityId": "33333333-3333-4333-8333-333333333333",
    "roleTitle": "Physician",
    "department": "Internal Medicine",
    "isPrimary": true,
    "isActive": true
  }'
```

Stable practitioner and assignment conflicts use the same error envelope as facilities.

## Patients API

The patients API lives under `/api/v1/patients`.

Route summary:

- `POST /api/v1/patients` - create a patient with an initial facility registration
- `GET /api/v1/patients` - list patients with pagination and filters
- `GET /api/v1/patients/:patientId` - fetch one patient by UUID
- `PATCH /api/v1/patients/:patientId` - update a patient
- `DELETE /api/v1/patients/:patientId` - soft deactivate a patient

Patient registration rules:

- The initial facility registration is created in the same transaction as the patient record.
- Medical record numbers are unique per facility, not globally.
- The same MRN may appear at different facilities.
- Patient names, phone, and email are not treated as unique identifiers.
- `DELETE` is soft and idempotent, and it preserves registration rows.
- `administrativeSex` is limited to `female`, `male`, `other`, or `unknown`.

List filters:

- `page` default `1`
- `pageSize` default `20`, maximum `100`
- `search`
- `facilityId`
- `medicalRecordNumber`
- `administrativeSex`
- `isActive`

## Appointments API

The appointments API lives under `/api/v1/appointments`.

Route summary:

- `POST /api/v1/appointments` - create an appointment
- `GET /api/v1/appointments` - list appointments with pagination and filters
- `GET /api/v1/appointments/:appointmentId` - fetch one appointment by UUID
- `PATCH /api/v1/appointments/:appointmentId` - update appointment time or status
- `POST /api/v1/appointments/:appointmentId/cancel` - cancel an appointment without deleting it

Appointment rules:

- Each appointment links one patient, practitioner, and facility.
- `scheduledStart` must be earlier than `scheduledEnd`.
- Creation rejects appointments that start in the past.
- Appointments require an active facility, an active practitioner assigned to that facility, and an active patient registered at that facility.
- Overlapping non-cancelled appointments for the same practitioner are rejected.
- Cancellation requires a nonblank reason and preserves the appointment record for history.
- Status values are `SCHEDULED`, `CONFIRMED`, `COMPLETED`, `CANCELLED`, and `NO_SHOW`.
- Appointment confirmations, reschedules, cancellations, completions, and no-shows maintain reminder rows in the same transaction as the appointment change.

Reminder worker:

- `npm run worker:reminders` starts the background reminder worker.
- The worker uses PostgreSQL only; there is no Redis, queue broker, or worker HTTP server yet.
- Reminder delivery is a development-safe no-op adapter until a real notification channel is introduced.

List filters:

- `page` default `1`
- `pageSize` default `20`, maximum `100`
- `facilityId`
- `practitionerId`
- `patientId`
- `status`
- `from`
- `to`

Validation and normalization rules:

- Request bodies are strict JSON objects.
- Unknown properties are rejected.
- ISO date-time values must include a timezone offset.
- Status values are normalized to uppercase.
- Optional blank strings are rejected where a nonblank value is required.

## Testing

- Unit tests: `npm test`
- PostgreSQL integration tests: `npm run test:integration:db`
- OpenAPI validation: `npm run api:docs:validate`

## Continuous Integration

GitHub Actions runs four stable validation jobs for pull requests, pushes to `main`, and manual workflow dispatches:

- `Static quality gates` installs the lockfile with Node.js 24, validates the product baseline, and runs lint, typecheck, unit tests, OpenAPI validation, workspace builds, and formatting checks.
- `Dependency security` installs the lockfile and audits production dependencies and the complete development-tool dependency graph at the high-severity threshold.
- `PostgreSQL integration` starts an isolated PostgreSQL 18 service, reports migration status, applies migrations twice to exercise idempotency, verifies that no migrations remain pending, verifies the schema, and runs database integration tests.
- `Docker validation` validates `compose.yaml` and builds the production image without publishing it.

CI validation is not deployment. The workflows do not authenticate to a container registry, publish images, inject production secrets, or deploy an environment.

Before opening a pull request, install exactly from the lockfile and run the same checks locally:

```bash
npm ci
npm audit --omit=dev --audit-level=high
npm audit --audit-level=high
node scripts/validate-product-baseline.mjs
npm run lint
npm run typecheck
npm test
npm run api:docs:validate
npm run build
npm run format:check
npm run db:up
npm run db:status
npm run db:migrate:status
npm run db:migrate
npm run db:migrate
npm run db:migrate:status
npm run db:schema:verify
npm run test:integration:db
docker compose config
docker build -t hakimi-healthcare-platform:ci .
```

The PostgreSQL checks require Docker with Compose v2 and a healthy local PostgreSQL 18 container started through `npm run db:up`. The second `npm run db:migrate` should complete without applying a migration, and final status should show `Pending migrations: - (none)`.

Common failure categories include lockfile installation failures, lint or type errors, unit-test regressions, OpenAPI or product-baseline drift, formatting differences, pending or checksum-invalid migrations, schema drift, PostgreSQL integration failures, invalid Compose configuration, and Docker build failures. Fix the underlying failure; do not skip or weaken the corresponding check.

### Dependency Security

`npm audit --omit=dev --audit-level=high` checks packages included in production installs. `npm audit --audit-level=high` also checks development tools such as linters, test runners, build tools, and the Redocly CLI. Moderate findings do not fail these high-severity gates, but they still require review and recorded remediation status.

Redocly validates `apps/api/openapi.yaml` through `npm run api:docs:validate`. A Redocly upgrade must preserve a successful command and must not change the OpenAPI contract merely to silence a new tooling warning. Review and triage warnings separately.

Dependabot checks the root npm workspace and GitHub Actions every Monday. Compatible patch and minor development-dependency updates are grouped; GitHub Actions updates remain individually reviewable. Dependabot never merges automatically: every update must pass all CI jobs and receive human review before merge.

External GitHub Actions are pinned to reviewed, immutable 40-character commit SHAs. The nearby version comment records the release associated with each pin. Verify a replacement SHA against the action's official repository before updating it.

Vulnerability triage:

1. Confirm the advisory, affected version, dependency path, production reachability, and fix availability.
2. Treat high or critical findings as merge blockers and escalate them to the repository maintainer immediately.
3. Record moderate findings for timely remediation even though the high-severity audit gate does not fail.
4. Apply the smallest compatible update, inspect manifest and lockfile movement, and run the complete verification suite.
5. Never use `npm audit fix --force` or weaken an audit command to obtain a green check.

After these workflows merge, configure branch protection in GitHub repository settings to require:

- `Static quality gates`
- `Dependency security`
- `PostgreSQL integration`
- `Docker validation`

Adding workflow files does not configure branch protection automatically.

## Verification

Run the project checks from the repository root:

```bash
npm run db:up
npm run db:status
npm run db:migrate:status
npm run db:migrate
npm run db:schema:verify
npm run api:docs:validate
npm run lint
npm run typecheck
npm test
npm run test:integration:db
npm run build
npm run format:check
```

## Health Endpoints

- Liveness: `GET /health/live`
  - Returns HTTP 200 with `{ "status": "ok" }`
  - Does not depend on PostgreSQL
- Readiness: `GET /health/ready`
  - Returns HTTP 200 with `{ "status": "ready", "database": "up" }` when PostgreSQL is reachable
  - Returns HTTP 503 with `{ "status": "not_ready", "database": "down" }` when PostgreSQL is unavailable

Example checks:

```bash
curl http://127.0.0.1:3001/health/live
curl http://127.0.0.1:3001/health/ready
```

## Database Commands

Use the root npm scripts for the local PostgreSQL container:

```bash
npm run db:up
npm run db:down
npm run db:status
npm run db:logs
npm run db:migrate
npm run db:migrate:down
npm run db:migrate:status
npm run db:schema:verify
```

`npm run db:down` stops and removes the container and network, but it preserves the named volume that stores local data.

Warning: `docker compose down --volumes` deletes the local PostgreSQL data volume.

## Schema Verification

`npm run db:schema:verify` connects to the running development database and verifies:

- the `healthcare_facilities` table exists
- the expected columns, nullability, and defaults exist
- the primary key and unique constraints are present
- the `facility_type` check constraint matches the allowed values
- the `practitioners` table exists with stable unique constraints, checks, and defaults
- the `practitioner_facility_assignments` table exists with foreign keys, the duplicate-assignment unique constraint, and the partial unique index that enforces one active primary assignment per practitioner
- the `appointments` table includes `schedule_version` and the reminder-related check constraint
- the `appointment_reminders` table exists with bounded string columns, state checks, unique keys, and processing indexes
- the workforce actor, role-assignment, and session tables include their bounded columns, lifecycle checks, restrictive foreign keys, unique authority indexes, and active-session indexes

## Notes

- Do not commit secrets.
- Keep the repository strict, typed, and workspace-aware.
- DevOps infrastructure is intentionally empty for now.
- Workforce access control is synthetic-data-only; patient authentication and production authorization remain excluded.
