# Proposed Identity And Access-Control Baseline

## Status And Authority

This document is the Sprint 14 proposal for resolving [OPEN-03](./REQUIREMENTS.md), [OPEN-04](./REQUIREMENTS.md), and [OPEN-05](./REQUIREMENTS.md). It is **PROPOSED** and pending product-owner approval. Nothing in this document is `CONFIRMED`, and the current runtime remains unauthenticated and unauthorized.

The three proposals are separately reviewable:

| Authority record | Proposed resolution                                                                                                                                                                                               | Approval state                                                                 |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `OPEN-03`        | Adopt the human and service actor catalogue, role vocabulary, privilege boundaries, and facility-scoping model below.                                                                                             | OPEN DECISION; pending product-owner approval                                  |
| `OPEN-04`        | Use standards-based federated authentication for humans, workload identities for services, short-lived credentials, explicit revocation, and privacy-safe recovery.                                               | OPEN DECISION; pending product-owner and security approval                     |
| `OPEN-05`        | Enforce default-deny authorization from immutable server-derived context, with facility isolation, self-access boundaries, relationship checks, field-level restrictions, and privacy-preserving denial behavior. | OPEN DECISION; pending product-owner, clinical, privacy, and security approval |

Approval of one proposal does not automatically approve either of the others. Sprint 15 must not implement authentication or authorization until all three records have an explicit recorded outcome and any unresolved dependency that blocks an operation is addressed.

## Proposed Role Resolution For OPEN-03

### Human Actors And Roles

One person may hold multiple roles. Workforce roles are assigned independently for each facility unless a role is explicitly platform-wide. Role assignment is not inherited merely because a person appears in a practitioner, patient, or facility record.

| Role                  | Scope                                      | Proposed privileges                                                                                                                                                       | Explicit boundary                                                                                                                 |
| --------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `PLATFORM_ADMIN`      | Platform-wide                              | Create and deactivate facilities; manage global practitioner master records; perform non-clinical platform administration.                                                | No routine patient or appointment access. It is not a break-glass clinical role.                                                  |
| `FACILITY_ADMIN`      | One or more explicitly assigned facilities | Manage the assigned facility profile, facility roster and assignments, patient registration administration, and appointments for the assigned facility.                   | Cannot act for an unassigned facility or modify platform-wide identity policy.                                                    |
| `SCHEDULER`           | One or more explicitly assigned facilities | Register patients, read the minimum demographics needed for scheduling, and create, view, reschedule, or cancel appointments within the assigned facility.                | Cannot manage facilities, practitioner master records, role assignments, or global patient lifecycle.                             |
| `PRACTITIONER`        | Active practitioner assignments            | Read their own profile and assignments; view their appointments and patients connected through an in-scope appointment; perform only approved appointment-status changes. | Cannot browse unrelated patients, act after assignment deactivation, or reschedule unless separately authorized.                  |
| `PATIENT`             | One linked patient identity                | Read and update approved fields on their own patient record; view, create, and cancel their own appointments at registered facilities.                                    | Cannot select another patient identifier or gain facility scope from request input. Staff-assisted registration remains separate. |
| `OPERATIONS_OPERATOR` | Runtime operations                         | Observe liveness/readiness and operate approved runtime infrastructure outside the domain API.                                                                            | No facility, practitioner, patient, appointment, or reminder-content access through this role.                                    |

The proposed role catalogue does not establish employment, licensure, clinical responsibility, consent, or legal authority. Those questions remain outside Sprint 14.

### Service Actors

| Service actor        | Proposed access                                                                                             | Boundary                                                                                             |
| -------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `HEALTH_PROBE`       | Call public liveness and readiness endpoints.                                                               | Receives only the existing health payloads and no domain data.                                       |
| `REMINDER_WORKER`    | Use a dedicated workload and database identity for the existing reminder processing path.                   | No public HTTP-domain privileges; aggregate diagnostics only; no reminder content in logs.           |
| `MIGRATION_OPERATOR` | Run the existing migration and schema-verification commands with a separately controlled database identity. | Not an application user and not available to normal runtime requests.                                |
| `API_RUNTIME`        | Connect to PostgreSQL and execute only application operations required by the API.                          | Does not grant caller privileges; every human request still requires its own authorization decision. |

Shared service credentials, human use of service identities, and service use of human sessions are prohibited by the proposal.

### Privilege Model

The proposed model combines coarse role-based privileges with server-evaluated attributes:

- Role answers which operation category an actor may attempt.
- Facility membership or active practitioner assignment answers where the actor may operate.
- Patient self-link or an in-scope care/scheduling relationship answers whose patient data may be accessed.
- Request-field rules answer which fields the actor may change through a shared `PATCH` operation.
- Resource state answers whether inactive actors, assignments, facilities, or sessions must be denied.

Possession of a valid credential is never sufficient authorization. Every operation is denied unless an explicit matrix row permits the actor, scope, resource relationship, and requested fields.

### Immutable Server-Derived Authorization Context

After credential validation, Sprint 15 should construct one authorization context for the request and treat it as immutable:

| Context field     | Source                                                   | Rule                                                                        |
| ----------------- | -------------------------------------------------------- | --------------------------------------------------------------------------- |
| `actorId`         | Server-side actor mapping for the authenticated subject  | Never accepted from body, query, or route parameters.                       |
| `actorType`       | Server-side actor or workload record                     | Limited to approved human and service actor types.                          |
| `sessionId`       | Validated authentication session                         | Used only as an opaque security identifier and never logged raw.            |
| `roleAssignments` | Current server-side role assignments                     | Re-evaluated on each request or from a bounded, revocation-aware cache.     |
| `facilityScopes`  | Active facility memberships and practitioner assignments | Request-supplied facility IDs can narrow scope but never create it.         |
| `patientId`       | Approved server-side patient-to-account link             | A request-supplied patient ID must match this link for self-service access. |
| `serviceScopes`   | Approved workload registration                           | Human roles cannot be inferred from service scopes.                         |

Tokens may identify the subject and session, but token claims alone must not be authoritative for mutable roles, facility memberships, account activation, practitioner assignments, or patient links.

### Facility Isolation And Cross-Facility Access

- Facility-scoped roles operate only in facilities listed in the server-derived context.
- Collection queries must add mandatory scope predicates before pagination and counting; request filters cannot broaden them.
- Resource-by-ID operations must resolve scope in the same parameterized query used to retrieve the resource where practical.
- A practitioner may have multiple active assignments, but each patient or appointment decision must match an active assignment at the resource facility.
- A patient may access their own records across approved registrations, but the patient-to-account link must be server controlled.
- `PLATFORM_ADMIN` may cross facility boundaries only for non-patient platform administration described in the matrix.
- No routine human role receives unrestricted cross-facility patient access.
- Break-glass access is not proposed. It remains blocked until privacy, audit, legal, retention, and accountable-ownership decisions are approved.

### Patient-Data Boundaries

| Actor                 | Proposed patient-data boundary                                                                                                            |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `FACILITY_ADMIN`      | Minimum patient registration and appointment data for patients registered at an assigned facility.                                        |
| `SCHEDULER`           | Minimum demographics and appointment data required for registration and scheduling at an assigned facility.                               |
| `PRACTITIONER`        | Patient and appointment data only when an active assignment and appointment relationship connect the practitioner, patient, and facility. |
| `PATIENT`             | The server-linked patient record and that patient's registrations and appointments only.                                                  |
| `PLATFORM_ADMIN`      | No routine patient or appointment access.                                                                                                 |
| `OPERATIONS_OPERATOR` | No patient or appointment access.                                                                                                         |
| Service actors        | Only the minimum database records required for the service's existing task; no human browsing capability.                                 |

Staff updates to a patient shared across facilities remain constrained by [OPEN-08](./REQUIREMENTS.md). Until that policy is approved, the proposal denies a facility-scoped staff update when more than one active facility registration could make write ownership ambiguous. Global patient deactivation remains policy-blocked by `OPEN-07` and `OPEN-08`.

## Proposed Authentication Resolution For OPEN-04

### Human Authentication Mechanism

- Use OpenID Connect Authorization Code flow with PKCE through a standards-compliant identity provider.
- Hakimi does not store human passwords or implement password verification in the API.
- The API accepts only signed access tokens from an explicit issuer, audience, and algorithm allowlist.
- Reject missing signatures, `none`, unexpected algorithms, wrong issuer or audience, expired tokens, premature tokens, malformed subjects, and revoked or inactive sessions.
- Use a maximum access-token lifetime of 10 minutes.
- Rotate refresh tokens after every use and revoke the token family when replay is detected.
- Use a maximum interactive session lifetime of 8 hours and a 30-minute inactivity timeout for workforce roles.
- Require multi-factor authentication for `PLATFORM_ADMIN`, `FACILITY_ADMIN`, `SCHEDULER`, `PRACTITIONER`, and `OPERATIONS_OPERATOR` sessions.
- Patient MFA and account-recovery factors remain a product-owner and accessibility choice within `OPEN-04`; Sprint 15 must not invent them.

The identity-provider product and hosting model are not selected by this proposal. Selection must preserve the protocol and lifecycle requirements above without introducing provider-specific authorization logic into domain services.

### Service Authentication Mechanism

- Give every workload a unique non-human identity and least-privilege credential.
- Prefer short-lived workload credentials; where the local container baseline cannot issue them, use separately injected, rotatable secrets as an interim deployment constraint.
- Never place workload credentials in source control, image layers, logs, error responses, or human environment examples.
- Do not allow a service credential to call human domain operations unless an operation is explicitly added to the authorization matrix through a recorded decision.

### Lifecycle

| Lifecycle event | Proposed behavior                                                                                                                                                                                                             |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Activation      | An account remains denied until its subject mapping is active and at least one approved role or patient link is assigned.                                                                                                     |
| Deactivation    | Set the local actor inactive, revoke active sessions, and deny subsequent requests even if an unexpired token remains. Deactivating a practitioner or patient domain record does not automatically define account policy.     |
| Revocation      | Revoke the session and refresh-token family; privileged role removal and facility-membership removal take effect on the next authorization evaluation.                                                                        |
| Expiration      | Reject expired access tokens with the generic authentication error and require reauthentication when the session has expired.                                                                                                 |
| Recovery        | Delegate credential proof and factor reset to the identity provider; responses must not reveal whether an account exists. Privileged recovery requires a separately authorized administrative process and MFA reset controls. |
| Replay          | Reject reused refresh tokens, revoke the affected token family, and require reauthentication. Audit-event content and retention remain governed by `OPEN-06`.                                                                 |

## Proposed Authorization Resolution For OPEN-05

### Default Deny

- Only the two health operations are explicitly public.
- Every domain operation requires a validated human identity and an explicit matrix grant.
- Service actors have no public domain-operation grant in Sprint 14.
- Missing matrix rows, unknown roles, inactive actors, inactive role assignments, ambiguous scope, and unavailable authorization context are denied.
- Authorization is enforced before domain services perform state-changing work or return protected data.
- Field-level authorization is required where a shared `PATCH` operation serves roles with different privileges.

### Denial Behavior

| Condition                                                                                                                | Proposed HTTP behavior                                                                                  | Information boundary                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Missing, invalid, expired, or revoked authentication                                                                     | `401` with a stable generic authentication envelope and standards-compliant challenge where applicable. | Do not distinguish missing accounts, inactive accounts, revoked sessions, or token-validation details. |
| Authenticated actor lacks an operation or field privilege on an otherwise in-scope resource                              | `403` with a stable generic forbidden envelope.                                                         | Do not expose required roles or internal policy expressions.                                           |
| Resource identifier is absent or exists outside the actor's facility, patient, practitioner, or appointment relationship | Existing domain-specific `404` envelope.                                                                | Make absent and out-of-scope resources indistinguishable to prevent enumeration and IDOR.              |
| Collection contains no in-scope resources                                                                                | `200` with the existing empty paginated response.                                                       | Apply identical mandatory scope predicates to count and result queries.                                |
| Public health request                                                                                                    | Preserve existing `200` and readiness `503` behavior.                                                   | Never add authentication details or protected domain data.                                             |

Sprint 15 may add stable `401` and `403` codes only through an explicit API-contract update. Existing domain-specific not-found responses should remain stable for privacy-preserving `404` handling.

## Threat Model

| Threat                | Proposed mitigation                                                                                                                               | Remaining dependency                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| IDOR                  | Server-derived resource scope; scoped repository queries; privacy-preserving `404`; negative cross-facility tests.                                | Patient identity and shared-record ownership remain in `OPEN-08`. |
| Enumeration           | Generic authentication/recovery responses; identical absent/out-of-scope `404`; filtered collections; rate-limit design before public deployment. | Privacy policy remains in `OPEN-02`.                              |
| Replay                | Short-lived access tokens; one-time refresh-token rotation; token-family revocation on reuse; issuer time validation.                             | Audit-event requirements remain in `OPEN-06`.                     |
| Token theft           | TLS-only deployment; no token logging; short lifetimes; secure client storage; revocation; workforce MFA.                                         | Deployment target and secret ownership remain in `OPEN-12`.       |
| Credential leakage    | External credential verification; secret injection; no credentials in source, images, examples, logs, or errors; independent workload identities. | Applicable obligations remain in `OPEN-10`.                       |
| Privilege escalation  | Default deny; server-side roles; no client-controlled scope; field-level checks; explicit role-assignment privilege; negative tests.              | Role approval remains in `OPEN-03`.                               |
| Cross-facility access | Mandatory facility predicates; active membership checks; relationship-aware retrieval; no unrestricted patient superuser.                         | Multi-facility patient policy remains in `OPEN-08`.               |
| Inactive accounts     | Check local actor and relevant role/assignment state during every authorization evaluation; revoke sessions on deactivation.                      | Retention and deletion remain in `OPEN-07`.                       |

Rate limits, security-event persistence, alerting, evidence retention, and incident-response ownership are not defined here because they depend on unresolved audit, deployment, privacy, and legal policy.

## Unresolved Product-Owner Choices

The product owner must separately approve, reject, or revise:

- `OPEN-03`: the six human roles, whether one person may hold multiple facility roles, and who can assign or remove roles;
- `OPEN-04`: federated OIDC, the token and session durations, workforce MFA, patient MFA and recovery factors, and the identity-provider selection criteria;
- `OPEN-05`: public-versus-authenticated directory access, staff patient-data boundaries, practitioner relationship rules, patient self-service operations, field-level privileges, and denial behavior;
- `OPEN-08`: patient account linking, multi-facility write ownership, duplicate handling, and identity merge policy;
- `OPEN-09`: appointment transition and cancellation rules that constrain role permissions;
- `OPEN-11`: reminder channel identity and delivery policy;
- `OPEN-12`: identity-provider hosting, secret ownership, runtime ownership, and operational accountability.

The following records remain explicitly unresolved and are not inferred by this proposal:

- [OPEN-01](./REQUIREMENTS.md): broader healthcare and business workflow rules;
- [OPEN-02](./REQUIREMENTS.md): privacy, consent, notice, and purpose limitation;
- [OPEN-06](./REQUIREMENTS.md): security and clinical audit events, review, and retention;
- [OPEN-07](./REQUIREMENTS.md): retention, hard deletion, and global patient deactivation;
- [OPEN-10](./REQUIREMENTS.md): applicable jurisdictions, healthcare regulation, and data-protection law.

## Sprint 15 Implementation Constraints

If the three Sprint 14 proposals are approved, Sprint 15 must:

- preserve the current health payloads, domain success payloads, request IDs, and privacy-safe logging boundary;
- update OpenAPI before or with any new `401` and `403` runtime responses;
- introduce one centralized authentication boundary before protected routes and centralized authorization helpers before domain service execution;
- keep resource-scope enforcement in parameterized repository queries rather than filtering protected rows in memory;
- construct immutable authorization context only from validated credentials and current server-side state;
- reject client attempts to supply actor, role, facility-membership, or patient-link authority;
- enforce field-level privileges for shared update operations;
- use dedicated service identities and never reuse human credentials;
- add route, service, and PostgreSQL integration tests for every permitted and denied role/scope path;
- include concurrency and revocation tests where stale authorization state could grant access;
- preserve sanitized errors and exclude credentials, claims, tokens, role assignments, patient identifiers, and policy internals from logs;
- avoid changing patient identity, appointment, reminder, retention, privacy, legal, or audit policy as a side effect of implementation.

## Explicit Exclusions

- No runtime authentication or authorization implementation in Sprint 14.
- No user, credential, session, role, membership, or audit database schema.
- No identity-provider vendor selection or hosted-service configuration.
- No login, registration, recovery, consent, or role-administration UI.
- No break-glass workflow.
- No clinical audit log or retention schedule.
- No inferred legal, regulatory, privacy, or consent policy.
- No modification to reminder timing, content, channels, retries, or delivery adapter.
- No deployment, Docker, Compose, CI, migration, OpenAPI, dependency, or API behavior change.

## Operation-Level Coverage

The proposed authorization treatment for every current public operation is recorded once in the [Sprint 14 authorization matrix](./TRACEABILITY.md). The independently derived baseline contains 26 OpenAPI operations and the same 26 Express operations, with no contract-only, implementation-only, duplicate, or missing operation.
