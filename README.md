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
- `compose.yaml` - local PostgreSQL container for local development
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
- Authentication and authorization are not implemented yet.

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

## Notes

- Do not commit secrets.
- Keep the repository strict, typed, and workspace-aware.
- DevOps infrastructure is intentionally empty for now.
- Authentication and authorization are not implemented yet.
