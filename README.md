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
- `compose.yaml` - local PostgreSQL dependency for Sprint 2
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

## Verification

Run the project checks from the repository root:

```bash
npm run db:up
npm run db:status
npm run db:migrate:status
npm run db:migrate
npm run db:schema:verify
npm run lint
npm run typecheck
npm test
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

## Notes

- Do not commit secrets.
- Keep the repository strict, typed, and workspace-aware.
- DevOps infrastructure is intentionally empty for now.
