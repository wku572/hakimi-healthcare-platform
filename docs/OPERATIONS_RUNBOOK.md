# Runtime Observability Runbook

This runbook describes the vendor-neutral runtime diagnostics emitted by the Hakimi API and reminder worker. Logs are newline-delimited JSON written to stdout or stderr so container runtimes can collect them without a hosted monitoring dependency.

## Log Schema

Every event contains these required fields:

| Field       | Type   | Meaning                                              |
| ----------- | ------ | ---------------------------------------------------- |
| `timestamp` | string | UTC ISO 8601 event time                              |
| `severity`  | string | `INFO`, `WARN`, or `ERROR`                           |
| `service`   | string | `hakimi-api` or `hakimi-reminder-worker`             |
| `eventCode` | string | Stable event code from the catalogue in this runbook |

Event-specific fields are selected from this closed allowlist:

- API request fields: `requestId`, `method`, `route`, `statusCode`, `durationMs`, and `errorCode`
- API lifecycle fields: `port`, `signal`, and `failureStage`
- Worker aggregate fields: `claimedCount`, `deliveredCount`, `cancelledCount`, `supersededCount`, `retriedCount`, `deadLetteredCount`, and `skippedCount`

Unknown fields and unsafe values are discarded by the logger boundary.

## Event Catalogue

| Event code                        | Normal severity | Service                  | Purpose                                                     |
| --------------------------------- | --------------- | ------------------------ | ----------------------------------------------------------- |
| `HTTP_REQUEST_COMPLETED`          | INFO/WARN/ERROR | `hakimi-api`             | Request completed; severity follows the HTTP status class   |
| `HTTP_REQUEST_ABORTED`            | WARN            | `hakimi-api`             | Client connection closed before the response completed      |
| `HTTP_API_ERROR`                  | WARN            | `hakimi-api`             | Known API or malformed-JSON error returned safely           |
| `HTTP_UNEXPECTED_ERROR`           | ERROR           | `hakimi-api`             | Unexpected failure converted to the generic 500 envelope    |
| `READINESS_CHECK_FAILED`          | WARN            | `hakimi-api`             | Readiness check returned the existing not-ready response    |
| `POSTGRES_CONNECTIVITY_SUCCEEDED` | INFO            | `hakimi-api`             | Readiness query reached PostgreSQL successfully             |
| `POSTGRES_CONNECTIVITY_FAILED`    | ERROR           | `hakimi-api`             | Readiness query could not reach PostgreSQL                  |
| `API_STARTUP_FAILED`              | ERROR           | `hakimi-api`             | API bootstrap or listener failed without exposing the error |
| `API_STARTED`                     | INFO            | `hakimi-api`             | HTTP listener started                                       |
| `API_SHUTDOWN_STARTED`            | INFO            | `hakimi-api`             | Graceful shutdown began after `SIGINT` or `SIGTERM`         |
| `API_SHUTDOWN_COMPLETED`          | INFO            | `hakimi-api`             | HTTP server and PostgreSQL pool closed successfully         |
| `API_SHUTDOWN_FAILED`             | ERROR           | `hakimi-api`             | A safe `failureStage` identifies the lifecycle boundary     |
| `DATABASE_POOL_ERROR`             | ERROR           | API or worker            | PostgreSQL pool emitted an unexpected background error      |
| `REMINDER_WORKER_STARTED`         | INFO            | `hakimi-reminder-worker` | Worker polling loop started                                 |
| `REMINDER_WORKER_FAILED`          | ERROR           | `hakimi-reminder-worker` | Worker bootstrap or terminal lifecycle failure              |
| `REMINDER_CYCLE_COMPLETED`        | INFO            | `hakimi-reminder-worker` | One polling cycle completed with aggregate outcome counts   |
| `REMINDER_CYCLE_FAILED`           | ERROR           | `hakimi-reminder-worker` | Polling cycle failed without exposing the underlying error  |
| `REMINDER_WORKER_STOPPING`        | INFO            | `hakimi-reminder-worker` | Worker received an abort signal                             |
| `REMINDER_WORKER_STOPPED`         | INFO            | `hakimi-reminder-worker` | Worker polling loop stopped                                 |

## Request Correlation

- The API accepts an incoming `X-Request-ID` only when it is an exact lowercase RFC 4122 UUID v4.
- Missing, malformed, uppercase, multi-value, or oversized values are replaced using Node.js `randomUUID()`.
- The effective ID is returned in `X-Request-ID` for successful responses, errors, malformed JSON, and unmatched routes.
- Request IDs are diagnostic correlation values only. They are not user, patient, appointment, or audit identifiers.

## Privacy Boundary

Runtime logs must never include:

- request or response bodies;
- query values, headers, cookies, or authorization material;
- concrete patient, practitioner, facility, appointment, registration, reminder, or assignment identifiers;
- names, email addresses, phone numbers, addresses, medical record numbers, or reminder content;
- SQL text, database URLs, constraint details, raw error messages, or stack traces;
- secrets or complete environment configuration.

Routes are logged from a closed catalogue using templates such as `/api/v1/patients/:patientId`. Unknown paths are recorded as `UNMATCHED`; their original path is not logged. The worker emits one aggregate summary per completed cycle and no per-reminder diagnostic event.

These diagnostics are operational telemetry, not clinical audit records. Audit requirements remain an open stakeholder decision.

## Configuration

`LOG_LEVEL` is validated independently by the API and worker. Supported values are:

- `info` - emit INFO, WARN, and ERROR events;
- `warn` - emit WARN and ERROR events;
- `error` - emit ERROR events only.

The default is `info`. Invalid values stop the process during strict environment validation. Do not place credentials or patient information in environment labels or runtime identifiers.

## Local Inspection

Start the stack and follow application logs:

```bash
docker compose up --build -d
docker compose logs -f api worker
```

Check health without changing the established response contracts:

```bash
curl -i http://127.0.0.1:3001/health/live
curl -i http://127.0.0.1:3001/health/ready
```

The response headers include the effective `X-Request-ID`. Use that value to find the corresponding `HTTP_REQUEST_COMPLETED` event in collected API logs.

## Diagnostic Procedures

### API returns HTTP 500

1. Capture the response `X-Request-ID` without recording the request body.
2. Find `HTTP_UNEXPECTED_ERROR` and `HTTP_REQUEST_COMPLETED` for that request ID.
3. Check for nearby `DATABASE_POOL_ERROR` events and PostgreSQL container health.
4. Reproduce with non-sensitive test data. Raw production values must not be copied into tickets or logs.

### Readiness returns HTTP 503

1. Confirm `POSTGRES_CONNECTIVITY_FAILED`, `READINESS_CHECK_FAILED`, and the corresponding request completion event.
2. Run `docker compose ps` and confirm PostgreSQL is healthy.
3. Inspect migration status with `npm run db:migrate:status`.
4. Inspect PostgreSQL service logs separately; do not add database error details to API logs.

A successful readiness query emits `POSTGRES_CONNECTIVITY_SUCCEEDED`. Neither connectivity event contains SQL, database details, or the caught error, and the readiness HTTP responses remain unchanged.

### API listener fails during startup

1. Confirm that exactly one `API_STARTUP_FAILED` event was emitted.
2. Check whether the configured port is already occupied without adding the caught error to application logs.
3. The listener failure handler closes the PostgreSQL pool and exits with code `1`.
4. Pool cleanup failure does not prevent exit and does not emit raw cleanup details.

### Reminder worker reports cycle failures

1. Find `REMINDER_CYCLE_FAILED` events and check whether subsequent cycles recover.
2. Confirm PostgreSQL health and migration status.
3. Review aggregate `REMINDER_CYCLE_COMPLETED` trends for retries, dead letters, or skips.
4. Query reminder rows only through approved administrative procedures; never add row content to runtime logs.

### Shutdown fails

1. Inspect `API_SHUTDOWN_FAILED.failureStage`.
2. For `http_server`, check for long-running or stuck connections.
3. For `database_pool`, check PostgreSQL connectivity and pool lifecycle.
4. Preserve the opaque event; do not modify logging to include the caught error.

## Verification

Run the observability tests and repository gates from the repository root:

```bash
npm test --workspace @hakimi/api -- --run test/observability.test.ts test/database.test.ts test/api-lifecycle.test.ts test/error-middleware.test.ts test/reminders.worker.test.ts
npm run lint
npm run typecheck
npm test
npm run test:integration:db
npm run api:docs:validate
npm run build
npm run format:check
node scripts/validate-product-baseline.mjs
docker compose config
docker build -t hakimi-healthcare-platform:ci .
```

No public metrics endpoint, tracing backend, hosted monitoring provider, authentication mechanism, or production alert destination is configured by this observability baseline.
