# OPEN-06 Security And Clinical Audit Evidence

> **PROPOSED FOR QUALIFIED REVIEW**
>
> **SYNTHETIC DATA ONLY**
>
> **NOT APPROVED FOR PRODUCTION**
>
> Production deployment: `NOT AUTHORIZED`
>
> Real patient-data processing: `NOT AUTHORIZED`

## 1. Status Banner

| Field                               | Value                                                                                                                                                                                                                                                                                                     |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Purpose                             | Repository-reconciled evidence package for `OPEN-06` security audit events, clinical audit events, integrity, review, privacy minimization, operational ownership, and dependencies                                                                                                                       |
| Decision effect                     | Records the product-owner `REVISE` outcome only; this document does not approve an audit policy, does not create an audit runtime, and does not close `OPEN-06`                                                                                                                                           |
| Canonical decision type             | `OPEN DECISION`                                                                                                                                                                                                                                                                                           |
| Implementation/governance selection | `PENDING`                                                                                                                                                                                                                                                                                                 |
| Recorded product-owner outcome      | `REVISE`, recorded by Habte Selasie, Repository Owner and Product Decision Authority, on 2026-09-01 in [GitHub issue #41](https://github.com/wku572/hakimi-healthcare-platform/issues/41#issuecomment-5494209792)                                                                                         |
| Audit runtime                       | `NOT IMPLEMENTED / NOT DETERMINED`                                                                                                                                                                                                                                                                        |
| Durable audit store                 | `NOT IMPLEMENTED / NOT DETERMINED`                                                                                                                                                                                                                                                                        |
| Provider, region, owner, duration   | `NOT SELECTED` / `NOT DETERMINED`                                                                                                                                                                                                                                                                         |
| Production gates                    | `BLOCKED`                                                                                                                                                                                                                                                                                                 |
| Review issue                        | [GitHub issue #41](https://github.com/wku572/hakimi-healthcare-platform/issues/41) remains open for Sprint 16 product-owner review                                                                                                                                                                        |
| Governing records                   | [OPEN-06](./REQUIREMENTS.md), [Open Decisions](./OPEN_DECISIONS.md), [Sprint 16 governance](./PRODUCTION_READINESS_GOVERNANCE.md), [OPEN-02 privacy evidence](./OPEN02_PRIVACY_PURPOSE_AND_CONSENT_EVIDENCE.md), and [OPEN-07 retention evidence](./OPEN07_RETENTION_DELETION_AND_LEGAL_HOLD_EVIDENCE.md) |

This document is discovery and governance evidence only. It is not legal advice,
clinical-safety approval, security approval, audit-store design approval,
production authorization, or authorization to process real patient data.
The `REVISE` outcome is a product-owner governance-review outcome only. It does
not approve current diagnostics as durable audit evidence and does not select an
audit store, integrity mechanism, trusted timestamping, retention period,
provider, destination, reviewer, production owner, production deployment, or real
patient-data processing.

## 2. Scope And Authority Boundary

- `CURRENT REPOSITORY FACT`: runtime structured diagnostics, request correlation,
  privacy-safe error envelopes, OIDC verification, workforce authorization,
  provisioning, revocation, health checks, migrations, schema verification, and
  reminder-worker summaries exist for synthetic-data development and testing.
- `PROPOSED AUDIT CONTROL`: approved security and clinical audit events should be
  separately specified before production or real patient-data processing.
- `REQUIRED EXTERNAL EVIDENCE`: information security, clinical safety, privacy,
  legal/regulatory, records-management, platform/operations, patient
  identity/administration, and product decision authority must review the bounded
  audit model.
- `NOT IMPLEMENTED / NOT DETERMINED`: no durable audit store, append-only storage,
  integrity verification, signing, trusted timestamps, review workflow, alerting,
  export workflow, legal admissibility finding, audit retention period, legal-hold
  behavior, production recipient, named owner, SIEM, monitoring provider, or audit
  database exists.

## 3. Evidence-Label Definitions

| Label                              | Meaning in this evidence package                                                                                                     |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `CURRENT REPOSITORY FACT`          | Implemented behavior, schema, contract, route, documentation, or test evidence in this repository                                    |
| `PROPOSED AUDIT CONTROL`           | Candidate security or clinical audit policy requiring stakeholder approval                                                           |
| `REQUIRED EXTERNAL EVIDENCE`       | Evidence required from qualified reviewers, accountable owners, facilities, vendors, contracts, or product authority                 |
| `NOT IMPLEMENTED / NOT DETERMINED` | Audit component, policy choice, reviewer, owner, destination, duration, legal conclusion, or production fact is absent or unresolved |
| `NOT SELECTED`                     | A provider, region, destination, owner, technology, jurisdiction, or recipient has not been chosen                                   |
| `ABSENT/PROHIBITED`                | Verified absent from the implemented repository or explicitly prohibited by current governance                                       |

## 4. Current Diagnostic And Observability Facts

`CURRENT REPOSITORY FACT`: the repository has vendor-neutral structured JSON
diagnostics emitted to stdout/stderr, not an approved audit trail.

| Area                 | Exact repository source and symbol                                                                                                                               | Current behavior                                                                                                                                                                                                                                                                       |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Structured logger    | `apps/api/src/observability/logger.ts :: createStructuredLogger`                                                                                                 | Emits JSON with `timestamp`, `severity`, `service`, `eventCode`, and a closed safe-field allowlist                                                                                                                                                                                     |
| Event-code catalogue | `apps/api/src/observability/logger.ts :: OBSERVABILITY_EVENT_CODES`                                                                                              | Defines 24 stable diagnostic event codes                                                                                                                                                                                                                                               |
| Safe fields          | `apps/api/src/observability/logger.ts :: SafeLogFields`, `SAFE_FIELD_NAMES`                                                                                      | Allows only 17 optional fields: `requestId`, `method`, `route`, `statusCode`, `durationMs`, `errorCode`, `port`, `signal`, `failureStage`, `claimedCount`, `deliveredCount`, `cancelledCount`, `supersededCount`, `retriedCount`, `deadLetteredCount`, `skippedCount`, `affectedCount` |
| Request correlation  | `apps/api/src/http/request-observability.ts :: createRequestObservabilityMiddleware`                                                                             | Validates/generates opaque request IDs, sets `X-Request-ID`, logs normalized route templates, completion, and aborts                                                                                                                                                                   |
| Route normalization  | `apps/api/src/http/request-observability.ts :: normalizeRouteTemplate`                                                                                           | Maps 26 documented HTTP operations to templates and hides unmatched paths as `UNMATCHED`                                                                                                                                                                                               |
| Error boundary       | `apps/api/src/http/error-middleware.ts :: createApiErrorHandler`                                                                                                 | Logs stable opaque error codes only and returns sanitized API error envelopes                                                                                                                                                                                                          |
| Health/readiness     | `apps/api/src/app.ts :: createApp`; `apps/api/src/database.ts :: createDatabaseReadinessCheck`                                                                   | Preserves health contracts and logs readiness/database connectivity outcomes without database details                                                                                                                                                                                  |
| API lifecycle        | `apps/api/src/server.ts`; `apps/api/src/observability/api-lifecycle.ts`                                                                                          | Logs startup, startup failure, shutdown start/completion/failure, and pool errors with opaque fields                                                                                                                                                                                   |
| Reminder worker      | `apps/api/src/reminders/worker.ts :: processReminderCycle`, `runReminderWorker`; `apps/api/src/reminders/adapter.ts :: createDevelopmentReminderDeliveryAdapter` | Emits worker lifecycle and aggregate cycle counts only; delivery adapter is a development no-op                                                                                                                                                                                        |
| Environment parsing  | `apps/api/src/env.ts :: loadAccessEnvironment`; `apps/api/src/reminders/config.ts :: loadReminderWorkerConfig`                                                   | Strictly parses runtime/OIDC/logging/worker configuration names without logging secret values                                                                                                                                                                                          |

## 5. Diagnostic-Versus-Audit Distinction

Current diagnostics:

- are `CURRENT REPOSITORY FACT`;
- are privacy-minimized operational events;
- are not persisted by a repository-defined audit table;
- do not capture request bodies, query values, headers, cookies, bearer tokens,
  OIDC claims, secrets, raw SQL, stack traces, patient payloads, reminder content,
  or contact destinations;
- do not prove live production traffic or real patient-data processing.

Current diagnostics are not:

- an approved audit trail;
- durable audit evidence;
- complete clinical history;
- tamper-proof, append-only, or immutable storage;
- legally sufficient evidence;
- production monitoring;
- a substitute for `OPEN-06`, `OPEN-07`, `OPEN-10`, or `OPEN-12`.

## 6. Proposed Audit-Event Taxonomy

| Event family                                  | Proposed audit scope                                                                                          | Current diagnostic support                                                                                        | Evidence status                                                             |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Authentication and session events             | Token verification result, session creation, inactivity, expiry, revocation, and reauthentication boundary    | `AUTHENTICATION_REJECTED`; workforce session table                                                                | `PROPOSED AUDIT CONTROL`; store/integrity/review `NOT DETERMINED`           |
| Authorization allow/deny decisions            | Operation, actor, role, facility scope, target, outcome, reason category, and privacy-preserving denial       | `AUTHORIZATION_DENIED`; access repository/service checks                                                          | `PROPOSED AUDIT CONTROL`; allow-event persistence `NOT IMPLEMENTED`         |
| Workforce provisioning and role changes       | Actor, role, facility scope, activation, deactivation, revocation recovery, and authority epoch               | `ACCESS_PROVISIONING_COMPLETED`, `ACCESS_PROVISIONING_FAILED`, `ACCESS_REVOCATION_FAILED`; Migration `006` tables | `PROPOSED AUDIT CONTROL`; evidence chain `NOT DETERMINED`                   |
| Facility and practitioner lifecycle changes   | Create, update, deactivate, roster assignment, primary reassignment, and conflict outcomes                    | Domain tables and route/service tests                                                                             | `PROPOSED AUDIT CONTROL`; clinical/security classification `NOT DETERMINED` |
| Patient and registration access/change events | Registration, MRN, patient read/search/update/deactivation attempt, facility scope, and patient-data boundary | Patient route/service/access tests; policy-blocked patient deactivation                                           | `PROPOSED AUDIT CONTROL`; privacy/legal basis `NOT DETERMINED`              |
| Appointment lifecycle events                  | Schedule, reschedule, status transition, cancellation, no-show/completion, overlap conflict                   | Appointment routes/services/integration tests                                                                     | `PROPOSED AUDIT CONTROL`; clinical significance `NOT DETERMINED`            |
| Reminder lifecycle events                     | Reminder creation, claim, delivery, retry, cancellation, supersession, dead-letter, worker cycle              | Reminder table and aggregate worker logs                                                                          | `PROPOSED AUDIT CONTROL`; transport policy `NOT DETERMINED`                 |
| Administrative and operational events         | Runtime start, shutdown, pool error, readiness failure, configuration validation, privileged operations       | API lifecycle and database tests                                                                                  | `PROPOSED AUDIT CONTROL`; owner/destination `NOT SELECTED`                  |
| Migration and schema-verification events      | Migration applied/rolled back/status, checksum, schema verification result                                    | Migration runner, `schema_migrations`, schema verifier, migration tests                                           | `PROPOSED AUDIT CONTROL`; deployment evidence policy `NOT DETERMINED`       |
| Readiness and failure events                  | Health/readiness result, connectivity outcome, unexpected error boundary, aborted request                     | Existing diagnostic event codes                                                                                   | `PROPOSED AUDIT CONTROL`; alerting/escalation `NOT SELECTED`                |

## 7. Security Audit-Event Proposal

`PROPOSED AUDIT CONTROL`: security audit events should cover workforce
authentication, authorization, provisioning, session state, revocation, denied
access, privileged configuration, database connectivity, migration activity,
unexpected failures, and audit-store administration if an audit store is later
implemented.

Security audit events should be minimum-necessary. They should record stable actor,
operation, resource, facility, outcome, reason-category, correlation, and timestamp
data only when approved. Raw bearer tokens, OIDC claims, credentials, secrets, SQL
text, stack traces, patient payloads, contact details, and free-text clinical content
remain prohibited unless a separate qualified review explicitly permits a specific
bounded field.

## 8. Clinical Audit-Event Proposal

`PROPOSED AUDIT CONTROL`: clinical audit events should focus on patient-affecting
access and lifecycle decisions, including patient registration, patient read/search,
patient update, patient deactivation attempt, appointment creation/update/cancel,
appointment terminal states, reminder lifecycle, and clinical-safety exceptions.

Clinical audit does not exist as a complete clinical history in the repository.
Clinical audit scope, event meaning, clinical reviewer, patient-safety retention,
correction workflow, and legal sufficiency remain `NOT IMPLEMENTED / NOT
DETERMINED`.

## 9. Field Model

| Field group | Proposed content                                                                                       | Current source                                                   | Status                                                               |
| ----------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- | -------------------------------------------------------------------- |
| Actor       | Workforce actor ID, role, service actor class, or health probe class                                   | `workforce_actors`, `workforce_role_assignments`, access context | `PROPOSED AUDIT CONTROL`; patient actors absent                      |
| Subject     | Patient, practitioner, workforce actor, facility, appointment, reminder, or system component reference | Domain tables and route targets                                  | `PROPOSED AUDIT CONTROL`; subject identifiers require privacy review |
| Resource    | Route template, domain table/category, record reference, or lifecycle object                           | Express routes, OpenAPI, repositories                            | `PROPOSED AUDIT CONTROL`                                             |
| Action      | Create, read, search, update, deactivate, cancel, deliver, retry, revoke, verify, migrate, start, stop | Routes, services, worker, migration runner                       | `PROPOSED AUDIT CONTROL`                                             |
| Outcome     | Success, denial, validation failure, conflict, not found, cancellation, dead-letter, rollback, skipped | Error contracts, services, worker                                | `PROPOSED AUDIT CONTROL`                                             |
| Reason      | Stable reason category, not raw free text or database detail                                           | ApiError codes, reminder error categories, revocation reasons    | `PROPOSED AUDIT CONTROL`; reason taxonomy incomplete                 |
| Facility    | Facility scope or target facility where required for review                                            | Access scope and domain relationships                            | `PROPOSED AUDIT CONTROL`; cross-facility rules depend on `OPEN-08`   |
| Correlation | Opaque request ID, session/audit correlation reference, migration run reference                        | Request observability; migration catalogue                       | `PROPOSED AUDIT CONTROL`; audit correlation design absent            |
| Timestamp   | Event time, transaction time, trusted time, clock-source evidence                                      | Runtime `timestamp`; database timestamps                         | `NOT IMPLEMENTED / NOT DETERMINED` for trusted audit time            |

## 10. Privacy And Minimum-Necessary Logging Boundary

`CURRENT REPOSITORY FACT`: existing diagnostics use a closed allowlist and sanitize
errors. `PROPOSED AUDIT CONTROL`: any future audit model must preserve or tighten
that boundary.

Prohibited unless separately approved by qualified review:

- credentials, passwords, bearer tokens, refresh tokens, private keys, secrets, and
  raw OIDC claims;
- complete patient payloads, patient contact details, MRNs in logs, reminder content,
  appointment cancellation free text, and unnecessary identifiers;
- request bodies, query values, headers, cookies, SQL text, stack traces, raw
  database errors, constraint values, and provider-specific internals;
- broad free text when a stable reason code can satisfy review needs.

Identifiers required for review must be distinguished from unnecessary patient data.
If identifiers are approved, the policy must define scope, masking, hashing,
authorization, retention, legal hold, access review, export, and deletion behavior.

## 11. Authorization-Decision Evidence Boundary

`CURRENT REPOSITORY FACT`: authorization is default deny, server-derived, and scoped
through workforce roles, facility scopes, practitioner relationships, field
allowlists, active-state checks, session state, inactivity, absolute expiry, and
target-specific final authorization. Protected resource denials use
privacy-preserving `401`, `403`, or domain-specific `404` behavior.

`PROPOSED AUDIT CONTROL`: audit events should distinguish authentication failure,
coarse role denial, field denial, target-scope denial, hidden resource, policy-blocked
operation, session inactive/expired/revoked, and post-authorization revocation
recovery without revealing sensitive identifiers or out-of-scope resource existence.

## 12. Clinical-State-Transition Evidence Boundary

`CURRENT REPOSITORY FACT`: lifecycle changes are persisted through domain fields:
facility/practitioner/assignment/patient `is_active`, appointment status and
cancellation fields, reminder status/retry/lease/terminal timestamps, and workforce
activation/revocation/session timestamps.

`PROPOSED AUDIT CONTROL`: clinical and patient-affecting transitions should have
approved event families, allowed field names, actor/scope requirements, correction
rules, and retention/hold behavior before production.

## 13. Integrity And Tamper-Evidence Questions

`NOT IMPLEMENTED / NOT DETERMINED`:

- append-only audit storage;
- immutable or tamper-resistant storage;
- event signing or hashing;
- trusted timestamping;
- write-once media;
- integrity verification cadence;
- audit administrator segregation;
- correction/supersession model;
- chain-of-custody evidence;
- failed audit-write behavior.

No current repository component should be described as immutable or tamper-proof
audit storage.

## 14. Time, Ordering, Correlation, And Clock-Evidence Questions

| Question              | Current fact                                                                             | Required evidence                                                 |
| --------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Event time source     | Runtime diagnostics use `new Date().toISOString()`; PostgreSQL rows use timestamp fields | Trusted clock source and drift tolerance `NOT DETERMINED`         |
| Transaction ordering  | Domain transactions and database constraints exist for selected writes                   | Audit atomicity and order guarantees `NOT DETERMINED`             |
| Request correlation   | `X-Request-ID` is opaque and validated/generated                                         | Audit correlation key design `NOT DETERMINED`                     |
| Session correlation   | Workforce sessions are persisted locally with hashed OIDC session linkage                | Audit use of session identifiers requires privacy/security review |
| Worker correlation    | Reminder worker emits aggregate counts only                                              | Per-reminder audit correlation requires approval                  |
| Migration correlation | `schema_migrations` records version/name/checksum/applied time                           | Deployment audit correlation and retention `NOT DETERMINED`       |

## 15. Audit-Store And Recipient Questions

| Topic                                              | Status                             |
| -------------------------------------------------- | ---------------------------------- |
| Audit database/schema                              | `NOT IMPLEMENTED / NOT DETERMINED` |
| Append-only or immutable destination               | `NOT SELECTED`                     |
| SIEM or monitoring provider                        | `NOT SELECTED`                     |
| Hosting provider, region, support location         | `NOT SELECTED`                     |
| Audit export destination                           | `NOT SELECTED`                     |
| Recipient/subprocessor                             | `NOT SELECTED`                     |
| Access model                                       | `NOT DETERMINED`                   |
| Durability, backup, restore, and deletion behavior | `NOT DETERMINED`                   |
| Production ownership                               | `NOT SELECTED`                     |

## 16. Audit Access, Review, Alerting, Escalation, And Segregation Of Duties

`REQUIRED EXTERNAL EVIDENCE`:

- who may view security audit events;
- who may view clinical audit events;
- who reviews access to patient-affecting records;
- who investigates denied access, suspicious activity, reminder failures, and
  provisioning changes;
- what alerts exist and who receives them;
- how segregation of duties separates audit administration from audited actions;
- how emergency access, break-glass use, and incident response are evidenced;
- how audit access itself is audited.

No named owner, reviewer, alert destination, on-call path, or escalation workflow is
selected.

## 17. Audit Export, Disclosure, Investigation, And Evidence Chain

`PROPOSED AUDIT CONTROL`: any audit export or disclosure should require a documented
purpose, requester authority, bounded scope, approval, minimization, delivery method,
recipient, retention, and evidence chain.

`NOT IMPLEMENTED / NOT DETERMINED`: export API, disclosure workflow, investigation
case model, legal hold, evidence chain, redaction workflow, and recipient controls.

## 18. Retention, Deletion, Backup, Restoration, And Legal-Hold Dependencies

Audit retention and disposal depend on [OPEN-07 retention evidence](./OPEN07_RETENTION_DELETION_AND_LEGAL_HOLD_EVIDENCE.md).
This document selects no duration, archival tier, backup period, deletion deadline,
disposition method, legal-hold rule, or destruction evidence.

`PROPOSED AUDIT CONTROL`: audit events may need different schedules for security,
clinical, operational, and legal purposes, but that cannot be selected inside
`OPEN-06` alone.

## 19. Legal And Regulatory Dependency

Audit legal applicability, evidentiary sufficiency, patient-rights interaction,
breach/incident requirements, healthcare obligations, retention duties, transfer
rules, and regulator expectations depend on `OPEN-10`.

This document makes no legal applicability conclusion and does not identify a
jurisdiction, regulator, obligation, operating entity, controller, processor,
healthcare provider, or qualified reviewer.

## 20. Privacy And Purpose Dependency

Audit processing purposes, lawful grounds, notice, consent/non-consent treatment,
minimum-necessary fields, rights requests, complaint evidence, exceptions, and
support access depend on `OPEN-02`.

This document does not approve privacy policy or lawful purpose.

## 21. Patient-Identity Dependency

Audit references to patient identity, facility MRNs, duplicate candidates, aliases,
merge, unmerge, survivorship, representative authority, cross-facility ownership, and
uncertain demographics depend on `OPEN-08`.

Audit events must not create an uncontrolled parallel patient-identity system.

## 22. Deployment And Operational-Ownership Dependency

Audit destination, provider, region, production owner, backup owner, monitoring owner,
incident owner, on-call path, restore authority, access review, support location, and
shared-responsibility model depend on `OPEN-12`.

This document does not select production monitoring, SIEM, cloud, region, vendor,
owner, or operational model.

## 23. Event-To-Operation Reconciliation

All 26 documented HTTP operations appear exactly once.

| Method | Route                                                          | Operation ID                     | Current diagnostic behavior                                               | Proposed security audit requirement               | Proposed clinical audit requirement                      | Privacy/minimization concern                                       | Governing dependency                                 | Evidence status                     |
| ------ | -------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------- | ----------------------------------- |
| GET    | /health/live                                                   | getHealthLive                    | Request completion/abort may log route, status, duration, request ID      | Availability probe evidence if approved           | None                                                     | Do not log caller headers or source details                        | OPEN-06, OPEN-07, OPEN-12                            | CURRENT diagnostics; audit proposed |
| GET    | /health/ready                                                  | getHealthReady                   | Readiness and PostgreSQL connectivity outcomes may log opaque event codes | Readiness/failure evidence if approved            | None                                                     | Do not expose database internals                                   | OPEN-06, OPEN-07, OPEN-12                            | CURRENT diagnostics; audit proposed |
| POST   | /api/v1/facilities                                             | createHealthcareFacility         | Protected request logs route/status; auth failures log opaque codes       | Administrative creation event                     | None                                                     | Avoid request body and raw facility values                         | OPEN-06, OPEN-07, OPEN-12                            | Audit proposed                      |
| GET    | /api/v1/facilities                                             | listHealthcareFacilities         | Protected request logs route/status; collection filters are not logged    | Scoped administrative read/search event           | None                                                     | Do not log query values or result content                          | OPEN-06, OPEN-07, OPEN-12                            | Audit proposed                      |
| GET    | /api/v1/facilities/:id                                         | getHealthcareFacilityById        | Protected request logs normalized route, not concrete ID                  | Scoped administrative read event                  | None                                                     | Conceal out-of-scope resource existence                            | OPEN-06, OPEN-07, OPEN-12                            | Audit proposed                      |
| PATCH  | /api/v1/facilities/:id                                         | updateHealthcareFacility         | Protected request logs route/status and sanitized error code              | Administrative update and authority-impact event  | None                                                     | Log field names only if approved                                   | OPEN-06, OPEN-07, OPEN-12                            | Audit proposed                      |
| DELETE | /api/v1/facilities/:id                                         | deactivateHealthcareFacility     | Protected request logs route/status; deactivation revokes affected access | Facility lifecycle and authority-impact event     | Possible care-continuity context if linked records exist | Do not treat deactivation as erasure                               | OPEN-06, OPEN-07, OPEN-08, OPEN-12                   | Audit proposed                      |
| POST   | /api/v1/practitioners                                          | createPractitioner               | Protected request logs route/status                                       | Workforce/practitioner creation event             | None unless clinical governance requires                 | Avoid contact/license values unless approved                       | OPEN-02, OPEN-06, OPEN-07, OPEN-12                   | Audit proposed                      |
| GET    | /api/v1/practitioners                                          | listPractitioners                | Protected request logs route/status, not filters/results                  | Workforce-directory read/search event             | None unless clinical governance requires                 | Avoid query values and returned content                            | OPEN-02, OPEN-06, OPEN-07, OPEN-12                   | Audit proposed                      |
| GET    | /api/v1/practitioners/:practitionerId                          | getPractitionerById              | Protected request logs normalized route                                   | Workforce/practitioner read event                 | None unless clinical governance requires                 | Avoid concrete practitioner ID in diagnostics                      | OPEN-02, OPEN-06, OPEN-07, OPEN-12                   | Audit proposed                      |
| PATCH  | /api/v1/practitioners/:practitionerId                          | updatePractitioner               | Protected request logs route/status                                       | Workforce/practitioner update event               | None unless clinical governance requires                 | Field-level evidence requires approval                             | OPEN-02, OPEN-06, OPEN-07, OPEN-12                   | Audit proposed                      |
| DELETE | /api/v1/practitioners/:practitionerId                          | deactivatePractitioner           | Protected request logs route/status; revocation may occur                 | Practitioner lifecycle and authority-impact event | Possible appointment-history relevance                   | Preserve privacy while evidencing access impact                    | OPEN-06, OPEN-07, OPEN-12                            | Audit proposed                      |
| POST   | /api/v1/practitioners/:practitionerId/facilities               | createPractitionerAssignment     | Protected request logs normalized assignment route                        | Roster and authority-scope creation event         | Possible care-team context                               | Avoid raw role/free-text values unless approved                    | OPEN-06, OPEN-07, OPEN-12                            | Audit proposed                      |
| GET    | /api/v1/practitioners/:practitionerId/facilities               | listPractitionerAssignments      | Protected request logs route/status                                       | Scoped roster read event                          | None unless clinical governance requires                 | Avoid returned roster content                                      | OPEN-06, OPEN-07, OPEN-12                            | Audit proposed                      |
| PATCH  | /api/v1/practitioners/:practitionerId/facilities/:assignmentId | updatePractitionerAssignment     | Protected request logs normalized route; revocation may occur             | Roster/authority update event                     | Possible care-team context                               | Field names only if approved                                       | OPEN-06, OPEN-07, OPEN-12                            | Audit proposed                      |
| DELETE | /api/v1/practitioners/:practitionerId/facilities/:assignmentId | deactivatePractitionerAssignment | Protected request logs route/status; revocation may occur                 | Roster lifecycle and authority-impact event       | Possible care-team context                               | Do not expose concrete assignment IDs                              | OPEN-06, OPEN-07, OPEN-12                            | Audit proposed                      |
| POST   | /api/v1/patients                                               | createPatient                    | Protected request logs route/status; patient body is not logged           | Patient registration creation event               | Patient creation/registration event                      | Patient identity/contact/MRN fields require strict minimization    | OPEN-02, OPEN-06, OPEN-07, OPEN-08, OPEN-10, OPEN-12 | Audit proposed                      |
| GET    | /api/v1/patients                                               | listPatients                     | Protected request logs route/status, not filters/results                  | Patient search/access event                       | Patient record access/search event                       | Avoid query values and result content                              | OPEN-02, OPEN-06, OPEN-07, OPEN-08, OPEN-10, OPEN-12 | Audit proposed                      |
| GET    | /api/v1/patients/:patientId                                    | getPatientById                   | Protected request logs normalized route and privacy-preserving denial     | Patient record access event                       | Patient record access event                              | Avoid concrete IDs in diagnostics; audit identifiers need approval | OPEN-02, OPEN-06, OPEN-07, OPEN-08, OPEN-10, OPEN-12 | Audit proposed                      |
| PATCH  | /api/v1/patients/:patientId                                    | updatePatient                    | Protected request logs route/status                                       | Patient demographic/contact update event          | Patient record correction/change event                   | Field names/provenance only if approved                            | OPEN-02, OPEN-06, OPEN-07, OPEN-08, OPEN-10, OPEN-12 | Audit proposed                      |
| DELETE | /api/v1/patients/:patientId                                    | deactivatePatient                | Policy-blocked operation logs protected request/denial path               | Blocked-operation attempt and denial event        | Blocked global patient-deactivation attempt              | Do not expose patient existence across scope                       | OPEN-02, OPEN-06, OPEN-07, OPEN-08, OPEN-10, OPEN-12 | Audit proposed; operation blocked   |
| POST   | /api/v1/appointments                                           | createAppointment                | Protected request logs route/status                                       | Appointment creation authorization event          | Appointment scheduling event                             | Avoid patient/practitioner IDs and schedule values unless approved | OPEN-02, OPEN-06, OPEN-07, OPEN-08, OPEN-10, OPEN-12 | Audit proposed                      |
| GET    | /api/v1/appointments                                           | listAppointments                 | Protected request logs route/status, not filters/results                  | Appointment search/access event                   | Appointment record access/search event                   | Avoid filter values and result content                             | OPEN-02, OPEN-06, OPEN-07, OPEN-08, OPEN-10, OPEN-12 | Audit proposed                      |
| GET    | /api/v1/appointments/:appointmentId                            | getAppointmentById               | Protected request logs normalized route                                   | Appointment access event                          | Appointment access event                                 | Avoid concrete appointment and patient identifiers                 | OPEN-02, OPEN-06, OPEN-07, OPEN-08, OPEN-10, OPEN-12 | Audit proposed                      |
| PATCH  | /api/v1/appointments/:appointmentId                            | updateAppointment                | Protected request logs route/status; reminder state may change            | Appointment update authorization event            | Appointment reschedule/status-change event               | Avoid schedule values/cancellation content unless approved         | OPEN-02, OPEN-06, OPEN-07, OPEN-08, OPEN-10, OPEN-12 | Audit proposed                      |
| POST   | /api/v1/appointments/:appointmentId/cancel                     | cancelAppointment                | Protected request logs route/status                                       | Appointment cancellation authorization event      | Appointment cancellation event                           | Do not log cancellation free text unless approved                  | OPEN-02, OPEN-06, OPEN-07, OPEN-08, OPEN-10, OPEN-12 | Audit proposed                      |

## 24. Event-To-Lifecycle Reconciliation

| Lifecycle group                   | Current repository behavior                                                                                      | Proposed audit evidence                                                      | Dependencies                                |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------- |
| Facility lifecycle                | Create, update, soft/idempotent deactivate; `ON DELETE RESTRICT` references preserve relationships               | Administrative and authority-impact events                                   | OPEN-06, OPEN-07, OPEN-12                   |
| Practitioner lifecycle            | Create, update, soft/idempotent deactivate; appointments and workforce actor bindings restrict deletion          | Workforce and authority-impact events                                        | OPEN-02, OPEN-06, OPEN-07, OPEN-12          |
| Practitioner assignment lifecycle | Create, update, primary reassignment, deactivate; active primary uniqueness                                      | Roster, care-team, and authority-scope events                                | OPEN-06, OPEN-07, OPEN-12                   |
| Patient/registration lifecycle    | Create, update, route/service deactivation behavior; workforce global deactivation blocked; facility MRNs scoped | Patient identity, registration, access, change, and blocked-operation events | OPEN-02, OPEN-06, OPEN-07, OPEN-08, OPEN-10 |
| Appointment lifecycle             | Create, reschedule, cancel, complete/no-show status; overlap protection                                          | Scheduling, status, cancellation, and conflict events                        | OPEN-02, OPEN-06, OPEN-07, OPEN-08, OPEN-10 |
| Reminder lifecycle                | Create, claim, deliver, retry, cancel, supersede, dead-letter; worker emits aggregate counts                     | Reminder lifecycle and worker operational events                             | OPEN-06, OPEN-07, OPEN-10, OPEN-12          |
| Workforce access lifecycle        | Actor/role/session activation, deactivation, revocation, expiry, target authorization, recovery                  | Security authentication, authorization, provisioning, and revocation events  | OPEN-06, OPEN-07, OPEN-10, OPEN-12          |
| Migration/schema lifecycle        | Six migration pairs, catalogue checksums, schema verification                                                    | Deployment and schema-change evidence                                        | OPEN-06, OPEN-07, OPEN-10, OPEN-12          |
| Runtime lifecycle                 | API startup/shutdown, database readiness, pool errors, worker start/stop                                         | Operational/security event evidence                                          | OPEN-06, OPEN-07, OPEN-12                   |

## 25. Failure And Exception Cases

An approved audit policy should define behavior for:

- audit write failure after domain transaction;
- audit write failure before domain transaction;
- partial audit record, duplicate audit record, or retry after conflict;
- security event during database outage;
- unauthorized or out-of-scope request that must preserve target concealment;
- patient-rights request involving audit records;
- legal hold on audit records;
- audit export for investigation or qualified review;
- backup restore that reintroduces audit or diagnostic records;
- clock drift, replay, stale sessions, and concurrent authorization reduction;
- compromised account, token theft, provisioning error, or privilege escalation;
- emergency access and post-event review.

Every exception owner, escalation path, retention rule, and evidence requirement is
`NOT IMPLEMENTED / NOT DETERMINED`.

## 26. Required Reviewer Functions And Missing Evidence

| Reviewer function                     | Required evidence                                                                                     | Assignment status                                                       |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Information security                  | Threat model, security event families, integrity controls, access review, incident escalation         | `REQUIRED EXTERNAL EVIDENCE`; reviewer `NOT SELECTED`                   |
| Clinical safety/healthcare governance | Clinical event families, patient-safety exceptions, correction/annotation rules                       | `REQUIRED EXTERNAL EVIDENCE`; reviewer `NOT SELECTED`                   |
| Privacy/data protection               | Minimum-necessary fields, notice/rights interaction, patient identifier handling, export minimization | `REQUIRED EXTERNAL EVIDENCE`; reviewer `NOT SELECTED`                   |
| Legal/regulatory                      | Applicability, evidentiary sufficiency, retention, holds, disclosure, regulator obligations           | `REQUIRED EXTERNAL EVIDENCE`; reviewer `NOT SELECTED`                   |
| Records management                    | Retention, disposition, archive, legal hold, destruction evidence, supersession                       | `REQUIRED EXTERNAL EVIDENCE`; reviewer `NOT SELECTED`                   |
| Platform/operations                   | Audit destination, durability, backup/restore, monitoring, alerting, on-call, failure recovery        | `REQUIRED EXTERNAL EVIDENCE`; reviewer `NOT SELECTED`                   |
| Patient identity/administration       | Patient identifiers, MRN, duplicate/link/merge, representative authority, rights workflow             | `REQUIRED EXTERNAL EVIDENCE`; reviewer `NOT SELECTED`                   |
| Product decision authority            | Bounded outcome, rationale, limitations, dependencies, and non-authorization boundary                 | `REVISE` recorded; qualified implementation evidence remains incomplete |

## 27. OPEN-06 APPROVE-Readiness Checklist

Unchecked items are prerequisites for an `APPROVE` outcome for the bounded
`OPEN-06` audit proposal only. They are not prerequisites for a properly evidenced
`REVISE` or `REJECT` outcome.

- [ ] Bounded audit scope is defined by environment, data category, actor, system,
      facility, workflow, and processing purpose.
- [ ] Security and clinical event families are approved with exact minimum fields and
      prohibited fields.
- [ ] Privacy, legal, clinical, security, operations, records-management, and patient
      identity evidence is documented for the bounded scope.
- [ ] Audit store, recipient, provider, region, durability, integrity, access model,
      alerting, review, export, and chain-of-custody controls are selected.
- [ ] Audit retention, deletion, backup, restore, and legal-hold behavior are approved
      under `OPEN-07`.
- [ ] Legal applicability and evidentiary requirements are reviewed under `OPEN-10`.
- [ ] Production ownership and operational support are accepted under `OPEN-12`.
- [ ] Authority, date, evidence URL, rationale, limitations, dependencies, and
      non-authorization boundary are recorded.
- [ ] Approval states that it does not by itself authorize runtime implementation,
      production deployment, or real patient-data processing.

Independent blockers remain separate. Pending `OPEN-02`, `OPEN-07`, `OPEN-08`,
`OPEN-10`, or `OPEN-12` decisions do not necessarily prevent recording a bounded
`OPEN-06` product-owner outcome, but `OPEN-06` approval would not approve those
dependencies or pass a production gate.

The recorded `OPEN-06` outcome is `REVISE`, dated 2026-09-01, by Habte Selasie,
Repository Owner and Product Decision Authority, with evidence in [GitHub issue
#41](https://github.com/wku572/hakimi-healthcare-platform/issues/41#issuecomment-5494209792).
`OPEN-06` must be reconsidered after required security and clinical audit event
families, actor/subject/resource/facility/action/outcome/reason/correlation/timestamp
fields, minimum-necessary and privacy-safe field boundaries, clinical
significance, patient-safety requirements, authentication/authorization/provisioning/session/revocation
evidence, audit-write atomicity and failed-write behavior, integrity and
tamper-evidence controls, trusted time, ordering, durable storage, recipient
model, audit access, review, alerting, escalation, segregation of duties,
investigation, disclosure, export, redaction, evidence-chain controls,
retention/deletion/backup/restoration/legal-hold dependencies, exception
handling, recovery handling, named operational ownership, and qualified-review
evidence are reviewed and documented by required qualified functions.

## 28. Independent Outcome Choices

No checkbox is selected.

- [ ] `APPROVE`: approve the proposed `OPEN-06` security and clinical audit model
      for the explicitly recorded governance scope, subject to recorded limitations,
      independent dependencies, and separate implementation and production
      authorization.
- [ ] `REVISE`: require specific corrections, missing evidence, narrower scope,
      different event families, different field boundaries, or additional qualified
      review before reconsideration.
- [ ] `REJECT`: reject the proposal as unsuitable for the stated scope and require a
      replacement audit evidence model if needed.

Outcome rules:

- `APPROVE` requires applicable `OPEN-06` readiness evidence and completed
  approval-readiness criteria for the bounded scope.
- Incomplete evidence may support a properly evidenced `REVISE` outcome identifying
  required corrections.
- A properly evidenced `REJECT` outcome may be recorded when the proposal is
  unsuitable.
- Recording `REVISE` or `REJECT` does not require satisfying `APPROVE` prerequisites.
- No outcome by itself authorizes runtime implementation, production deployment, or
  real patient-data processing.

## 29. Final Six-Decision Governance Matrix

| Decision  | Recorded product-owner outcome | Canonical decision type | Implementation/governance selection | Notes                                                                                               |
| --------- | ------------------------------ | ----------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------- |
| `OPEN-02` | `REVISE`                       | `OPEN DECISION`         | `PENDING`                           | Privacy, lawful-purpose, notice, consent, rights, and minimum-necessary evidence remains incomplete |
| `OPEN-06` | `REVISE`                       | `OPEN DECISION`         | `PENDING`                           | Audit evidence remains incomplete; this package implements no audit runtime                         |
| `OPEN-07` | `REVISE`                       | `OPEN DECISION`         | `PENDING`                           | Retention, deletion, backup, and legal-hold evidence remains incomplete                             |
| `OPEN-08` | `REVISE`                       | `OPEN DECISION`         | `PENDING`                           | Patient identity, duplicate, merge, and multi-facility ownership evidence remains incomplete        |
| `OPEN-10` | `REVISE`                       | `OPEN DECISION`         | `PENDING`                           | Qualified legal applicability and production facts remain incomplete                                |
| `OPEN-12` | `REVISE`                       | `OPEN DECISION`         | `PENDING`                           | Deployment target and operational ownership remain incomplete                                       |

Production deployment remains `NOT AUTHORIZED`. Real patient-data processing remains
`NOT AUTHORIZED`. All production gates remain `BLOCKED`. This document introduces no
`CONFIRMED` record, no audit runtime, no audit database, no audit sink, no audit
middleware, no migration, no API operation, no dependency, no configuration, no
infrastructure, no CI change, and no production technology selection.

## Reconciliation Summary

| Source                                          | Repository result        |
| ----------------------------------------------- | ------------------------ |
| OpenAPI operations                              | 26 documented operations |
| Express operations                              | 26 registered operations |
| Public health operations                        | 2                        |
| Workforce-protected operations                  | 24                       |
| Protected operations with grants                | 23                       |
| Policy-blocked protected operations             | 1                        |
| `PATIENT` grants                                | 0                        |
| OPEN-10 inventory IDs                           | 42 unique IDs            |
| OPEN-10 data-flow IDs                           | 24 unique IDs            |
| OPEN-10 trust-boundary IDs                      | 15 unique IDs            |
| PostgreSQL tables including migration catalogue | 11                       |
| Diagnostic event codes                          | 24 stable codes          |
| Structured-log optional fields                  | 17 safe fields           |
