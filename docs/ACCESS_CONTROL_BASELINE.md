# Approved Workforce Identity And Access-Control Baseline

## Status And Authority

This document records the product-owner outcomes for [OPEN-03](./REQUIREMENTS.md), [OPEN-04](./REQUIREMENTS.md), and [OPEN-05](./REQUIREMENTS.md). Each decision is **APPROVED WITH REVISIONS** for a bounded workforce-only Sprint 15 and is recorded as `PLANNED` in the canonical register. The patient-facing remainder stays blocked, and the current runtime remains unauthenticated and unauthorized.

## Recorded Approval

| Approval field                  | Recorded value                                                                                                                   |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Decision                        | `APPROVED WITH REVISIONS`                                                                                                        |
| Canonical implementation status | `PLANNED`                                                                                                                        |
| Authorized product owner        | Habte Selasie                                                                                                                    |
| Organizational role/title       | Repository Owner and Product Decision Authority                                                                                  |
| Decision date                   | 2026-08-26                                                                                                                       |
| Evidence reference              | [GitHub issue #36](https://github.com/wku572/hakimi-healthcare-platform/issues/36)                                               |
| Approved boundary               | Workforce-only Sprint 15 design, implementation, and testing with synthetic data                                                 |
| Blocked boundary                | Patient-facing identity and self-service, production deployment, and processing of real patient data pending the decisions below |

The evidence reference is the accountable authority for the approved-with-revisions outcome. It does not promote runtime authentication or authorization to `IMPLEMENTED` and does not authorize production use.

The three outcomes remain independently governed:

| Authority record | Approved workforce baseline                                                                                                                                             | Revision and blocked remainder                                                                                                                              |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OPEN-03`        | Workforce actor catalogue, role vocabulary, privilege boundaries, and facility scope.                                                                                   | Role-assignment administration is excluded. `PATIENT` role activation remains blocked pending `OPEN-08`.                                                    |
| `OPEN-04`        | OIDC Authorization Code with PKCE, workforce MFA, short-lived access tokens, revocation, and unique workload identities.                                                | Patient authentication, patient MFA, and patient account recovery remain blocked pending `OPEN-02`, `OPEN-07`, `OPEN-08`, and `OPEN-10`.                    |
| `OPEN-05`        | Default-deny workforce authorization from immutable server-derived context, facility isolation, same-facility workforce access, and privacy-preserving denial behavior. | Patient self-service, cross-facility patient writes, and global patient deactivation remain blocked pending `OPEN-02`, `OPEN-07`, `OPEN-08`, and `OPEN-10`. |

These approvals authorize only the workforce scope marked `APPROVED FOR SPRINT 15` in the operation matrix. They do not authorize any blocked patient-facing capability or infer privacy, retention, identity, or legal policy.

## Approved Workforce Role Resolution For OPEN-03

### Human Actors And Roles

One person may hold multiple workforce roles. Workforce roles are scoped independently for each facility unless a role is explicitly platform-wide. Role authority is not inherited merely because a person appears in a practitioner, patient, or facility record.

| Role                  | Sprint 15 scope                            | Approved workforce privileges                                                                                                                              | Explicit boundary                                                                                                                  |
| --------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `PLATFORM_ADMIN`      | Platform-wide                              | Create and deactivate facilities; manage global practitioner master records; perform non-clinical platform administration.                                 | No routine patient or appointment access. It is not a break-glass clinical role.                                                   |
| `FACILITY_ADMIN`      | One or more explicitly assigned facilities | Manage the assigned facility profile, facility roster and assignments, patient registration administration, and appointments for the assigned facility.    | Cannot act for an unassigned facility or modify platform-wide identity policy.                                                     |
| `SCHEDULER`           | One or more explicitly assigned facilities | Register patients, read the minimum demographics needed for scheduling, and create, view, reschedule, or cancel appointments within the assigned facility. | Cannot manage facilities, practitioner master records, role assignments, or global patient lifecycle.                              |
| `PRACTITIONER`        | Active practitioner assignments            | Read their own profile and assignments and view appointment resources connected to their own active assignments.                                           | Patient-record access, profile mutation, rescheduling, and status mutation remain blocked unless separately approved.              |
| `PATIENT`             | Deferred; inactive in Sprint 15            | None. The role remains a catalogue placeholder only.                                                                                                       | Activation, authentication, MFA, recovery, and self-service remain blocked pending `OPEN-02`, `OPEN-07`, `OPEN-08`, and `OPEN-10`. |
| `OPERATIONS_OPERATOR` | Runtime operations                         | Observe liveness/readiness and operate approved runtime infrastructure outside the domain API.                                                             | No facility, practitioner, patient, appointment, or reminder-content access through this role.                                     |

Role-assignment administration is excluded from Sprint 15. No public API, user interface, or product workflow may create, update, or remove identity-role assignments until that workflow is separately defined and approved. Existing practitioner-facility assignment operations manage healthcare rosters; they do not grant authentication roles.

### Authoritative Access State

- Sprint 15 requires an authoritative server-side source for subject-to-actor mapping, current workforce roles, facility scopes, actor activation state, and revocation state.
- Initial workforce assignments must be provisioned through a controlled out-of-band process while role-assignment administration APIs and user interfaces remain excluded.
- Practitioner-facility roster operations manage healthcare relationships only and must never create or modify authentication roles.
- Access-token claims may identify a subject and session, but they must not create or modify mutable workforce roles, facility scopes, activation state, or revocation state.
- Before runtime coding begins, the proposed [Sprint 15 implementation specification](./SPRINT_15_IMPLEMENTATION_SPEC.md) must be reviewed and approved with its minimum persistence model and migration boundary for authoritative access state and sessions.
- The approved baseline and proposed specification do not implement that persistence model.

The approved workforce catalogue does not establish employment, licensure, clinical responsibility, consent, or legal authority.

### Service Actors

| Service actor        | Approved access                                                                                             | Boundary                                                                                             |
| -------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `HEALTH_PROBE`       | Call public liveness and readiness endpoints.                                                               | Receives only the existing health payloads and no domain data.                                       |
| `REMINDER_WORKER`    | Use a dedicated workload and database identity for the existing reminder processing path.                   | No public HTTP-domain privileges; aggregate diagnostics only; no reminder content in logs.           |
| `MIGRATION_OPERATOR` | Run the existing migration and schema-verification commands with a separately controlled database identity. | Not an application user and not available to normal runtime requests.                                |
| `API_RUNTIME`        | Connect to PostgreSQL and execute only application operations required by the API.                          | Does not grant caller privileges; every human request still requires its own authorization decision. |

Shared service credentials, human use of service identities, and service use of human sessions are prohibited by the approved workforce baseline.

### Privilege Model

The approved workforce model combines coarse role-based privileges with server-evaluated attributes:

- Role answers which operation category an actor may attempt.
- Facility membership or active practitioner assignment answers where the actor may operate.
- An approved workforce role and same-facility registration answer whose patient data a facility administrator or scheduler may access.
- Request-field rules answer which fields the actor may change through a shared `PATCH` operation.
- Resource state answers whether inactive actors, assignments, facilities, or sessions must be denied.

Possession of a valid credential is never sufficient authorization. Every operation is denied unless an explicit matrix row permits the actor, scope, resource relationship, and requested fields.

### Immutable Server-Derived Authorization Context

After credential validation, Sprint 15 should construct one authorization context for the request and treat it as immutable:

| Context field     | Source                                                   | Rule                                                                             |
| ----------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `actorId`         | Server-side actor mapping for the authenticated subject  | Never accepted from body, query, or route parameters.                            |
| `actorType`       | Server-side actor or workload record                     | Limited to approved human and service actor types.                               |
| `sessionId`       | Validated authentication session                         | Used only as an opaque security identifier and never logged raw.                 |
| `roleAssignments` | Current server-side role assignments                     | Re-evaluated on each request or from a bounded, revocation-aware cache.          |
| `facilityScopes`  | Active facility memberships and practitioner assignments | Request-supplied facility IDs can narrow scope but never create it.              |
| `patientId`       | Deferred server-side patient-to-account link             | Not populated or accepted in Sprint 15 while patient-role activation is blocked. |
| `serviceScopes`   | Approved workload registration                           | Human roles cannot be inferred from service scopes.                              |

Tokens may identify the subject and session, but token claims alone must not be authoritative for mutable roles, facility memberships, account activation, practitioner assignments, or patient links.

### Facility Isolation And Cross-Facility Access

- Facility-scoped roles operate only in facilities listed in the server-derived context.
- Collection queries must add mandatory scope predicates before pagination and counting; request filters cannot broaden them.
- Resource-by-ID operations must resolve scope in the same parameterized query used to retrieve the resource where practical.
- A practitioner may have multiple active assignments, but each patient or appointment decision must match an active assignment at the resource facility.
- Patient self-service and patient-derived facility scope are blocked in Sprint 15.
- `PLATFORM_ADMIN` may cross facility boundaries only for non-patient platform administration described in the matrix.
- No routine human role receives unrestricted cross-facility patient access.
- Break-glass access is not proposed. It remains blocked until privacy, audit, legal, retention, and accountable-ownership decisions are approved.

### Patient-Data Boundaries

| Actor                 | Approved or blocked patient-data boundary                                                                                                                                                                                        |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FACILITY_ADMIN`      | Minimum patient registration and appointment data for patients registered at an assigned facility.                                                                                                                               |
| `SCHEDULER`           | Minimum demographics and appointment data required for registration and scheduling at an assigned facility.                                                                                                                      |
| `PRACTITIONER`        | Own appointment resources require an active practitioner and facility assignment. Patient-record access is blocked pending an `OPEN-09` decision defining which appointment statuses, if any, establish access and for how long. |
| `PATIENT`             | Blocked. No patient account link, credential, or self-service access is active in Sprint 15.                                                                                                                                     |
| `PLATFORM_ADMIN`      | No routine patient or appointment access.                                                                                                                                                                                        |
| `OPERATIONS_OPERATOR` | No patient or appointment access.                                                                                                                                                                                                |
| Service actors        | Only the minimum database records required for the service's existing task; no human browsing capability.                                                                                                                        |

Same-facility workforce access is approved only for the minimum registration and scheduling purpose represented by the current operations. Staff updates to a patient shared across facilities remain blocked by [OPEN-08](./REQUIREMENTS.md), and global patient deactivation remains blocked by `OPEN-07` and `OPEN-08`.

## Approved Workforce Authentication Resolution For OPEN-04

### Human Authentication Mechanism

- Use OpenID Connect Authorization Code flow with PKCE through a standards-compliant identity provider.
- Hakimi does not store human passwords or implement password verification in the API.
- The API accepts only signed access tokens from an explicit issuer, audience, and algorithm allowlist.
- Reject missing signatures, `none`, unexpected algorithms, wrong issuer or audience, expired tokens, premature tokens, malformed subjects, and revoked or inactive sessions.
- Use a maximum access-token lifetime of 10 minutes.
- Rotate refresh tokens after every use and revoke the token family when replay is detected.
- Use a maximum interactive session lifetime of 8 hours and a 30-minute inactivity timeout for workforce roles.
- Require multi-factor authentication for `PLATFORM_ADMIN`, `FACILITY_ADMIN`, `SCHEDULER`, `PRACTITIONER`, and `OPERATIONS_OPERATOR` sessions.
- Patient authentication and patient MFA are not part of Sprint 15.
- Workforce credential and factor recovery remains delegated to the identity provider; Hakimi does not add a recovery API or user interface in Sprint 15.
- Patient account recovery is not part of Sprint 15 and must not be invented as an implementation side effect.

The identity-provider product and hosting model are not selected by this baseline. Selection must preserve the protocol and lifecycle requirements above without introducing provider-specific authorization logic into domain services.

### Service Authentication Mechanism

- Give every workload a unique non-human identity and least-privilege credential.
- Prefer short-lived workload credentials; where the local container baseline cannot issue them, use separately injected, rotatable secrets as an interim deployment constraint.
- Never place workload credentials in source control, image layers, logs, error responses, or human environment examples.
- Do not allow a service credential to call human domain operations unless an operation is explicitly added to the authorization matrix through a recorded decision.

### Lifecycle

| Lifecycle event | Approved workforce behavior or blocked boundary                                                                                                                                                                                           |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Activation      | A workforce account remains denied until its subject mapping is active and at least one approved workforce role and scope is provisioned outside the excluded role-administration workflow. Patient activation is blocked.                |
| Deactivation    | Set the local actor inactive, revoke active sessions, and deny subsequent requests even if an unexpired token remains. Deactivating a practitioner or patient domain record does not automatically define account policy.                 |
| Revocation      | Revoke the session and refresh-token family; privileged role removal and facility-membership removal take effect on the next authorization evaluation.                                                                                    |
| Expiration      | Reject expired access tokens with the generic authentication error and require reauthentication when the session has expired.                                                                                                             |
| Recovery        | Workforce credential and factor recovery is delegated to the identity provider with generic responses, separately authorized administration, and MFA reset controls. Hakimi adds no recovery API or UI. Patient recovery remains blocked. |
| Replay          | Reject reused refresh tokens, revoke the affected token family, and require reauthentication. Audit-event content and retention remain governed by `OPEN-06`.                                                                             |

## Approved Workforce Authorization Resolution For OPEN-05

### Default Deny

- Only the two health operations are explicitly public.
- Every domain operation requires a validated human identity and an explicit matrix grant.
- Service actors have no public domain-operation grant in Sprint 15.
- Missing matrix rows, unknown roles, inactive actors, inactive role assignments, ambiguous scope, and unavailable authorization context are denied.
- Authorization is enforced before domain services perform state-changing work or return protected data.
- Field-level authorization is required where a shared `PATCH` operation serves roles with different privileges.

### Denial Behavior

| Condition                                                                                                                | Approved HTTP behavior                                                                                  | Information boundary                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Missing, invalid, expired, or revoked authentication                                                                     | `401` with a stable generic authentication envelope and standards-compliant challenge where applicable. | Do not distinguish missing accounts, inactive accounts, revoked sessions, or token-validation details. |
| Authenticated actor lacks an operation or field privilege on an otherwise in-scope resource                              | `403` with a stable generic forbidden envelope.                                                         | Do not expose required roles or internal policy expressions.                                           |
| Resource identifier is absent or exists outside the actor's facility, patient, practitioner, or appointment relationship | Existing domain-specific `404` envelope.                                                                | Make absent and out-of-scope resources indistinguishable to prevent enumeration and IDOR.              |
| Collection contains no in-scope resources                                                                                | `200` with the existing empty paginated response.                                                       | Apply identical mandatory scope predicates to count and result queries.                                |
| Public health request                                                                                                    | Preserve existing `200` and readiness `503` behavior.                                                   | Never add authentication details or protected domain data.                                             |

Sprint 15 may add stable `401` and `403` codes only through an explicit API-contract update. Existing domain-specific not-found responses should remain stable for privacy-preserving `404` handling.

## Threat Model

| Threat                | Approved workforce mitigation or blocked boundary                                                                                                                | Remaining dependency                                                      |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| IDOR                  | Server-derived resource scope; scoped repository queries; privacy-preserving `404`; negative cross-facility tests.                                               | Patient identity and shared-record ownership remain in `OPEN-08`.         |
| Enumeration           | Generic authentication/recovery responses; identical absent/out-of-scope `404`; filtered collections; rate-limit design before public deployment.                | Privacy policy remains in `OPEN-02`.                                      |
| Replay                | Short-lived access tokens and issuer time validation; identity-provider refresh-token rotation and token-family revocation. The API keeps no `jti` replay state. | Bearer replay risk remains; audit-event requirements remain in `OPEN-06`. |
| Token theft           | TLS-only deployment; no token logging; short lifetimes; secure client storage; revocation; workforce MFA.                                                        | Deployment target and secret ownership remain in `OPEN-12`.               |
| Credential leakage    | External credential verification; secret injection; no credentials in source, images, examples, logs, or errors; independent workload identities.                | Applicable obligations remain in `OPEN-10`.                               |
| Privilege escalation  | Default deny; server-side roles; no client-controlled scope; field-level checks; explicit role-assignment privilege; negative tests.                             | Role-assignment administration is excluded by `OPEN-03`.                  |
| Cross-facility access | Mandatory facility predicates; active membership checks; relationship-aware retrieval; no unrestricted patient superuser.                                        | Multi-facility patient policy remains in `OPEN-08`.                       |
| Inactive accounts     | Check local actor and relevant role/assignment state during every authorization evaluation; revoke sessions on deactivation.                                     | Retention and deletion remain in `OPEN-07`.                               |

Rate limits, security-event persistence, alerting, evidence retention, and incident-response ownership are not defined here because they depend on unresolved audit, deployment, privacy, and legal policy.

## Deferred And Blocked Decisions

The following revisions remain outside the approved workforce baseline:

- `OPEN-03`: identity-role assignment administration and `PATIENT` role activation;
- `OPEN-04`: patient authentication, patient MFA, patient account recovery, and any patient session lifecycle;
- `OPEN-05`: patient self-service, cross-facility patient writes, global patient deactivation, and any patient-derived authorization context;
- `OPEN-08`: patient account linking, multi-facility write ownership, duplicate handling, and identity merge policy;
- `OPEN-09`: appointment transition and cancellation rules, plus any appointment-status and access-duration predicate that could authorize practitioner patient-record access;
- `OPEN-11`: reminder channel identity and delivery policy;
- `OPEN-12`: identity-provider hosting, secret ownership, runtime ownership, and operational accountability.

The following records remain explicitly unresolved and are not inferred by this baseline:

- [OPEN-01](./REQUIREMENTS.md): broader healthcare and business workflow rules;
- [OPEN-02](./REQUIREMENTS.md): privacy, consent, notice, and purpose limitation;
- [OPEN-06](./REQUIREMENTS.md): security and clinical audit events, review, and retention;
- [OPEN-07](./REQUIREMENTS.md): retention, hard deletion, and global patient deactivation;
- [OPEN-10](./REQUIREMENTS.md): applicable jurisdictions, healthcare regulation, and data-protection law.

## Approved Use And Production Gate

- The recorded approval authorizes bounded Sprint 15 design, implementation, and testing with synthetic data only.
- It does not authorize production deployment or processing of real patient data.
- Production activation remains blocked pending [OPEN-02](./REQUIREMENTS.md), [OPEN-10](./REQUIREMENTS.md), [OPEN-12](./REQUIREMENTS.md), and applicable privacy, legal, security, and operational review.
- [OPEN-06](./REQUIREMENTS.md) and [OPEN-07](./REQUIREMENTS.md) remain unresolved for audit requirements, retention, and deletion.
- [OPEN-08](./REQUIREMENTS.md) remains unresolved for patient identity, account linking, multi-facility ownership, duplicate handling, and merge policy.
- Sprint 15 must not implement patient authentication, patient MFA, patient recovery, patient sessions, patient self-service, patient-derived authorization context, cross-facility patient writes, or global patient deactivation.

## Sprint 15 Implementation Constraints

The approved bounded workforce baseline authorizes Sprint 15 to:

- preserve the current health payloads, domain success payloads, request IDs, and privacy-safe logging boundary;
- update OpenAPI before or with any new `401` and `403` runtime responses;
- introduce one centralized authentication boundary before protected routes and centralized authorization helpers before domain service execution;
- keep resource-scope enforcement in parameterized repository queries rather than filtering protected rows in memory;
- construct immutable authorization context only from validated credentials and current server-side state;
- review and approve the minimum actor, workforce-role, facility-scope, activation, revocation, and session persistence and migration boundary in the [Sprint 15 implementation specification](./SPRINT_15_IMPLEMENTATION_SPEC.md) before runtime coding begins;
- provision initial workforce assignments through a controlled out-of-band process until role-assignment administration is separately defined and approved;
- reject client attempts to supply actor, role, facility-membership, or patient-link authority;
- enforce field-level privileges for shared update operations;
- use dedicated service identities and never reuse human credentials;
- add route, service, and PostgreSQL integration tests for every permitted and denied role/scope path;
- include concurrency and revocation tests where stale authorization state could grant access;
- preserve sanitized errors and exclude credentials, claims, tokens, role assignments, patient identifiers, and policy internals from logs;
- avoid changing patient identity, appointment, reminder, retention, privacy, legal, recovery, or audit policy as a side effect of implementation;
- keep the `PATIENT` role inactive and exclude patient credentials, sessions, MFA, recovery, and self-service;
- exclude public role-assignment administration APIs, user interfaces, and workflows;
- deny cross-facility patient writes and global patient deactivation;
- use synthetic data only for Sprint 15 implementation and testing; do not deploy to production or process real patient data under this approval.

## Explicit Exclusions

- No patient authentication, patient MFA, patient recovery, or patient self-service in Sprint 15.
- No Hakimi-hosted account-recovery API or user interface; patient account recovery remains blocked.
- No identity-role assignment administration API, user interface, or product workflow.
- This approval-recording change introduces no database schema. The bounded Sprint 15 specification must define any minimum actor, workforce-role, facility-scope, activation, revocation, or session persistence required for implementation. Clinical-audit persistence remains blocked by `OPEN-06`.
- No identity-provider vendor selection or hosted-service configuration.
- No login, registration, recovery, consent, or role-administration UI.
- No break-glass workflow.
- No clinical audit log or retention schedule.
- No inferred legal, regulatory, privacy, or consent policy.
- No production deployment or processing of real patient data.
- No modification to reminder timing, content, channels, retries, or delivery adapter.
- No deployment, Docker, Compose, CI, migration, OpenAPI, dependency, or API behavior change.

## Operation-Level Coverage

The approved workforce authorization treatment for every current public operation is recorded once in the [Sprint 15 authorization matrix](./TRACEABILITY.md). The independently derived baseline contains 26 OpenAPI operations and the same 26 Express operations, with no contract-only, implementation-only, duplicate, or missing operation. Every row is explicitly marked approved or blocked.
