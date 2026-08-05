# Repository Conventions

## Goals

- Keep the monorepo simple and strict.
- Prefer small, composable packages and clear boundaries.
- Avoid adding infrastructure or product features before the foundation is stable.

## Conventions

- Use npm workspaces only.
- Keep TypeScript in `strict` mode.
- Use `import type` for type-only imports.
- Keep environment files limited to placeholders in `.env.example`.
- Use SQL-first migrations only; do not add Prisma, ORM migrations, or seed data.
- Never edit an already-applied migration; add a new migration instead.
- Keep API routes thin: validation in schemas, normalization in services, SQL in repositories, and stable JSON errors in centralized middleware.
- Use parameterized PostgreSQL queries only and map database rows to API contracts in one place.
- Keep request bodies strict, reject unknown properties, and never leak SQL, stack traces, or secrets in API responses.
- Treat practitioner primary reassignment as a single transaction that clears the previous active primary before promoting the new one.
- Keep practitioner professions free-form until a formal classification list exists.
- Verify partial unique indexes and foreign keys in `db:schema:verify` for assignment tables.
- Keep DELETE semantics soft and idempotent for facilities, practitioners, and assignments.
- Keep generated output out of version control.

## Common Commands

```bash
npm install
npm run dev
npm run db:up
npm run db:down
npm run db:status
npm run db:logs
npm run db:migrate
npm run db:migrate:down
npm run db:migrate:status
npm run db:schema:verify
npm run test:integration:db
npm run api:docs:validate
npm run lint
npm run typecheck
npm test
npm run build
npm run format
npm run format:check
```

## Verification Expectations

- `docker compose config` must succeed.
- `docker compose up -d` must start the local PostgreSQL service.
- `docker compose ps` must show PostgreSQL healthy.
- `npm run db:migrate:status` must report applied and pending migrations.
- `npm run db:migrate` must succeed and be idempotent when re-run.
- `npm run db:schema:verify` must succeed when the expected schema is present.
- `npm run lint` must pass cleanly.
- `npm run typecheck` must pass cleanly.
- `npm test` must pass.
- `npm run test:integration:db` must pass against the local PostgreSQL instance when run explicitly.
- `npm run api:docs:validate` must pass.
- `npm run build` must succeed for all workspaces.
- `npm run format:check` must pass.

## Change Discipline

- Keep changes workspace-scoped when possible.
- Add tests for API behavior changes.
- Update docs when setup or commands change.
