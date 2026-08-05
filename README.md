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

## Verification

Run the project checks from the repository root:

```bash
npm run db:up
npm run db:status
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
```

`npm run db:down` stops and removes the container and network, but it preserves the named volume that stores local data.

Warning: `docker compose down --volumes` deletes the local PostgreSQL data volume.

## Notes

- Do not commit secrets.
- Keep the repository strict, typed, and workspace-aware.
- DevOps infrastructure is intentionally empty for now.
