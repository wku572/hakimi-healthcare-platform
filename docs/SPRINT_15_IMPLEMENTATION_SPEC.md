# Sprint 15 Workforce Identity And Access-Control Implementation Specification

## Document Status

| Field                    | Value                                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------------- |
| Specification status     | PROPOSED FOR REVIEW                                                                               |
| Runtime implementation   | NOT STARTED                                                                                       |
| Governing approval       | [OPEN-03, OPEN-04, and OPEN-05 recorded approval](./ACCESS_CONTROL_BASELINE.md#recorded-approval) |
| Canonical status         | `PLANNED`                                                                                         |
| Data boundary            | Synthetic data only                                                                               |
| Production authorization | NOT AUTHORIZED                                                                                    |

This document defines an implementation-ready boundary for Sprint 15. It does not implement authentication, authorization, database objects, migrations, dependencies, OpenAPI changes, or deployment configuration. Runtime work may begin only after this specification is reviewed, explicitly approved, merged into `main`, and the repository is clean.

## Objective

Implement a vendor-neutral workforce resource-server boundary that:

- maps validated OIDC subjects to pre-provisioned workforce actors;
- loads current workforce roles, facility scopes, activation state, and revocation state from PostgreSQL;
- defaults every protected operation to deny;
- preserves only the 25 workforce operations approved in the [authorization matrix](./TRACEABILITY.md#sprint-15-workforce-authorization-matrix);
- keeps `DELETE /api/v1/patients/:patientId` policy-blocked;
- preserves public liveness and readiness behavior;
- uses synthetic data for development and testing; and
- does not authorize production deployment or processing of real patient data.

## Governing Boundaries

### Approved For Sprint 15

- Five active workforce roles: `PLATFORM_ADMIN`, `FACILITY_ADMIN`, `SCHEDULER`, `PRACTITIONER`, and `OPERATIONS_OPERATOR`.
- OIDC Authorization Code with PKCE for workforce clients.
- Workforce MFA, short-lived access tokens, explicit revocation, refresh-token replay protection at the identity provider, and unique workload identities.
- Default-deny authorization using immutable server-derived context.
- Facility isolation, relationship-scoped practitioner access, and privacy-preserving `401`, `403`, and absent-or-out-of-scope `404` behavior.
- Controlled out-of-band initial actor and role provisioning.
- Bounded implementation and testing with synthetic data.

### Excluded Or Blocked

- Identity-role assignment administration API, user interface, or public workflow.
- `PATIENT` role activation.
- Patient authentication.
- Patient MFA.
- Patient recovery.
- Patient sessions.
- Patient self-service.
- Patient-derived authorization context.
- Cross-facility patient writes.
- Global patient deactivation.
- Break-glass access.
- Clinical audit policy or clinical-audit persistence.
- Identity-provider vendor selection or hosted identity-provider deployment.
- Production deployment or processing of real patient data.
- Changes to appointment, reminder, privacy, consent, legal, retention, patient-identity, or deployment policy.

## Architecture Boundary

### Request Path

The future API request path must be:

1. Request observability establishes and returns `X-Request-ID` without logging credentials or identifiers.
2. `/health/live` and `/health/ready` bypass authentication and preserve their current response contracts.
3. Every `/api/v1` request passes through the OIDC bearer-token resource-server boundary.
4. The API validates the token cryptographically and validates all required claims.
5. The API maps the exact issuer and subject to an active pre-provisioned workforce actor.
6. The API reads local session and revocation state without creating a session or updating `last_seen_at`.
7. The API loads active roles and facility scopes from PostgreSQL and constructs an immutable authorization context.
8. Coarse operation policy denies roles that have no grant before protected input or domain work proceeds.
9. Existing strict body parsing and schema validation run for authenticated, coarse-authorized callers.
10. Closed field policy denies every known request property not granted to the actor's role.
11. Service and repository authorization enforce facility, practitioner, patient, appointment, and relationship scope in parameterized SQL.
12. Only after the complete authorization decision succeeds, the API atomically creates or updates local session activity immediately before authorized domain execution.
13. Central error middleware returns stable privacy-safe envelopes.

Authentication must run before protected body parsing so an unauthenticated protected request receives the generic `401` boundary rather than request-validation detail. Authorization must not weaken strict body validation for authenticated callers.

### Immutable Authorization Context

The request-scoped context must contain only server-derived values:

| Field                | Source                                                            | Rule                                                                        |
| -------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `actorId`            | `workforce_actors.id` after exact issuer/subject lookup           | Never accepted from headers, route parameters, query parameters, or bodies. |
| `practitionerId`     | Nullable `workforce_actors.practitioner_id`                       | Required for the `PRACTITIONER` role; never inferred from a request.        |
| `sessionId`          | Internal `workforce_sessions.id`                                  | Never expose or log it; the raw OIDC session identifier is not persisted.   |
| `roles`              | Active `workforce_role_assignments` rows                          | Re-query on every request; no role cache in Sprint 15.                      |
| `facilityScopes`     | Active role rows plus active practitioner-facility assignments    | Request facility identifiers may narrow but never expand this set.          |
| `authorizationState` | Actor, role, facility, practitioner-assignment, and session state | Must be current at the request authorization boundary.                      |

Access-token claims may identify the OIDC issuer, subject, and session. They must not create or modify actors, workforce roles, facility scopes, activation state, practitioner links, or revocation state.

### Module Boundary

The runtime implementation should add an `apps/api/src/access/` module with separate responsibilities:

| File or responsibility | Required boundary                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------ |
| `types.ts`             | Internal actor, role, session, and immutable authorization-context types.                  |
| `oidc-verifier.ts`     | Bearer extraction, JOSE verification, claim validation, JWKS caching, and opaque failures. |
| `repository.ts`        | Parameterized access-state and session SQL only.                                           |
| `service.ts`           | Actor/session resolution and construction of immutable authorization context.              |
| `policy.ts`            | Closed operation and field policy matching the 26-row matrix.                              |
| `middleware.ts`        | Authentication and coarse authorization middleware.                                        |
| `provision.ts`         | Controlled stdin-driven provisioning command; not an HTTP route.                           |
| `module.ts`            | Dependency composition without global mutable authorization state.                         |

Domain routes remain thin. Facility, practitioner, patient, and appointment repositories must enforce resource scope in SQL rather than loading an unrestricted row and filtering it in memory.

### Service Actor Boundary

The four approved service actors remain separate from human workforce persistence:

| Service actor        | Sprint 15 HTTP boundary                                          | Identity boundary                                                                             |
| -------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `HEALTH_PROBE`       | Calls only the two public health operations; no protected grant. | No workforce actor or role row.                                                               |
| `REMINDER_WORKER`    | No HTTP-domain operation grant.                                  | Uses a unique non-human runtime/database identity; never a human OIDC session.                |
| `MIGRATION_OPERATOR` | No HTTP-domain operation grant.                                  | Uses a unique migration identity supplied by the controlled environment.                      |
| `API_RUNTIME`        | Serves requests but does not inherit caller authorization.       | Uses a unique runtime/database identity and always evaluates the authenticated human context. |

`workforce_actors`, `workforce_role_assignments`, and `workforce_sessions` store human workforce authorization state only. Sprint 15 must not insert service actors into those tables, grant service actors human roles, or reuse a human credential for a workload. Migration 006 must not create PostgreSQL login roles or credentials. Local and production credential provisioning belongs to the deployment boundary governed by `OPEN-12`; production remains blocked, but the future deployment design must preserve one unique identity per workload.

## Proposed Migration 006

### Migration Files

The runtime branch must create, but this documentation branch must not create:

- `apps/api/database/migrations/up/006_create_workforce_access_control.sql`
- `apps/api/database/migrations/down/006_create_workforce_access_control.sql`

Migration 006 must only add the three tables, constraints, and indexes defined below. It must not change migrations 001 through 005, alter existing domain data, create database users, create identity-provider configuration, or insert seed records.

### Table: `workforce_actors`

This table is the authoritative mapping from a verified workforce OIDC subject to local access state. It deliberately stores no name, email, phone number, password, token, credential, or patient link.

| Column            | PostgreSQL type | Nullability | Default    | Rule                                                         |
| ----------------- | --------------- | ----------- | ---------- | ------------------------------------------------------------ |
| `id`              | `uuid`          | NOT NULL    | `uuidv7()` | Primary key.                                                 |
| `oidc_issuer`     | `varchar(500)`  | NOT NULL    | none       | Exact configured issuer; nonblank.                           |
| `oidc_subject`    | `varchar(255)`  | NOT NULL    | none       | Exact case-sensitive OIDC `sub`; nonblank and never logged.  |
| `practitioner_id` | `uuid`          | NULL        | none       | Optional one-to-one practitioner link; `ON DELETE RESTRICT`. |
| `is_active`       | `boolean`       | NOT NULL    | `true`     | Inactive actors are denied before role evaluation.           |
| `activated_at`    | `timestamptz`   | NOT NULL    | `now()`    | Most recent controlled activation time.                      |
| `deactivated_at`  | `timestamptz`   | NULL        | none       | Required when inactive and null when active.                 |
| `created_at`      | `timestamptz`   | NOT NULL    | `now()`    | State timestamp, not a clinical audit event.                 |
| `updated_at`      | `timestamptz`   | NOT NULL    | `now()`    | Updated by controlled state changes.                         |

Required constraints and indexes:

| Name                                       | Type           | Definition                                                                 |
| ------------------------------------------ | -------------- | -------------------------------------------------------------------------- |
| `workforce_actors_pkey`                    | Primary key    | `(id)`                                                                     |
| `workforce_actors_issuer_subject_key`      | Unique         | `(oidc_issuer, oidc_subject)`                                              |
| `workforce_actors_practitioner_id_fkey`    | Foreign key    | `practitioner_id -> practitioners(id) ON DELETE RESTRICT`                  |
| `workforce_actors_practitioner_unique_idx` | Partial unique | `(practitioner_id) WHERE practitioner_id IS NOT NULL`                      |
| `workforce_actors_issuer_not_blank_check`  | Check          | `btrim(oidc_issuer) <> ''`                                                 |
| `workforce_actors_subject_not_blank_check` | Check          | `btrim(oidc_subject) <> ''`                                                |
| `workforce_actors_state_check`             | Check          | active implies no deactivation time; inactive requires a deactivation time |
| `workforce_actors_active_idx`              | Partial index  | `(id) WHERE is_active = true`                                              |

Issuer and subject uniqueness is case-sensitive. The service parses the configured issuer only to validate URL shape, then stores and compares the configured issuer and validated `iss` claim exactly. It must not lowercase, trim, add or remove a trailing slash, remove path segments, resolve aliases, or otherwise canonicalize the issuer or subject.

### Table: `workforce_role_assignments`

This table is the authoritative current workforce-role and administrative facility-scope source. It is independent from `practitioner_facility_assignments`.

| Column           | PostgreSQL type | Nullability | Default    | Rule                                                                          |
| ---------------- | --------------- | ----------- | ---------- | ----------------------------------------------------------------------------- |
| `id`             | `uuid`          | NOT NULL    | `uuidv7()` | Primary key.                                                                  |
| `actor_id`       | `uuid`          | NOT NULL    | none       | References `workforce_actors(id) ON DELETE RESTRICT`.                         |
| `role`           | `varchar(30)`   | NOT NULL    | none       | One of the five approved workforce roles; uppercase and trimmed.              |
| `facility_id`    | `uuid`          | NULL        | none       | Required only for facility-scoped administrative roles; `ON DELETE RESTRICT`. |
| `is_active`      | `boolean`       | NOT NULL    | `true`     | Inactive rows grant nothing.                                                  |
| `activated_at`   | `timestamptz`   | NOT NULL    | `now()`    | Most recent controlled activation time.                                       |
| `deactivated_at` | `timestamptz`   | NULL        | none       | Required when inactive and null when active.                                  |
| `created_at`     | `timestamptz`   | NOT NULL    | `now()`    | State timestamp, not a clinical audit event.                                  |
| `updated_at`     | `timestamptz`   | NOT NULL    | `now()`    | Updated by controlled provisioning.                                           |

Role and scope rules:

| Role                  | Stored `facility_id` rule              | Additional live scope rule                                                              |
| --------------------- | -------------------------------------- | --------------------------------------------------------------------------------------- |
| `PLATFORM_ADMIN`      | Must be null.                          | No routine patient or appointment access.                                               |
| `FACILITY_ADMIN`      | Must reference one facility.           | Facility must currently be active.                                                      |
| `SCHEDULER`           | Must reference one facility.           | Facility must currently be active.                                                      |
| `PRACTITIONER`        | Must be null.                          | Actor needs a practitioner link; scope comes only from active practitioner assignments. |
| `OPERATIONS_OPERATOR` | Must be null.                          | No protected domain-operation grant.                                                    |
| `PATIENT`             | Prohibited by the database role check. | No patient role may be provisioned.                                                     |

Creating or activating a practitioner-facility roster row must never create or activate a workforce role. A practitioner receives domain access only when all of these are independently true: actor active, `PRACTITIONER` role active, linked practitioner active, target facility active, practitioner assignment active, and the operation-specific relationship exists.

Required constraints and indexes:

| Name                                          | Type           | Definition                                                                            |
| --------------------------------------------- | -------------- | ------------------------------------------------------------------------------------- |
| `workforce_role_assignments_pkey`             | Primary key    | `(id)`                                                                                |
| `workforce_role_assignments_actor_id_fkey`    | Foreign key    | `actor_id -> workforce_actors(id) ON DELETE RESTRICT`                                 |
| `workforce_role_assignments_facility_id_fkey` | Foreign key    | `facility_id -> healthcare_facilities(id) ON DELETE RESTRICT`                         |
| `workforce_role_assignments_role_check`       | Check          | Uppercase trimmed role in the five-role allowlist                                     |
| `workforce_role_assignments_scope_check`      | Check          | Facility required for `FACILITY_ADMIN` and `SCHEDULER`; null for other approved roles |
| `workforce_role_assignments_state_check`      | Check          | active implies no deactivation time; inactive requires a deactivation time            |
| `workforce_roles_actor_global_unique_idx`     | Partial unique | `(actor_id, role) WHERE facility_id IS NULL`                                          |
| `workforce_roles_actor_facility_unique_idx`   | Partial unique | `(actor_id, role, facility_id) WHERE facility_id IS NOT NULL`                         |
| `workforce_roles_active_actor_idx`            | Partial index  | `(actor_id, role, facility_id) WHERE is_active = true`                                |
| `workforce_roles_active_facility_idx`         | Partial index  | `(facility_id, role, actor_id) WHERE is_active = true AND facility_id IS NOT NULL`    |

The uniqueness indexes cover active and inactive rows so reactivation updates the existing row instead of creating duplicate lifecycle rows. This is current-state persistence, not a replacement for the unresolved audit policy in `OPEN-06`.

### Table: `workforce_sessions`

This table supplies the local session and revocation boundary. The API must never persist access tokens, refresh tokens, JWTs, raw OIDC session identifiers, authorization headers, cookies, or token claims.

| Column                | PostgreSQL type | Nullability | Default    | Rule                                                                                 |
| --------------------- | --------------- | ----------- | ---------- | ------------------------------------------------------------------------------------ |
| `id`                  | `uuid`          | NOT NULL    | `uuidv7()` | Internal primary key.                                                                |
| `actor_id`            | `uuid`          | NOT NULL    | none       | References `workforce_actors(id) ON DELETE RESTRICT`.                                |
| `oidc_session_hash`   | `char(64)`      | NOT NULL    | none       | Lowercase SHA-256 hex digest of the validated OIDC `sid`; raw `sid` is never stored. |
| `started_at`          | `timestamptz`   | NOT NULL    | none       | Derived from validated `auth_time`.                                                  |
| `last_seen_at`        | `timestamptz`   | NOT NULL    | none       | Updated only after the complete authorization decision succeeds.                     |
| `absolute_expires_at` | `timestamptz`   | NOT NULL    | none       | Exactly eight hours after `started_at`; never extended.                              |
| `revoked_at`          | `timestamptz`   | NULL        | none       | Any value makes the session unusable.                                                |
| `revocation_reason`   | `varchar(40)`   | NULL        | none       | Privacy-safe closed category; required only when revoked.                            |
| `created_at`          | `timestamptz`   | NOT NULL    | `now()`    | State timestamp.                                                                     |
| `updated_at`          | `timestamptz`   | NOT NULL    | `now()`    | State timestamp.                                                                     |

Allowed revocation reasons are `ACTOR_DEACTIVATED`, `ROLE_CHANGED`, `FACILITY_SCOPE_CHANGED`, `PRACTITIONER_STATE_CHANGED`, `PRACTITIONER_ASSIGNMENT_CHANGED`, `PRACTITIONER_BINDING_CHANGED`, and `MANUAL_REVOCATION`. These categories must not include a subject, token, session identifier, patient identifier, or free-form reason.

Required constraints and indexes:

| Name                                        | Type          | Definition                                                                                                  |
| ------------------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------- |
| `workforce_sessions_pkey`                   | Primary key   | `(id)`                                                                                                      |
| `workforce_sessions_actor_id_fkey`          | Foreign key   | `actor_id -> workforce_actors(id) ON DELETE RESTRICT`                                                       |
| `workforce_sessions_actor_hash_key`         | Unique        | `(actor_id, oidc_session_hash)`                                                                             |
| `workforce_sessions_hash_format_check`      | Check         | Lowercase hexadecimal string of exactly 64 characters                                                       |
| `workforce_sessions_time_order_check`       | Check         | `last_seen_at >= started_at`, `absolute_expires_at > started_at`, and `last_seen_at <= absolute_expires_at` |
| `workforce_sessions_reason_check`           | Check         | Null or one of the seven closed revocation-reason categories                                                |
| `workforce_sessions_revocation_state_check` | Check         | `revoked_at` and `revocation_reason` are either both null or both non-null                                  |
| `workforce_sessions_active_actor_idx`       | Partial index | `(actor_id, id) WHERE revoked_at IS NULL`                                                                   |
| `workforce_sessions_expiry_idx`             | Index         | `(absolute_expires_at, id)`                                                                                 |

An authenticated request is locally eligible only when the actor is active, an existing session is not revoked, the authorization timestamp is before `absolute_expires_at`, and an existing session's `last_seen_at` is no more than 30 minutes before that timestamp. Eligibility alone does not update activity. A first valid token for a pre-provisioned actor remains a session candidate until the complete authorization decision succeeds. It must never create an actor or role.

### Session Activity Semantics

Each request captures one database-derived authorization timestamp. Immediately before authorized domain execution, one atomic statement must insert a first-seen session or update an existing session with `last_seen_at = GREATEST(last_seen_at, authorization_timestamp)`. The statement must include fail-closed predicates proving that the actor remains active, the session is not revoked, the prior inactivity window has not expired, and absolute expiry is later than the authorization timestamp. If no row is returned, the API returns generic `401` and does not execute the domain operation.

| Request outcome                                                                                 | Create or update `last_seen_at`? | Required behavior                                                                                                                   |
| ----------------------------------------------------------------------------------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Complete authorization succeeds                                                                 | Yes                              | Update once immediately before domain execution; do not update again after the response.                                            |
| Authorized domain execution later returns validation `400`, conflict `409`, or unexpected `500` | Yes                              | The actor was authorized to attempt the operation; the pre-execution activity update remains.                                       |
| Malformed JSON or strict request-schema validation fails                                        | No                               | Validation occurs before complete field and resource authorization; do not create or extend the session.                            |
| Authentication or local session validation fails                                                | No                               | Return generic `401`; never recreate an expired or revoked session.                                                                 |
| Coarse role authorization fails                                                                 | No                               | Return generic `403`.                                                                                                               |
| Field authorization fails                                                                       | No                               | Return generic `403`; apply no fields.                                                                                              |
| Resource scope or relationship authorization fails                                              | No                               | Return privacy-preserving `404` or the matrix-defined generic `403`; do not extend activity.                                        |
| Policy-blocked operation                                                                        | No                               | Return `401`, `403`, or privacy-preserving `404` according to the matrix; never call the domain service.                            |
| Concurrent authorized requests                                                                  | Yes, per successful decision     | Row locking and `GREATEST` prevent timestamps moving backward; revocation or expiry causes the conditional update to return no row. |
| Absolute expiry is reached before the conditional activity update                               | No                               | Return generic `401`; do not execute domain work.                                                                                   |
| Absolute expiry is reached after domain execution starts                                        | No additional update             | The already-authorized in-flight request may complete; absolute expiry is never extended and every later request is denied.         |

No request may clear `revoked_at`, change `absolute_expires_at`, reuse a revoked session row, or recreate an expired session for the same issuer, subject, and `sid`. Reactivation requires a new identity-provider session with a new `sid` after the governing actor and role state permits access.

### Authorization State Changes And Revocation

Every authorization decision queries current state. State reduction therefore fails closed on the next request even when session revocation must follow an existing domain transaction. No row activation creates a workforce role implicitly.

| State change                                                | Authoritative state updated                                    | Revoke all actor sessions?          | Reason                            | Transaction boundary                                                                                        | Locking and concurrency                                                                                  | Next-request behavior                                                                                                                                    |
| ----------------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Actor activation                                            | `workforce_actors.is_active`, `activated_at`, `deactivated_at` | No; never un-revoke prior sessions  | n/a                               | One provisioning transaction.                                                                               | Lock actor row `FOR UPDATE`; reject concurrent conflicting state changes.                                | A new OIDC session may proceed only when an approved active role and scope also exist.                                                                   |
| Actor deactivation                                          | Actor state plus every active `workforce_sessions` row         | Yes                                 | `ACTOR_DEACTIVATED`               | Same provisioning transaction.                                                                              | Lock actor row, then active session rows in stable ID order.                                             | Generic `401`; no role evaluation or domain execution.                                                                                                   |
| Role assignment activation or deactivation                  | `workforce_role_assignments` row                               | Yes                                 | `ROLE_CHANGED`                    | Same provisioning transaction as the role change.                                                           | Lock actor and exact role row; uniqueness indexes resolve concurrent activation.                         | Existing session receives `401`; after reauthentication, current active roles determine `403` or access.                                                 |
| Administrative facility-scope assignment change             | Facility-scoped `workforce_role_assignments` row               | Yes                                 | `FACILITY_SCOPE_CHANGED`          | Same provisioning transaction as the scope change.                                                          | Lock actor and exact role/scope row; acquire locks in actor, role, session order.                        | Existing session receives `401`; reauthenticated requests use only current active facility scopes.                                                       |
| Facility deactivation                                       | `healthcare_facilities.is_active`                              | Required follow-up                  | `FACILITY_SCOPE_CHANGED`          | Existing facility operation commits first; session revocation is a required separate post-commit operation. | Lock facility during the domain update; follow-up locks affected actors and sessions in stable ID order. | Per-request facility-state checks immediately return scoped empty results, `403`, or privacy-preserving `404`; follow-up revocation then produces `401`. |
| Practitioner activation or deactivation                     | `practitioners.is_active`                                      | Required follow-up for linked actor | `PRACTITIONER_STATE_CHANGED`      | Existing practitioner operation commits first; linked-session revocation follows post-commit.               | Lock practitioner during update; follow-up locks linked actor and sessions.                              | Current-state checks immediately deny practitioner grants; activation grants nothing without an active role and assignment.                              |
| Practitioner-facility assignment activation or deactivation | `practitioner_facility_assignments.is_active`                  | Required follow-up for linked actor | `PRACTITIONER_ASSIGNMENT_CHANGED` | Existing roster transaction commits first; linked-session revocation follows post-commit.                   | Preserve existing roster transaction locks; follow-up locks linked actor and sessions.                   | Current assignment checks immediately remove or add scope; activation alone never creates a `PRACTITIONER` role.                                         |
| Practitioner binding change                                 | `workforce_actors.practitioner_id`                             | Yes                                 | `PRACTITIONER_BINDING_CHANGED`    | Same provisioning transaction as the binding change.                                                        | Lock actor and old/new practitioner rows in stable UUID order before uniqueness validation.              | Existing session receives `401`; a new session derives only the new current binding.                                                                     |
| Manual revocation                                           | Every active `workforce_sessions` row for the actor            | Yes                                 | `MANUAL_REVOCATION`               | One provisioning transaction.                                                                               | Lock actor and active session rows in stable ID order.                                                   | Generic `401` until a new non-revoked identity-provider session is established.                                                                          |

The non-atomic follow-up cases must expose an operational failure signal and remain retryable and idempotent. They must not claim atomic revocation. Their per-request joins against current facility, practitioner, and assignment state are the immediate security boundary, so a failed follow-up cannot preserve a removed role or scope.

### Migration Ordering And Rollback

The up migration order is:

1. `workforce_actors`;
2. `workforce_role_assignments`;
3. `workforce_sessions`;
4. constraints and indexes after their referenced tables exist.

The down migration order is:

1. `workforce_sessions`;
2. `workforce_role_assignments`;
3. `workforce_actors`.

Rollback must leave migrations 001 through 005 and all facility, practitioner, patient, appointment, and reminder data unchanged. Schema verification must require every column type, bounded character length, nullability, default, named constraint, foreign key delete action, and index predicate defined above. Every explicit PostgreSQL identifier must remain below the 63-byte limit.

## Controlled Out-Of-Band Provisioning

Sprint 15 must add one non-HTTP provisioning command. It must not add public role-management routes or UI.

### Interface

- Add an API-workspace command such as `npm run access:provision --workspace @hakimi/api`.
- Read one strict JSON command from standard input; reject unknown properties.
- Never accept credentials, tokens, OIDC subjects, or role changes as command-line arguments because process listings and shell history can expose them.
- Prohibit literal shell pipelines such as `echo '{...}' | npm run access:provision`; literal JSON and identifiers can enter shell history, process diagnostics, or terminal capture.
- The approved default is an interactive TTY mode: start the command with no provisioning values, then paste one JSON object only after the command disables terminal echo and displays a generic input prompt.
- A noninteractive alternative may read stdin redirected from a permission-restricted, non-source-controlled file on an encrypted local temporary volume. The operator must restrict access to the current account before writing, avoid synchronized or backed-up directories, and delete the file immediately after use.
- Secure deletion cannot be guaranteed on every journaled or solid-state filesystem. Operational guidance must prefer no-echo interactive input and must document residual temporary-file risk rather than claiming deletion is forensic erasure.
- Stdin transport alone does not guarantee secrecy. Issuer, subject, actor ID, practitioner ID, and facility ID are sensitive operational identifiers even though they are not passwords.
- Never read provisioning records from source-controlled seed files.
- Never log, echo, persist, or include the JSON payload in errors. Emit only a stable action code, success/failure status, and aggregate affected-row count. Do not log issuer, subject, actor ID, practitioner ID, facility ID, session hash, or supplied values.

### Allowed Actions

| Action            | Required behavior                                                                                              |
| ----------------- | -------------------------------------------------------------------------------------------------------------- |
| Provision actor   | Create an issuer/subject mapping or reject a conflicting mapping; optionally bind one practitioner.            |
| Activate actor    | Activate an existing actor; do not reactivate roles or sessions automatically.                                 |
| Deactivate actor  | Mark actor inactive and revoke all active sessions in the same transaction.                                    |
| Bind practitioner | Bind one active practitioner after proving no other actor is linked; revoke actor sessions.                    |
| Assign role       | Create or reactivate one approved role after validating role shape, facility existence, and facility activity. |
| Deactivate role   | Mark the exact role row inactive and revoke actor sessions in the same transaction.                            |
| Revoke sessions   | Revoke every active session for one actor using a closed privacy-safe reason.                                  |

There is no hard delete. Reactivation updates existing actor and role rows. Every command uses one PostgreSQL transaction, locks the actor row when it exists, handles uniqueness races deterministically, rolls back every failure path, and always releases the database client.

Provisioning authorization is operational and out of band. The database credential and accountable operating procedure remain deployment concerns under `OPEN-12`; the command itself must not claim to satisfy the unresolved clinical-audit requirements in `OPEN-06`.

## OIDC Resource-Server Specification

### Protocol Boundary

- Workforce clients use OIDC Authorization Code with PKCE using `S256`; the identity provider and client own the authorization redirect and code exchange.
- The Hakimi API is a resource server only. It adds no login, callback, password, refresh-token, recovery, registration, or consent endpoint.
- The runtime implementation should add a maintained JOSE/JWT verification dependency such as `jose`; handwritten cryptography and unsigned token decoding are prohibited.
- The API accepts bearer tokens only from the `Authorization` header. Query, body, and cookie tokens are rejected.
- JWKS retrieval uses one strictly configured HTTPS URI in production-like modes, bounded timeouts, bounded cache lifetime, and bounded refresh on an unknown `kid`.
- The identity-provider vendor and hosted deployment remain unselected.

### Required Environment Contract

The runtime implementation must add placeholder-only examples and strict parsing for:

| Variable                       | Rule                                                                                                            |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `OIDC_ISSUER`                  | Absolute issuer URL; parse only to validate URL shape, then preserve and compare the configured string exactly. |
| `OIDC_AUDIENCE`                | Nonblank exact API audience.                                                                                    |
| `OIDC_JWKS_URI`                | Absolute JWKS URL; HTTPS except an explicitly allowed loopback test/development URL.                            |
| `OIDC_ALLOWED_ALGORITHMS`      | Closed comma-separated subset of `RS256` and `ES256`; no symmetric or `none` algorithm.                         |
| `OIDC_REQUIRED_ACR_VALUES`     | Nonempty configured allowlist of identity-provider assurance values that prove workforce MFA.                   |
| `OIDC_CLOCK_TOLERANCE_SECONDS` | Integer from 0 through 60; default 30.                                                                          |

Access-token encoded length is limited to 16 KiB before JOSE parsing. Access-token maximum age is fixed in code at 600 seconds, interactive session absolute lifetime at eight hours, and inactivity timeout at 30 minutes. These security limits are not environment-configurable in Sprint 15.

Issuer comparison is exact and case-sensitive. URL parsing validates only that the configured value has the required absolute URL shape. The implementation must not lowercase any component, remove path segments, add or remove a trailing slash, resolve aliases, or otherwise canonicalize `OIDC_ISSUER` or the validated `iss` claim before comparison.

### Required Token Validation

Before database actor lookup, require all of the following:

- exactly one syntactically valid bearer token;
- signed JWT with a present `kid` and an algorithm in the configured asymmetric allowlist;
- valid signature from the configured JWKS;
- exact `iss` and `aud`;
- nonblank bounded `sub` and `sid` string claims;
- valid numeric `iat`, `nbf` when present, `exp`, and `auth_time`;
- current time inside the token validity window with only configured clock tolerance;
- `exp - iat` no greater than 600 seconds;
- `auth_time` no more than eight hours old; and
- `acr` in the configured workforce MFA assurance allowlist.

Reject ambiguous arrays or unexpected claim types. Do not use authorization claims from the token. Sprint 15 does not require, store, or atomically check `jti`, so it makes no access-token replay-detection claim. If `jti` is present, it has no authorization or revocation effect. Refresh-token rotation and token-family replay detection remain identity-provider responsibilities. Short token lifetime, workforce MFA, local session revocation, and current actor-state checks reduce but do not eliminate stolen bearer-token replay risk.

### Authentication And Authorization Errors

The runtime implementation must add stable shared/OpenAPI error contracts:

| Condition                                                      | Status | Stable code                    | Response boundary                                                             |
| -------------------------------------------------------------- | ------ | ------------------------------ | ----------------------------------------------------------------------------- |
| Missing, malformed, invalid, expired, or revoked token/session | `401`  | `AUTHENTICATION_REQUIRED`      | Generic message and standards-compliant `WWW-Authenticate: Bearer`; no cause. |
| Authenticated actor lacks operation or field grant             | `403`  | `FORBIDDEN`                    | Generic message; do not reveal required roles or policy expressions.          |
| Resource absent or outside authorized relationship             | `404`  | Existing domain not-found code | Keep absent and out-of-scope cases indistinguishable.                         |

Raw JOSE errors, token text, claims, issuer, subject, session identifiers, database errors, SQL, stack traces, and policy internals must not enter responses or logs. Stable operational event codes may distinguish only high-level outcomes such as token rejected, actor denied, session denied, and authorization denied; fields remain within the existing privacy-safe logger allowlist.

### Practitioner Relationship Boundary

For a practitioner to access an appointment resource, every request must prove in one parameterized scope query that:

- the workforce actor is active and linked to the practitioner referenced by the appointment resource;
- the `PRACTITIONER` workforce role is active;
- the practitioner record is active;
- an active practitioner-facility assignment connects that practitioner to the appointment facility; and
- the appointment row connects the same practitioner and facility, plus the patient when the query needs that relationship.

The approved policy does not identify which appointment statuses establish or continue practitioner access to a separate patient record. `OPEN-09` also leaves post-cancellation and post-completion access duration unresolved. Therefore Sprint 15 grants practitioners no `GET /api/v1/patients` or `GET /api/v1/patients/:patientId` access. A new product-owner decision must define an explicit appointment-status and duration predicate before either patient-read grant can be implemented. Viewing an authorized appointment resource does not grant independent access to the patient's demographic record.

## Closed Field Authorization Policy

The field policy operates only on request properties already accepted by the existing strict schemas and shared contracts. Unknown properties remain rejected by strict validation. For a known property, absence from the role's allowlist means deny by default with generic `403`. A body containing both allowed and denied known properties is rejected as a whole before domain execution; no partial update occurs and session activity is not extended.

| Operation                                                              | Role             | Exact allowed request properties                                                                                             | Known properties denied for that role                                                                                                    | Additional authorization boundary                                                                                                      |
| ---------------------------------------------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `PATCH /api/v1/facilities/:id`                                         | `PLATFORM_ADMIN` | `code`, `name`, `facilityType`, `licenseNumber`, `phone`, `email`, `region`, `city`, `addressLine`, `isActive`               | None                                                                                                                                     | Target facility may be any existing facility.                                                                                          |
| `PATCH /api/v1/facilities/:id`                                         | `FACILITY_ADMIN` | `name`, `phone`, `email`, `region`, `city`, `addressLine`                                                                    | `code`, `facilityType`, `licenseNumber`, `isActive`                                                                                      | Target must be an assigned facility. Identity, classification, license, and lifecycle fields lack an explicit facility-admin approval. |
| `PATCH /api/v1/practitioners/:practitionerId`                          | `PLATFORM_ADMIN` | `code`, `firstName`, `middleName`, `lastName`, `profession`, `licenseNumber`, `phone`, `email`, `bio`, `isActive`            | None                                                                                                                                     | Target may be any existing practitioner master record.                                                                                 |
| `PATCH /api/v1/practitioners/:practitionerId`                          | `PRACTITIONER`   | None - role-operation combination BLOCKED                                                                                    | `code`, `firstName`, `middleName`, `lastName`, `profession`, `licenseNumber`, `phone`, `email`, `bio`, `isActive`                        | No exact self-service field set is approved; a new product-owner field decision is required.                                           |
| `PATCH /api/v1/practitioners/:practitionerId/facilities/:assignmentId` | `PLATFORM_ADMIN` | `roleTitle`, `department`, `isPrimary`, `isActive`                                                                           | None                                                                                                                                     | Roster operation only; it never creates an authentication role.                                                                        |
| `PATCH /api/v1/practitioners/:practitionerId/facilities/:assignmentId` | `FACILITY_ADMIN` | `roleTitle`, `department`, `isPrimary`, `isActive`                                                                           | None                                                                                                                                     | Target assignment must belong to an assigned active facility; roster operation never creates an authentication role.                   |
| `PATCH /api/v1/patients/:patientId`                                    | `FACILITY_ADMIN` | `firstName`, `middleName`, `lastName`, `dateOfBirth`, `administrativeSex`, `phone`, `email`, `addressLine`, `city`, `region` | `isActive`                                                                                                                               | Patient must have exactly one registration globally and it must be at an assigned facility; otherwise the write is blocked.            |
| `PATCH /api/v1/patients/:patientId`                                    | `SCHEDULER`      | `firstName`, `middleName`, `lastName`, `dateOfBirth`, `administrativeSex`, `phone`, `email`, `addressLine`, `city`, `region` | `isActive`                                                                                                                               | Patient must have exactly one registration globally and it must be at an assigned facility; otherwise the write is blocked.            |
| `PATCH /api/v1/patients/:patientId`                                    | `PRACTITIONER`   | None - role-operation combination BLOCKED                                                                                    | `firstName`, `middleName`, `lastName`, `dateOfBirth`, `administrativeSex`, `phone`, `email`, `addressLine`, `city`, `region`, `isActive` | Practitioner patient mutation is not approved.                                                                                         |
| `PATCH /api/v1/appointments/:appointmentId`                            | `FACILITY_ADMIN` | `scheduledStart`, `scheduledEnd`                                                                                             | `status`                                                                                                                                 | Appointment facility must be assigned. Status-transition authority remains unresolved in `OPEN-09`.                                    |
| `PATCH /api/v1/appointments/:appointmentId`                            | `SCHEDULER`      | `scheduledStart`, `scheduledEnd`                                                                                             | `status`                                                                                                                                 | Appointment facility must be assigned. Status-transition authority remains unresolved in `OPEN-09`.                                    |
| `PATCH /api/v1/appointments/:appointmentId`                            | `PRACTITIONER`   | None - role-operation combination BLOCKED                                                                                    | `scheduledStart`, `scheduledEnd`, `status`                                                                                               | Practitioner scheduling and status mutation are not approved.                                                                          |
| `POST /api/v1/appointments/:appointmentId/cancel`                      | `FACILITY_ADMIN` | `cancellationReason`                                                                                                         | None                                                                                                                                     | Appointment facility must be assigned; existing domain cancellation rules remain unchanged.                                            |
| `POST /api/v1/appointments/:appointmentId/cancel`                      | `SCHEDULER`      | `cancellationReason`                                                                                                         | None                                                                                                                                     | Appointment facility must be assigned; existing domain cancellation rules remain unchanged.                                            |
| `POST /api/v1/appointments/:appointmentId/cancel`                      | `PRACTITIONER`   | `cancellationReason`                                                                                                         | None                                                                                                                                     | Appointment must belong to the linked practitioner at an actively assigned facility.                                                   |

`id`, `practitionerId`, `patientId`, `facilityId`, `medicalRecordNumber`, assignment identifiers, cancellation state, timestamps, registrations, and nested response objects are not properties of these mutation schemas and therefore can never be supplied. Empty PATCH bodies retain their existing `400` validation behavior.

## Exact Operation Policy

The canonical matrix in [TRACEABILITY.md](./TRACEABILITY.md#sprint-15-workforce-authorization-matrix) remains authoritative. The implementation policy must contain exactly these 26 rows and no implicit wildcard grants.

| Method | Normalized route                                                 | OpenAPI operation ID               | Sprint 15 decision     | Permitted workforce roles                                       | Required scope                                                                               |
| ------ | ---------------------------------------------------------------- | ---------------------------------- | ---------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| GET    | `/health/live`                                                   | `getHealthLive`                    | APPROVED FOR SPRINT 15 | Public                                                          | No authentication; preserve current `200`.                                                   |
| GET    | `/health/ready`                                                  | `getHealthReady`                   | APPROVED FOR SPRINT 15 | Public                                                          | No authentication; preserve current `200` or `503`.                                          |
| POST   | `/api/v1/facilities`                                             | `createHealthcareFacility`         | APPROVED FOR SPRINT 15 | `PLATFORM_ADMIN`                                                | Platform-wide non-patient administration.                                                    |
| GET    | `/api/v1/facilities`                                             | `listHealthcareFacilities`         | APPROVED FOR SPRINT 15 | `PLATFORM_ADMIN`, `FACILITY_ADMIN`, `SCHEDULER`, `PRACTITIONER` | Non-platform results restricted to active server-derived facility scope.                     |
| GET    | `/api/v1/facilities/:id`                                         | `getHealthcareFacilityById`        | APPROVED FOR SPRINT 15 | `PLATFORM_ADMIN`, `FACILITY_ADMIN`, `SCHEDULER`, `PRACTITIONER` | Active membership or practitioner assignment; privacy-preserving `404`.                      |
| PATCH  | `/api/v1/facilities/:id`                                         | `updateHealthcareFacility`         | APPROVED FOR SPRINT 15 | `PLATFORM_ADMIN`, `FACILITY_ADMIN`                              | Facility admin limited to an assigned active facility.                                       |
| DELETE | `/api/v1/facilities/:id`                                         | `deactivateHealthcareFacility`     | APPROVED FOR SPRINT 15 | `PLATFORM_ADMIN`                                                | Platform-wide non-patient administration.                                                    |
| POST   | `/api/v1/practitioners`                                          | `createPractitioner`               | APPROVED FOR SPRINT 15 | `PLATFORM_ADMIN`                                                | Global practitioner master-record administration.                                            |
| GET    | `/api/v1/practitioners`                                          | `listPractitioners`                | APPROVED FOR SPRINT 15 | `PLATFORM_ADMIN`, `FACILITY_ADMIN`, `SCHEDULER`, `PRACTITIONER` | Non-platform results restricted to active shared facility scope.                             |
| GET    | `/api/v1/practitioners/:practitionerId`                          | `getPractitionerById`              | APPROVED FOR SPRINT 15 | `PLATFORM_ADMIN`, `FACILITY_ADMIN`, `SCHEDULER`, `PRACTITIONER` | Self-link or active shared facility relationship.                                            |
| PATCH  | `/api/v1/practitioners/:practitionerId`                          | `updatePractitioner`               | APPROVED FOR SPRINT 15 | `PLATFORM_ADMIN`                                                | Practitioner self-mutation is blocked pending an exact field decision.                       |
| DELETE | `/api/v1/practitioners/:practitionerId`                          | `deactivatePractitioner`           | APPROVED FOR SPRINT 15 | `PLATFORM_ADMIN`                                                | Global practitioner lifecycle administration.                                                |
| POST   | `/api/v1/practitioners/:practitionerId/facilities`               | `createPractitionerAssignment`     | APPROVED FOR SPRINT 15 | `PLATFORM_ADMIN`, `FACILITY_ADMIN`                              | Facility admin limited to body facility; roster operation grants no authentication role.     |
| GET    | `/api/v1/practitioners/:practitionerId/facilities`               | `listPractitionerAssignments`      | APPROVED FOR SPRINT 15 | `PLATFORM_ADMIN`, `FACILITY_ADMIN`, `SCHEDULER`, `PRACTITIONER` | Scoped roster rows; practitioner may read own assignments.                                   |
| PATCH  | `/api/v1/practitioners/:practitionerId/facilities/:assignmentId` | `updatePractitionerAssignment`     | APPROVED FOR SPRINT 15 | `PLATFORM_ADMIN`, `FACILITY_ADMIN`                              | Facility admin must administer the assignment facility; no identity-role mutation.           |
| DELETE | `/api/v1/practitioners/:practitionerId/facilities/:assignmentId` | `deactivatePractitionerAssignment` | APPROVED FOR SPRINT 15 | `PLATFORM_ADMIN`, `FACILITY_ADMIN`                              | Facility admin must administer the assignment facility; no identity-role mutation.           |
| POST   | `/api/v1/patients`                                               | `createPatient`                    | APPROVED FOR SPRINT 15 | `FACILITY_ADMIN`, `SCHEDULER`                                   | Workforce-assisted registration at an assigned active facility only.                         |
| GET    | `/api/v1/patients`                                               | `listPatients`                     | APPROVED FOR SPRINT 15 | `FACILITY_ADMIN`, `SCHEDULER`                                   | Same-facility rows; practitioner patient-record access is blocked pending `OPEN-09`.         |
| GET    | `/api/v1/patients/:patientId`                                    | `getPatientById`                   | APPROVED FOR SPRINT 15 | `FACILITY_ADMIN`, `SCHEDULER`                                   | Same-facility registration; practitioner patient-record access is blocked pending `OPEN-09`. |
| PATCH  | `/api/v1/patients/:patientId`                                    | `updatePatient`                    | APPROVED FOR SPRINT 15 | `FACILITY_ADMIN`, `SCHEDULER`                                   | Require exactly one registration globally at an assigned facility; deny every other write.   |
| DELETE | `/api/v1/patients/:patientId`                                    | `deactivatePatient`                | BLOCKED                | None                                                            | `401` unauthenticated; `403` in-scope workforce; `404` absent or outside scope.              |
| POST   | `/api/v1/appointments`                                           | `createAppointment`                | APPROVED FOR SPRINT 15 | `FACILITY_ADMIN`, `SCHEDULER`                                   | Workforce-assisted scheduling in an assigned active facility only.                           |
| GET    | `/api/v1/appointments`                                           | `listAppointments`                 | APPROVED FOR SPRINT 15 | `FACILITY_ADMIN`, `SCHEDULER`, `PRACTITIONER`                   | Assigned facility; practitioner restricted to own practitioner ID.                           |
| GET    | `/api/v1/appointments/:appointmentId`                            | `getAppointmentById`               | APPROVED FOR SPRINT 15 | `FACILITY_ADMIN`, `SCHEDULER`, `PRACTITIONER`                   | Assigned facility or own practitioner relationship; privacy-preserving `404`.                |
| PATCH  | `/api/v1/appointments/:appointmentId`                            | `updateAppointment`                | APPROVED FOR SPRINT 15 | `FACILITY_ADMIN`, `SCHEDULER`                                   | Only rescheduling fields are allowed; status and practitioner mutation are blocked.          |
| POST   | `/api/v1/appointments/:appointmentId/cancel`                     | `cancelAppointment`                | APPROVED FOR SPRINT 15 | `FACILITY_ADMIN`, `SCHEDULER`, `PRACTITIONER`                   | Assigned facility or own practitioner relationship; no patient self-service.                 |

All protected collection count and result queries must apply identical scope predicates and deterministic ordering. Every SQL value remains parameterized. No request may provide a sort expression, role, actor, facility authority, or SQL fragment.

## Synthetic-Data-Only Test Plan

### Fixture Rules

- Generate OIDC signing keys in test setup; never use a real identity provider, production JWKS, or production credential.
- Use loopback issuer/JWKS URLs, `.example` domains, fictional names, deterministic test UUIDs, and synthetic facility, practitioner, patient, and appointment records.
- Never copy production-like patient records, contact details, tokens, or logs into fixtures or snapshots.
- Never print synthetic JWTs or claims even though they are non-production.

### Unit Coverage

- Bearer parsing rejects missing, duplicate, query, cookie, malformed, and oversized tokens.
- JOSE validation covers signature, `kid`, algorithm allowlist, exact issuer string, audience, claim types, `iat`, `nbf`, `exp`, `auth_time`, maximum token age, clock tolerance, and MFA `acr`.
- Issuer tests prove case, paths, and trailing slashes are not normalized. `jti` is not required, stored, or treated as replay protection.
- JWKS tests cover cache reuse, bounded unknown-key refresh, key rotation, timeout, and opaque failures.
- Actor mapping denies unknown and inactive actors and never creates an actor from token claims.
- Session tests cover first-seen creation only after complete authorization, 30-minute inactivity, eight-hour absolute expiry, local revocation, concurrent first requests, conditional `GREATEST` updates, and no extension after authentication, role, field, scope, relationship, blocked-operation, or out-of-scope failure.
- Authorization policy is table-driven across all 26 operations, five workforce roles, public health access, and the blocked patient deletion.
- Field policy tests derive the complete accepted-property set for all six mutation operations from existing schemas and prove every role/property combination matches the closed allowlist, with mixed allowed/denied bodies rejected atomically.
- Provisioning parser rejects unknown fields, `PATIENT`, invalid role/scope combinations, raw-token input, command-line secrets, echoed payloads, and non-TTY input that lacks a permission-restricted source.
- Privacy tests prove tokens, claims, issuer, subject, session hash, actor IDs, practitioner IDs, facility IDs, SQL, database details, and raw errors are absent from logs and responses.

### Route Coverage

- Both public health endpoints preserve current contracts without authentication.
- Every protected operation returns generic `401` for missing, invalid, expired, or revoked authentication.
- Every protected operation has at least one permitted workforce path and one denied-role path, except the blocked operation, which has no permitted path.
- Resource routes prove absent and out-of-scope identifiers return indistinguishable existing domain `404` envelopes.
- Collection routes prove facility and practitioner scopes constrain both count and rows without duplicates.
- Practitioner patient list and patient-by-ID requests return generic `403` and never call patient repositories pending `OPEN-09`; practitioner appointment reads still require active actor, role, practitioner, facility, assignment, and matching appointment predicates.
- Field-denied requests return generic `403`, do not execute domain services, and do not update session activity.
- Existing strict validation, status codes, payloads, `Location`, pagination, and `X-Request-ID` behavior remain stable for authorized callers.
- `DELETE /api/v1/patients/:patientId` returns `403` for authenticated in-scope workforce and never calls the patient service.

### PostgreSQL Integration Coverage

- Migration 006 applies after migrations 001 through 005, is idempotent through the runner, and rolls back without changing earlier schema or data.
- Exact columns, lengths, defaults, checks, foreign keys, delete actions, and indexes pass schema verification.
- Duplicate issuer/subject, duplicate practitioner binding, duplicate role/scope, invalid role, invalid scope shape, and invalid lifecycle state fail at the database boundary.
- All foreign keys use `ON DELETE RESTRICT` and prevent unsafe deletion.
- Provisioning transactions roll back every partial actor, role, practitioner-link, and session-revocation failure.
- Concurrent actor and role provisioning resolves deterministically without duplicate authority.
- Actor deactivation and controlled role, scope, binding, and manual changes revoke sessions in the same provisioning transaction with the specified reason.
- Facility, practitioner, and roster state changes prove fail-closed current-state checks immediately remove access before retryable post-commit session revocation completes.
- Concurrent state reduction and request authorization prove the conditional session-activity update cannot revive, extend, or use revoked or expired state.
- Cross-facility patient and appointment reads/writes cannot escape mandatory predicates under concurrent requests.
- Roster activation alone never grants a practitioner role.

### Contract And Documentation Coverage

- Shared error contracts add only the approved `401` and `403` codes.
- OpenAPI defines one workforce bearer scheme, applies it to exactly 24 protected operations, leaves two health operations public, and documents the blocked patient deletion response.
- OpenAPI and Express operation sets remain exactly 26 and match the authorization policy exactly once.
- README and operational documentation explain synthetic setup, provisioning, revocation, privacy-safe diagnostics, and the production prohibition.

## Implementation Sequence

1. Approve and merge this documentation specification; return to a clean `main`.
2. Create the Sprint 15 runtime feature branch from that reviewed `main`.
3. Add the reviewed JOSE dependency and strict placeholder-only OIDC environment contract.
4. Add migration 006 up/down files, migration-catalog tests, schema verification, and PostgreSQL integration tests.
5. Implement the access repository, actor/session resolution, and controlled provisioning command.
6. Implement OIDC verification and authentication middleware with privacy-safe errors and logs.
7. Implement the closed 26-operation policy, exact field allowlists, and conservative practitioner relationship boundary.
8. Add mandatory current-state and scope predicates to domain repository queries and preserve count/result parity.
9. Implement atomic post-authorization session activity and the state-change revocation/follow-up matrix.
10. Update shared contracts and OpenAPI before or with runtime `401` and `403` behavior.
11. Complete unit, route, migration, integration, privacy, concurrency, and rollback coverage.
12. Update README and operations documentation without authorizing production.
13. Run the complete repository verification matrix and review the full diff before any commit or push.

## Runtime Acceptance Criteria

Sprint 15 runtime implementation is acceptable only when all of the following are true:

- Migration 006 exactly implements this schema, passes schema verification, and rolls back safely.
- No migration 001 through 005 checksum changes.
- No public actor, role, session, login, recovery, or role-administration endpoint is added.
- An actor must be pre-provisioned; a valid token alone grants nothing.
- Mutable roles, scopes, activation, and revocation are loaded from current PostgreSQL state on every request.
- Initial role provisioning is no-echo interactive-stdin by default, transactional, privacy-safe, and out of band; literal shell payloads are prohibited.
- OIDC signature and claim validation, workforce MFA, token lifetime, session lifetime, inactivity, and revocation rules pass focused tests.
- Issuer comparison is exact after URL-shape validation; `jti` is not required and no access-token replay-detection claim is made.
- Exactly two health operations remain public.
- Exactly 25 operations have approved workforce paths and patient deletion remains blocked.
- No permitted role cell or runtime policy includes `PATIENT`.
- Practitioner appointment access requires active actor, role, practitioner, facility, assignment, and matching appointment predicates. Practitioner patient-record access remains blocked pending an `OPEN-09` status-and-duration decision.
- Every shared mutation operation enforces the exact closed field matrix; unlisted known fields are denied and mixed bodies are never partially applied.
- Session activity is created or extended only after complete authorization and immediately before domain execution; no denial or expired/revoked state extends activity.
- Every authorization-state change follows the documented transaction, locking, revocation-reason, fail-closed, and follow-up rules.
- Patient registration and appointment creation remain workforce-assisted.
- Generic `401`, generic `403`, and privacy-preserving absent-or-out-of-scope `404` behavior match OpenAPI.
- Existing successful response contracts and domain behavior remain unchanged for authorized callers.
- Logs and errors contain no token, claim, subject, session, credential, SQL, raw error, patient identifier, contact information, or patient data.
- All tests use synthetic data and local test keys only.
- Documentation continues to state that production and real patient-data processing are not authorized.

Required verification commands for the future runtime branch:

```bash
npm run db:migrate:status
npm run db:migrate
npm run db:migrate
npm run db:migrate:status
npm run db:schema:verify
npm run lint
npm run typecheck
npm test
npm run test:integration:db
npm run api:docs:validate
npm run build
npm run format:check
npm audit --omit=dev --audit-level=high
npm audit --audit-level=high
node scripts/validate-product-baseline.mjs
docker compose config
docker build -t hakimi-healthcare-platform:ci .
git diff --check
git status --short --untracked-files=all
```

Rollback verification must also run `npm run db:migrate:down`, prove only migration 006 is removed, run schema checks appropriate to the rolled-back catalog, and then reapply migration 006 before final verification.

## Production Activation Gate

Passing Sprint 15 tests does not authorize production. Production deployment and processing of real patient data remain blocked until all of the following are explicitly resolved and reviewed:

- [OPEN-02](./REQUIREMENTS.md): privacy, consent, notice, and purpose limitation;
- [OPEN-06](./REQUIREMENTS.md): audit events, review, and retention;
- [OPEN-07](./REQUIREMENTS.md): retention and deletion;
- [OPEN-08](./REQUIREMENTS.md): patient identity, account linking, multi-facility ownership, duplicate handling, and merge policy;
- [OPEN-09](./REQUIREMENTS.md): appointment rules, including any status and duration predicate for practitioner patient-record access;
- [OPEN-10](./REQUIREMENTS.md): applicable legal and regulatory requirements;
- [OPEN-12](./REQUIREMENTS.md): deployment target and operational ownership; and
- applicable privacy, legal, security, and operational review.

No Sprint 15 implementation decision may silently resolve these records.

## Specification Review Gate

Before creating a runtime feature branch, reviewers must confirm:

- the persistence model is minimal, reversible, and contains no patient account or clinical-audit schema;
- authoritative roles and scopes cannot be created by token claims or practitioner roster routes;
- provisioning is controlled, transactional, out of band, and non-public;
- OIDC behavior is provider-neutral and resource-server-only;
- every shared mutation enforces the reviewed closed field matrix before domain execution;
- practitioner patient-record access remains blocked pending an explicit `OPEN-09` status-and-duration decision;
- session activity and authorization-state changes follow the specified fail-closed concurrency and revocation rules;
- all 26 operations match the approved matrix exactly once;
- all test data is synthetic;
- blocked patient-facing and production boundaries are explicit; and
- approval of this specification is recorded without changing `OPEN-03`, `OPEN-04`, or `OPEN-05` to `IMPLEMENTED`.
