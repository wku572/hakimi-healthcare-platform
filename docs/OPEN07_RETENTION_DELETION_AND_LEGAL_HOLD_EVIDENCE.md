# OPEN-07 Retention, Deletion, And Legal-Hold Evidence

> **EVIDENCE PACKAGE ONLY**
>
> **HYPOTHETICAL WHERE MARKED**
>
> **SYNTHETIC DATA ONLY**
>
> **NOT APPROVED FOR PRODUCTION**

## Document Control

| Field                                 | Value                                                                                                                                                                                                                                                                                                            |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Purpose                               | Provide repository-reconciled evidence for records-management, privacy, legal, clinical, security, operational, and product-owner review of `OPEN-07`                                                                                                                                                            |
| Decision effect                       | Records the product-owner `REVISE` outcome while preserving `OPEN-07` as an open decision; this document does not select retention, archival, deletion, backup, legal-hold, implementation, production, or real-data processing policy                                                                           |
| Canonical decision type               | `OPEN DECISION`                                                                                                                                                                                                                                                                                                  |
| Implementation/governance selection   | `PENDING`                                                                                                                                                                                                                                                                                                        |
| Recorded product-owner outcome        | `REVISE`                                                                                                                                                                                                                                                                                                         |
| Decision date                         | 2026-09-01                                                                                                                                                                                                                                                                                                       |
| Authority                             | Habte Selasie - Repository Owner and Product Decision Authority                                                                                                                                                                                                                                                  |
| Evidence URL                          | [GitHub issue #41 OPEN-07 REVISE comment](https://github.com/wku572/hakimi-healthcare-platform/issues/41#issuecomment-5491419798)                                                                                                                                                                                |
| Production deployment                 | `NOT AUTHORIZED`                                                                                                                                                                                                                                                                                                 |
| Real patient-data processing          | `NOT AUTHORIZED`                                                                                                                                                                                                                                                                                                 |
| Retention durations                   | `NOT DETERMINED`                                                                                                                                                                                                                                                                                                 |
| Archival tier                         | `NOT SELECTED`                                                                                                                                                                                                                                                                                                   |
| Backup duration                       | `NOT DETERMINED`                                                                                                                                                                                                                                                                                                 |
| Deletion deadline                     | `NOT DETERMINED`                                                                                                                                                                                                                                                                                                 |
| Legal-hold rule                       | `NOT DETERMINED`                                                                                                                                                                                                                                                                                                 |
| Jurisdiction, regulator, provider     | `NOT DETERMINED` / `NOT SELECTED`                                                                                                                                                                                                                                                                                |
| Operating entity and production owner | `NOT DETERMINED` / `NOT SELECTED`                                                                                                                                                                                                                                                                                |
| Product-owner review issue            | [GitHub issue #41](https://github.com/wku572/hakimi-healthcare-platform/issues/41) remains the product-owner review record                                                                                                                                                                                       |
| Governing records                     | [OPEN-07](./REQUIREMENTS.md), [Open Decisions](./OPEN_DECISIONS.md), [Sprint 16 governance](./PRODUCTION_READINESS_GOVERNANCE.md), [OPEN-10 proposed data inventory](./OPEN10_PROPOSED_DATA_INVENTORY.md), and [Sprint 16 operation governance matrix](./TRACEABILITY.md#sprint-16-production-governance-matrix) |

This document is not legal advice, a qualified legal opinion, a records-management
schedule, a clinical-safety policy, an operational runbook, or production
authorization. The recorded `REVISE` outcome is a governance-review result, not
records-management, privacy, legal, clinical, security, or operational approval.

## Evidence Labels

| Label                        | Meaning in this evidence package                                                                                           |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `CURRENT REPOSITORY FACT`    | Implemented repository behavior, schema, documentation, or tests at this branch                                            |
| `PROPOSED CONTROL`           | Candidate policy or control for stakeholder and qualified-review consideration                                             |
| `HYPOTHETICAL ASSUMPTION`    | Future operating-model assumption used only to structure questions                                                         |
| `NOT DETERMINED`             | Evidence, selection, applicability, duration, location, owner, provider, or legal conclusion is not established            |
| `REQUIRED EXTERNAL EVIDENCE` | Evidence that must come from qualified reviewers, operational owners, product authority, facilities, vendors, or contracts |
| `ABSENT/PROHIBITED`          | Verified absent from the implemented repository or explicitly prohibited by governance                                     |

## Scope And Authority Boundary

- `CURRENT REPOSITORY FACT`: the repository preserves domain lifecycle history
  through boolean activation fields, terminal statuses, timestamps, restrictive
  foreign keys, migration catalogues, and synthetic tests.
- `CURRENT REPOSITORY FACT`: Sprint 15 implemented workforce identity,
  authorization, facility scope, activation, revocation, and session state for
  synthetic-data testing through Migration `006` and runtime enforcement.
- `CURRENT REPOSITORY FACT`: no production deployment, real patient-data processing,
  production backup, archival tier, legal-hold workflow, hard-deletion workflow, or
  patient self-service is authorized.
- `PROPOSED CONTROL`: `OPEN-07` should decide retention categories, retention-start
  events, preservation exceptions, disposition methods, backup lifecycle, and legal
  hold before production or real patient-data use.
- `NOT DETERMINED`: all retention durations, deletion deadlines, backup periods,
  legal-hold triggers, reviewers, jurisdictions, providers, locations, regulators,
  production owners, and legal obligations.
- `ABSENT/PROHIBITED`: no real patient data, production credentials, clinical notes,
  insurance/payment data, approved audit store, communications provider records, or
  production backup/export data are authorized in the repository.

## Current Repository Persistence Facts

`CURRENT REPOSITORY FACT`: the repository defines six ordered SQL migration pairs
and one migration catalogue table managed by the migration runner. The facts below
describe the schema and codebase, not an independently observed live database state.
No production database state is established by this document.

| Area                         | Current repository evidence                                                                                                                                             | OPEN-07 relevance                                                                                                 |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Migration catalogue          | `apps/api/src/migrations/runner.ts` defines `schema_migrations` with migration version, name, checksum, and application timestamp                                       | Catalogue retention, deployment evidence, and rollback records need a reviewed schedule                           |
| Facilities                   | Migration `001` creates `healthcare_facilities` with `is_active` and timestamps; API DELETE behavior is soft/idempotent                                                 | Facility records are deactivated, not physically deleted, by current domain behavior                              |
| Practitioners                | Migration `002` creates `practitioners` with `is_active` and practitioner-facility assignment lifecycle                                                                 | Practitioner and roster records remain linked to assignments and appointments through restrictive foreign keys    |
| Patients                     | Migration `003` creates `patients` and `patient_facility_registrations`; patient registrations have facility-scoped MRNs and restrictive foreign keys                   | Patient identity, facility registration, and MRN records require retention and deletion rules before production   |
| Appointments                 | Migration `004` creates `appointments` with status, cancellation reason, cancellation timestamp, schedule timestamps, restrictive foreign keys, and overlap constraints | Appointment history is preserved through terminal states rather than deleted                                      |
| Reminders                    | Migration `005` creates `appointment_reminders` with status, retry, lease, delivery, cancellation, supersession, and dead-letter state                                  | Reminder job history, failed delivery categories, and cancellation/supersession records need an approved schedule |
| Workforce access             | Migration `006` creates `workforce_actors`, `workforce_role_assignments`, and `workforce_sessions` with activation, deactivation, revocation, and expiry fields         | Workforce authority and session evidence need retention, legal hold, and revocation-record handling               |
| Runtime diagnostics          | Structured logs and HTTP errors are privacy-minimized operational diagnostics, not an approved durable audit store                                                      | Diagnostic log retention is unresolved and must not be substituted for `OPEN-06` audit policy                     |
| Tests and cleanup            | Tests use synthetic fixtures and disposable state; integration tests verify rollback, concurrency, uniqueness, authorization, revocation, and privacy behavior          | Synthetic test data retention is a development evidence question, not production patient-data retention           |
| Migration rollback semantics | Down migrations drop dependent tables in reverse order for controlled local/test rollback                                                                               | Migration rollback is not a production data-deletion mechanism and must not be used as a records-disposal policy  |
| Live database state          | This document does not start PostgreSQL or inspect a live database                                                                                                      | Live environment retention and deletion evidence remains `NOT DETERMINED`                                         |

## Terminology

| Term                         | OPEN-07 interpretation                                                                                                                                            | Current status                                                                                                                                                  |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deactivation / soft deletion | Application lifecycle change that preserves the row and relationships while excluding or marking inactive records                                                 | `CURRENT REPOSITORY FACT` for facilities, practitioners, assignments, and patient route/service behavior, with patient HTTP DELETE policy-blocked for workforce |
| Lifecycle transition         | Change to a status or activation flag, such as appointment cancellation or reminder dead-letter state                                                             | `CURRENT REPOSITORY FACT`                                                                                                                                       |
| Terminal status              | Status intended to preserve history rather than imply physical disposal, such as `CANCELLED`, `COMPLETED`, `NO_SHOW`, `DELIVERED`, `SUPERSEDED`, or `DEAD_LETTER` | `CURRENT REPOSITORY FACT`                                                                                                                                       |
| Physical deletion            | Removal of rows from persisted storage as a records-disposition action                                                                                            | `NOT DETERMINED`; no approved production workflow                                                                                                               |
| Archival                     | Movement or classification of records for longer-term preservation with controlled access                                                                         | `NOT DETERMINED`                                                                                                                                                |
| Backup expiry                | End of backup retention window and removal through backup lifecycle controls                                                                                      | `NOT DETERMINED`                                                                                                                                                |
| Cryptographic erasure        | Disposal by destroying encryption keys so data becomes inaccessible                                                                                               | `NOT DETERMINED`; only a candidate review method                                                                                                                |
| Anonymization                | Irreversible transformation after which data is no longer attributable under applicable law                                                                       | `NOT DETERMINED`; requires qualified review                                                                                                                     |
| Legal hold                   | Preservation instruction that suspends normal disposition for a defined scope                                                                                     | `PROPOSED CONTROL`; not approved                                                                                                                                |
| Preservation                 | Maintaining integrity and availability for safety, dispute, legal, audit, or operational reasons                                                                  | `PROPOSED CONTROL`; legal applicability `NOT DETERMINED`                                                                                                        |
| Restoration                  | Recovery of data from backup or archive                                                                                                                           | `NOT DETERMINED`; owner and process not selected                                                                                                                |
| Purge                        | Final approved removal or irreversible transformation after holds and exceptions are cleared                                                                      | `NOT DETERMINED`                                                                                                                                                |
| Migration rollback           | Controlled schema rollback through down migrations                                                                                                                | `CURRENT REPOSITORY FACT`; not a production deletion mechanism                                                                                                  |

## Retention Inventory

Each row reconciles one OPEN-10 inventory record for `OPEN-07` review. `Duration`
is intentionally `NOT DETERMINED` for every row.

| Inventory ID | Current technical status                                                                                   | Persistence/transient boundary                                                 | Lifecycle trigger                                                                   | Proposed retention category                       | Proposed retention-start event          | Proposed disposition method                                                               | Legal-hold relevance                                     | Backup implications                                          | Required reviewer evidence                 | Duration         |
| ------------ | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- | ------------------------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------ | ---------------- |
| INV-001      | `CURRENT REPOSITORY FACT`: migration catalogue metadata is stored                                          | PostgreSQL catalogue table                                                     | Migration applied or rollback attempted                                             | Migration and release evidence                    | Migration application                   | Preserve, archive, or purge per records schedule                                          | May preserve deployment evidence                         | Backup capture `NOT DETERMINED`                              | Operations, security, records, legal       | `NOT DETERMINED` |
| INV-002      | `CURRENT REPOSITORY FACT`: facility master data is stored                                                  | PostgreSQL domain table and API responses                                      | Facility creation, update, or deactivation                                          | Facility/business master record                   | Facility creation                       | Deactivation, archive, redaction, or purge under approved rules                           | May preserve facility relationship evidence              | Restore may reintroduce inactive records                     | Records, operations, privacy, legal        | `NOT DETERMINED` |
| INV-003      | `CURRENT REPOSITORY FACT`: practitioner profile/contact data is stored                                     | PostgreSQL domain table and API responses                                      | Practitioner creation, update, or deactivation                                      | Workforce/practitioner master record              | Practitioner creation                   | Deactivation, archive, redaction, or purge under approved rules                           | May preserve licensure/workforce evidence                | Restore may reintroduce inactive records                     | Workforce, clinical, privacy, legal        | `NOT DETERMINED` |
| INV-004      | `CURRENT REPOSITORY FACT`: practitioner-facility roster assignments are stored                             | PostgreSQL relationship table                                                  | Assignment creation, update, primary change, or deactivation                        | Workforce roster and authority-scope relationship | Assignment creation                     | Deactivation, archive, or purge after dependency review                                   | May preserve appointment/authority history               | Restore may affect authority history                         | Workforce, operations, security, legal     | `NOT DETERMINED` |
| INV-005      | `CURRENT REPOSITORY FACT`: patient identifiers, demographics, and lifecycle are stored                     | PostgreSQL patient table and API responses                                     | Patient creation, update, or deactivation attempt                                   | Patient demographic/identity record               | Patient creation                        | Restrict, correct, merge-link, archive, redaction, anonymization, or purge after approval | High relevance for patient disputes and safety           | Restore may reintroduce patient data                         | Patient identity, clinical, privacy, legal | `NOT DETERMINED` |
| INV-006      | `CURRENT REPOSITORY FACT`: patient contact and address fields are stored                                   | PostgreSQL patient table and API responses                                     | Patient creation or contact update                                                  | Patient contact record                            | Contact collection                      | Correction, redaction, archive, anonymization, or purge after approval                    | Relevant to notices and contact disputes                 | Restore may reintroduce contact data                         | Privacy, patient administration, legal     | `NOT DETERMINED` |
| INV-007      | `CURRENT REPOSITORY FACT`: patient-facility registration and MRN are stored                                | PostgreSQL registration table                                                  | Initial registration                                                                | Patient registration/MRN ownership record         | Facility registration creation          | Preserve, merge-link, archive, redaction, or purge after approval                         | High relevance for identity and care-continuity disputes | Restore may affect duplicate/merge state                     | Patient identity, records, clinical, legal | `NOT DETERMINED` |
| INV-008      | `CURRENT REPOSITORY FACT`: appointment relationship, schedule, state, cancellation, and history are stored | PostgreSQL appointment table                                                   | Appointment creation, update, completion, no-show, or cancellation                  | Appointment history record                        | Appointment creation                    | Preserve, archive, redaction, anonymization, or purge after approval                      | Relevant to care scheduling disputes                     | Restore may reintroduce cancelled or superseded history      | Clinical, operations, privacy, legal       | `NOT DETERMINED` |
| INV-009      | `CURRENT REPOSITORY FACT`: appointment-reminder job lifecycle is stored                                    | PostgreSQL reminder table and worker state                                     | Reminder creation, processing, delivery, cancellation, supersession, or dead-letter | Reminder processing record                        | Reminder row creation                   | Preserve aggregate state, redact, archive, or purge after approval                        | Relevant to notification disputes and incidents          | Restore may replay or expose stale job state if uncontrolled | Operations, privacy, security, legal       | `NOT DETERMINED` |
| INV-010      | `CURRENT REPOSITORY FACT`: workforce actor identity linkage and activation are stored                      | PostgreSQL access table                                                        | Actor provisioning, activation, deactivation, or practitioner binding               | Workforce identity/authority record               | Actor provisioning                      | Deactivation, revocation evidence preservation, archive, or purge after approval          | Relevant to access disputes                              | Restore may re-enable stale identities unless controlled     | Security, identity, workforce, legal       | `NOT DETERMINED` |
| INV-011      | `CURRENT REPOSITORY FACT`: workforce role, facility scope, and activation are stored                       | PostgreSQL access table                                                        | Role provisioning, activation, scope change, or deactivation                        | Workforce authorization-scope record              | Role assignment provisioning            | Deactivation, revocation evidence preservation, archive, or purge after approval          | Relevant to authorization disputes                       | Restore may reintroduce stale authority                      | Security, operations, privacy, legal       | `NOT DETERMINED` |
| INV-012      | `CURRENT REPOSITORY FACT`: workforce local session lifecycle and revocation are stored                     | PostgreSQL access table                                                        | Session creation, activity, expiry, revocation, or recovery command                 | Workforce session/security record                 | Session creation                        | Expiry, revocation evidence preservation, archive, or purge after approval                | Relevant to incident and access review                   | Restore may revive stale session evidence if uncontrolled    | Security, operations, legal                | `NOT DETERMINED` |
| INV-013      | `CURRENT REPOSITORY FACT`: facility API contract data is transient                                         | Request/response boundary; mutations persist in facility table                 | Facility operation request/response                                                 | Facility API transaction evidence                 | Request receipt or response completion  | Operational log schedule, response expiry, or persisted record schedule                   | May preserve admin transaction disputes                  | Backup only where persisted/logged                           | Operations, records, legal                 | `NOT DETERMINED` |
| INV-014      | `CURRENT REPOSITORY FACT`: practitioner and assignment API contract data is transient                      | Request/response boundary; mutations persist in practitioner/assignment tables | Practitioner or assignment operation                                                | Workforce API transaction evidence                | Request receipt or response completion  | Operational log schedule, response expiry, or persisted record schedule                   | May preserve roster/authorization disputes               | Backup only where persisted/logged                           | Workforce, security, legal                 | `NOT DETERMINED` |
| INV-015      | `CURRENT REPOSITORY FACT`: patient and registration API contract data is transient                         | Request/response boundary; mutations persist in patient/registration tables    | Patient operation                                                                   | Patient API transaction evidence                  | Request receipt or response completion  | Operational log schedule, response expiry, or persisted record schedule                   | High relevance to patient identity and rights disputes   | Backup only where persisted/logged                           | Privacy, patient identity, legal           | `NOT DETERMINED` |
| INV-016      | `CURRENT REPOSITORY FACT`: appointment API contract data is transient                                      | Request/response boundary; mutations persist in appointment/reminder tables    | Appointment operation                                                               | Appointment API transaction evidence              | Request receipt or response completion  | Operational log schedule, response expiry, or persisted record schedule                   | Relevant to appointment/cancellation disputes            | Backup only where persisted/logged                           | Clinical, operations, legal                | `NOT DETERMINED` |
| INV-017      | `CURRENT REPOSITORY FACT`: health request and response data is transient                                   | HTTP response only; no request body                                            | Liveness or readiness request                                                       | Operational availability signal                   | Probe request                           | Short diagnostic handling or no application retention                                     | Low unless incident hold applies                         | Not expected except logs                                     | Operations, security, legal                | `NOT DETERMINED` |
| INV-018      | `CURRENT REPOSITORY FACT`: bearer token and verified OIDC claims are transient                             | Header/verification boundary; raw token not persisted                          | Protected request authentication                                                    | Workforce authentication evidence                 | Token verification                      | Do not persist raw tokens; claim retention only if approved                               | High for access incident investigations                  | Backup should not contain raw tokens                         | Security, identity, privacy, legal         | `NOT DETERMINED` |
| INV-019      | `CURRENT REPOSITORY FACT`: provisioning command input is transient                                         | stdin/restricted-file command boundary; effects persist in access tables       | Controlled provisioning command                                                     | Workforce provisioning evidence                   | Command execution                       | Preserve resulting state and separate evidence only if approved                           | High for authority disputes                              | Backup only where persisted/logged                           | Security, operations, workforce, legal     | `NOT DETERMINED` |
| INV-020      | `CURRENT REPOSITORY FACT`: reminder processing context is transient                                        | Worker memory from reminder/appointment tables                                 | Reminder worker cycle                                                               | Reminder-processing evidence                      | Cycle start or claim                    | Aggregate operational evidence, row lifecycle, or purge after approval                    | Relevant to delivery disputes/incidents                  | Backup only for persisted reminder state                     | Operations, privacy, legal                 | `NOT DETERMINED` |
| INV-021      | `CURRENT REPOSITORY FACT`: server-derived authorization candidate/context is derived                       | In-memory authorization boundary from OIDC plus PostgreSQL state               | Protected request authorization                                                     | Authorization decision evidence                   | Authorization evaluation                | Do not persist full context unless approved audit exists                                  | High for access disputes                                 | Not expected except allowed logs/session state               | Security, privacy, legal                   | `NOT DETERMINED` |
| INV-022      | `CURRENT REPOSITORY FACT`: non-secret API runtime configuration is configuration                           | Environment/process boundary                                                   | Runtime start or command invocation                                                 | Configuration evidence                            | Configuration use                       | Preserve deployment/config evidence only if approved                                      | Relevant to incidents                                    | Backup location `NOT SELECTED`                               | Operations, security, legal                | `NOT DETERMINED` |
| INV-023      | `CURRENT REPOSITORY FACT`: database connection and credential configuration names exist                    | Environment/process boundary; values prohibited from docs/logs                 | Runtime start or DB command                                                         | Secret/configuration evidence                     | Configuration use                       | Rotate, revoke, and preserve metadata only if approved                                    | High for security incidents                              | Secret backup policy `NOT DETERMINED`                        | Security, operations, legal                | `NOT DETERMINED` |
| INV-024      | `CURRENT REPOSITORY FACT`: OIDC trust configuration names exist                                            | Environment/process boundary                                                   | Runtime start or token verification                                                 | Identity-provider trust evidence                  | Configuration use                       | Preserve trust metadata only if approved                                                  | High for access disputes/incidents                       | Provider/location `NOT SELECTED`                             | Security, identity, legal                  | `NOT DETERMINED` |
| INV-025      | `CURRENT REPOSITORY FACT`: reminder-worker configuration names exist                                       | Environment/process boundary                                                   | Worker start/cycle                                                                  | Worker configuration evidence                     | Configuration use                       | Preserve config evidence only if approved                                                 | Relevant to delivery incidents                           | Backup location `NOT SELECTED`                               | Operations, security, legal                | `NOT DETERMINED` |
| INV-026      | `CURRENT REPOSITORY FACT`: logging configuration exists                                                    | Environment/process boundary                                                   | Runtime start or log-level change                                                   | Diagnostics configuration evidence                | Configuration use                       | Preserve config evidence only if approved                                                 | Relevant to incident reconstruction                      | Monitoring destination `NOT SELECTED`                        | Operations, security, legal                | `NOT DETERMINED` |
| INV-027      | `CURRENT REPOSITORY FACT`: web API base placeholder exists                                                 | Example configuration only                                                     | Local setup/reference                                                               | Placeholder configuration evidence                | Repository documentation                | Retain as repository documentation or remove if obsolete                                  | Low                                                      | No production backup selected                                | Operations, product, legal                 | `NOT DETERMINED` |
| INV-028      | `CURRENT REPOSITORY FACT`: structured operational event records are emitted                                | stdout/stderr only; future collector not selected                              | Runtime event emission                                                              | Operational diagnostic record                     | Event emission                          | Diagnostic log schedule, archive, or purge after approval                                 | High for incidents, not approved audit                   | Collector/backup `NOT SELECTED`                              | Operations, security, privacy, legal       | `NOT DETERMINED` |
| INV-029      | `CURRENT REPOSITORY FACT`: HTTP correlation and sanitized error metadata are emitted                       | HTTP header/response boundary and logs                                         | Request completion or error                                                         | HTTP diagnostic/error record                      | Request/error event                     | Response transient; diagnostic log schedule after approval                                | Relevant to support and incident disputes                | Collector/backup `NOT SELECTED`                              | Operations, security, privacy, legal       | `NOT DETERMINED` |
| INV-030      | `CURRENT REPOSITORY FACT`: synthetic domain fixtures are test only                                         | Test runner and disposable database                                            | Test execution                                                                      | Synthetic development evidence                    | Test data creation                      | Cleanup, preserve CI evidence, or purge per development policy                            | Low unless security investigation                        | CI artifact retention `NOT DETERMINED`                       | Engineering, security, records             | `NOT DETERMINED` |
| INV-031      | `CURRENT REPOSITORY FACT`: synthetic workforce/OIDC/session fixtures are test only                         | Test runner and in-memory cryptographic fixtures                               | Test execution                                                                      | Synthetic security-test evidence                  | Test data creation                      | Cleanup, preserve CI evidence, or purge per development policy                            | Relevant to supply-chain/security investigations         | CI artifact retention `NOT DETERMINED`                       | Engineering, security, records             | `NOT DETERMINED` |
| INV-032      | `CURRENT REPOSITORY FACT`: synthetic configuration/diagnostic fixtures are test only                       | Test runner                                                                    | Test execution                                                                      | Synthetic diagnostic-test evidence                | Test data creation                      | Cleanup, preserve CI evidence, or purge per development policy                            | Relevant to regression evidence                          | CI artifact retention `NOT DETERMINED`                       | Engineering, operations, records           | `NOT DETERMINED` |
| INV-033      | `HYPOTHETICAL ASSUMPTION`: future production vendor/location/recipient inventory is not implemented        | None in repository                                                             | Future provider or recipient selection                                              | Vendor/recipient evidence                         | Contract or vendor approval             | Archive contracts, update inventory, or purge obsolete records after approval             | High for legal holds and transfers                       | Provider backup `NOT SELECTED`                               | Procurement, privacy, operations, legal    | `NOT DETERMINED` |
| INV-034      | `HYPOTHETICAL ASSUMPTION`: future legal/purpose/audit/retention/rights metadata is not implemented         | None in repository                                                             | Future governance approval                                                          | Governance evidence                               | Decision record creation                | Preserve decision evidence, archive, or supersede after approval                          | High for legal/compliance evidence                       | Repository/document backup `NOT SELECTED`                    | Product, privacy, records, legal           | `NOT DETERMINED` |
| INV-035      | `ABSENT/PROHIBITED`: real patient data is not authorized                                                   | No authorized repository origin                                                | Not authorized                                                                      | Real patient record                               | Not applicable until authorized         | No collection, storage, retention, or disposal workflow authorized                        | Would be high if authorized later                        | Production backup `NOT SELECTED`                             | Privacy, clinical, legal, product          | `NOT DETERMINED` |
| INV-036      | `ABSENT/PROHIBITED`: patient credentials, sessions, recovery, and self-service are absent                  | No schema, route, or role grant                                                | Not authorized                                                                      | Patient account/security record                   | Not applicable until authorized         | No collection, storage, retention, or disposal workflow authorized                        | Would be high if authorized later                        | Production backup `NOT SELECTED`                             | Identity, privacy, security, legal         | `NOT DETERMINED` |
| INV-037      | `ABSENT/PROHIBITED`: production secrets, credentials, keys, and real IdP data are prohibited               | Repository placeholders only                                                   | Not authorized in repository                                                        | Production secret/security record                 | Not applicable                          | Keep out of repository; rotate/revoke externally if ever exposed                          | High for incidents                                       | Secret backup policy `NOT DETERMINED`                        | Security, operations, legal                | `NOT DETERMINED` |
| INV-038      | `ABSENT/PROHIBITED`: clinical notes, diagnoses, attachments, and medical images are absent                 | No implemented model                                                           | Not authorized                                                                      | Clinical record                                   | Not applicable until authorized         | No collection, storage, retention, or disposal workflow authorized                        | Would be high if authorized later                        | Production backup `NOT SELECTED`                             | Clinical, privacy, legal                   | `NOT DETERMINED` |
| INV-039      | `ABSENT/PROHIBITED`: payments, insurance, and claims are absent                                            | No implemented model                                                           | Not authorized                                                                      | Payment/insurance record                          | Not applicable until authorized         | No collection, storage, retention, or disposal workflow authorized                        | Would be high if authorized later                        | Production backup `NOT SELECTED`                             | Finance, privacy, legal                    | `NOT DETERMINED` |
| INV-040      | `ABSENT/PROHIBITED`: production communications-provider and delivery records are absent                    | Development no-op adapter only                                                 | Not authorized                                                                      | Communications provider record                    | Not applicable until authorized         | No collection, storage, retention, or disposal workflow authorized                        | Would be high if authorized later                        | Provider backup `NOT SELECTED`                               | Communications, privacy, legal             | `NOT DETERMINED` |
| INV-041      | `ABSENT/PROHIBITED`: approved security or clinical audit records are absent                                | No approved audit store                                                        | Not authorized                                                                      | Audit record                                      | Not applicable until `OPEN-06` approval | No durable audit retention selected                                                       | Would be high after audit approval                       | Audit backup `NOT SELECTED`                                  | Security, clinical, records, legal         | `NOT DETERMINED` |
| INV-042      | `ABSENT/PROHIBITED`: production backup/export/analytics/reporting data is absent                           | No production service or contract                                              | Not authorized                                                                      | Backup/export/reporting record                    | Not applicable until authorized         | No collection, storage, retention, or disposal workflow authorized                        | High if future copies exist                              | Backup architecture `NOT SELECTED`                           | Operations, privacy, records, legal        | `NOT DETERMINED` |

## PostgreSQL Lifecycle Matrix

The 11 tables below are repository-defined tables, including the migration
catalogue. The table names appear exactly once in this matrix.

| Table                             | Creating migration                             | Lifecycle fields                                                                                                   | Deactivation or terminal behavior                                                                      | Restrictive FK implications                                                                                         | Current physical-deletion capability                       | Rollback implications                                                                        | Proposed disposition question                                                  | Required evidence                          |
| --------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------ |
| schema_migrations                 | Migration runner catalogue SQL                 | `applied_at`; migration `version`, `name`, `checksum`                                                              | No domain lifecycle state                                                                              | No domain FKs                                                                                                       | No HTTP deletion; migration tooling manages catalogue rows | Rollback may remove catalogue evidence for local/test schema state only                      | Should migration evidence be preserved separately from database rows?          | Operations, security, records, legal       |
| healthcare_facilities             | `001_create_healthcare_facilities.sql`         | `is_active`, `created_at`, `updated_at`                                                                            | DELETE route/service deactivates and keeps repeated deletes idempotent                                 | Referenced by assignments, patient registrations, appointments, and workforce role scopes with `ON DELETE RESTRICT` | No approved production physical deletion                   | Down migration drops the table only in controlled rollback/test contexts                     | When can inactive facility records be archived, redacted, or purged?           | Records, operations, privacy, legal        |
| practitioners                     | `002_create_practitioners_and_assignments.sql` | `is_active`, `created_at`, `updated_at`                                                                            | DELETE route/service deactivates and keeps repeated deletes idempotent                                 | Referenced by assignments, appointments, and workforce actor bindings with `ON DELETE RESTRICT`                     | No approved production physical deletion                   | Down migration drops practitioner schema only in controlled rollback/test contexts           | When can inactive practitioner data be archived, redacted, or purged?          | Workforce, clinical, privacy, legal        |
| practitioner_facility_assignments | `002_create_practitioners_and_assignments.sql` | `is_active`, `is_primary`, `created_at`, `updated_at`                                                              | DELETE route/service deactivates assignment and preserves roster history                               | Referenced indirectly by access checks; practitioner/facility references use `ON DELETE RESTRICT`                   | No approved production physical deletion                   | Down migration drops assignment schema only in controlled rollback/test contexts             | How long must roster and authority-scope history be preserved?                 | Workforce, security, operations, legal     |
| patients                          | `003_create_patients_and_registrations.sql`    | `is_active`, `created_at`, `updated_at`                                                                            | Patient deactivation exists in service/route behavior but workforce HTTP DELETE remains policy-blocked | Referenced by registrations and appointments with `ON DELETE RESTRICT`                                              | No approved production physical deletion                   | Down migration drops patient schema only in controlled rollback/test contexts                | What patient identity, rights, safety, and deletion rules apply?               | Patient identity, clinical, privacy, legal |
| patient_facility_registrations    | `003_create_patients_and_registrations.sql`    | `created_at`, facility-scoped MRN uniqueness                                                                       | No active flag; relationship is preserved                                                              | References patients and facilities with `ON DELETE RESTRICT`                                                        | No approved production physical deletion                   | Down migration drops registrations before patients only in controlled rollback/test contexts | Can registrations ever be removed, merged, or superseded, and by whom?         | Patient identity, records, clinical, legal |
| appointments                      | `004_create_appointments.sql`                  | `status`, `cancelled_at`, `created_at`, `updated_at`, schedule timestamps                                          | Cancellation and terminal statuses preserve appointment history                                        | References patient, practitioner, and facility with `ON DELETE RESTRICT`                                            | No approved production physical deletion                   | Down migration drops appointment schema only in controlled rollback/test contexts            | Which appointment states start retention and which require preservation?       | Clinical, operations, privacy, legal       |
| appointment_reminders             | `005_create_appointment_reminders.sql`         | `status`, retry/lease timestamps, delivery/cancellation/supersession/dead-letter timestamps                        | Terminal processing states preserve reminder/job history                                               | References appointments with `ON DELETE RESTRICT`                                                                   | No approved production physical deletion                   | Down migration drops reminder schema only in controlled rollback/test contexts               | How should reminder state, failures, and retry evidence be retained or purged? | Operations, privacy, security, legal       |
| workforce_actors                  | `006_create_workforce_access_control.sql`      | `is_active`, `activated_at`, `deactivated_at`, `created_at`, `updated_at`                                          | Controlled provisioning can activate/deactivate actors; deactivation revokes authority                 | Referenced by role assignments and sessions with `ON DELETE RESTRICT`                                               | No approved production physical deletion                   | Down migration drops access-control schema only in controlled rollback/test contexts         | How long must workforce identity and activation history be preserved?          | Security, identity, workforce, legal       |
| workforce_role_assignments        | `006_create_workforce_access_control.sql`      | `is_active`, `activated_at`, `deactivated_at`, `created_at`, `updated_at`                                          | Controlled provisioning can activate/deactivate scoped roles; revocation is enforced                   | References actors and facilities with `ON DELETE RESTRICT`                                                          | No approved production physical deletion                   | Down migration drops role schema only in controlled rollback/test contexts                   | How long must role/scope evidence be preserved after deactivation?             | Security, operations, privacy, legal       |
| workforce_sessions                | `006_create_workforce_access_control.sql`      | `started_at`, `last_seen_at`, `absolute_expires_at`, `revoked_at`, `revocation_reason`, `created_at`, `updated_at` | Sessions expire or are revoked without deleting history                                                | References actors with `ON DELETE RESTRICT`                                                                         | No approved production physical deletion                   | Down migration drops session schema only in controlled rollback/test contexts                | How long should session and revocation evidence be retained?                   | Security, operations, legal                |

## Operation Impact Matrix

All 26 documented HTTP operations appear exactly once. This matrix preserves the
Sprint 15 access counts: two public health operations, 24 workforce-protected
domain operations, 23 protected operations with workforce grants, one
policy-blocked patient-deactivation operation, and zero `PATIENT` grants.

| Method | Route                                                          | Operation ID                     | Access posture              | Persistence impact                                        | Affected inventory IDs                                        | Current lifecycle behavior                                      | Proposed OPEN-07 implication                                                      | Unresolved evidence                             |
| ------ | -------------------------------------------------------------- | -------------------------------- | --------------------------- | --------------------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------- |
| GET    | /health/live                                                   | getHealthLive                    | Public health operation     | Does not persist data                                     | INV-017, INV-028, INV-029                                     | Returns liveness and may emit diagnostics                       | Decide operational-diagnostic retention, if any                                   | Log schedule and incident hold rules            |
| GET    | /health/ready                                                  | getHealthReady                   | Public health operation     | Does not persist domain data                              | INV-017, INV-023, INV-028, INV-029                            | Returns readiness without database details                      | Decide readiness diagnostic retention, if any                                     | Log schedule and incident hold rules            |
| POST   | /api/v1/facilities                                             | createHealthcareFacility         | Protected granted operation | Creates data                                              | INV-002, INV-013, INV-021, INV-028, INV-029                   | Creates active facility record                                  | Decide facility-master retention start and disposition                            | Facility record schedule and approval           |
| GET    | /api/v1/facilities                                             | listHealthcareFacilities         | Protected granted operation | Reads data                                                | INV-002, INV-013, INV-021, INV-028, INV-029                   | Lists scoped facility records                                   | Decide read-diagnostic retention, if any                                          | Audit/log policy dependencies                   |
| GET    | /api/v1/facilities/:id                                         | getHealthcareFacilityById        | Protected granted operation | Reads data                                                | INV-002, INV-013, INV-021, INV-028, INV-029                   | Reads one facility or privacy-preserving denial                 | Decide record and access-event retention                                          | Audit/log policy dependencies                   |
| PATCH  | /api/v1/facilities/:id                                         | updateHealthcareFacility         | Protected granted operation | Updates data                                              | INV-002, INV-013, INV-021, INV-028, INV-029                   | Updates facility fields, preserves row                          | Decide change-history and record retention                                        | Facility lifecycle evidence                     |
| DELETE | /api/v1/facilities/:id                                         | deactivateHealthcareFacility     | Protected granted operation | Deactivates data                                          | INV-002, INV-013, INV-021, INV-028, INV-029                   | Soft/idempotent deactivation; no physical deletion              | Decide inactive-facility disposition and hold rules                               | Facility dependency evidence                    |
| POST   | /api/v1/practitioners                                          | createPractitioner               | Protected granted operation | Creates data                                              | INV-003, INV-014, INV-021, INV-028, INV-029                   | Creates active practitioner record                              | Decide workforce/practitioner retention start                                     | Workforce and licensure evidence                |
| GET    | /api/v1/practitioners                                          | listPractitioners                | Protected granted operation | Reads data                                                | INV-003, INV-014, INV-021, INV-028, INV-029                   | Lists scoped practitioner records                               | Decide read-diagnostic retention, if any                                          | Audit/log policy dependencies                   |
| GET    | /api/v1/practitioners/:practitionerId                          | getPractitionerById              | Protected granted operation | Reads data                                                | INV-003, INV-014, INV-021, INV-028, INV-029                   | Reads one practitioner or privacy-preserving denial             | Decide practitioner record and access-event retention                             | Workforce/privacy evidence                      |
| PATCH  | /api/v1/practitioners/:practitionerId                          | updatePractitioner               | Protected granted operation | Updates data                                              | INV-003, INV-014, INV-021, INV-028, INV-029                   | Updates practitioner fields, preserves row                      | Decide change-history and record retention                                        | Workforce/privacy evidence                      |
| DELETE | /api/v1/practitioners/:practitionerId                          | deactivatePractitioner           | Protected granted operation | Deactivates data                                          | INV-003, INV-014, INV-021, INV-028, INV-029                   | Soft/idempotent deactivation; appointments remain linked        | Decide inactive-practitioner disposition and hold rules                           | Clinical/workforce dependencies                 |
| POST   | /api/v1/practitioners/:practitionerId/facilities               | createPractitionerAssignment     | Protected granted operation | Creates relationship data                                 | INV-004, INV-014, INV-021, INV-028, INV-029                   | Creates roster assignment                                       | Decide roster retention start and disposition                                     | Authority and appointment dependency evidence   |
| GET    | /api/v1/practitioners/:practitionerId/facilities               | listPractitionerAssignments      | Protected granted operation | Reads relationship data                                   | INV-004, INV-014, INV-021, INV-028, INV-029                   | Lists roster assignments                                        | Decide read-diagnostic retention, if any                                          | Audit/log policy dependencies                   |
| PATCH  | /api/v1/practitioners/:practitionerId/facilities/:assignmentId | updatePractitionerAssignment     | Protected granted operation | Updates relationship data                                 | INV-004, INV-014, INV-021, INV-028, INV-029                   | Updates roster assignment or primary flag, preserves row        | Decide roster change-history retention                                            | Authority evidence                              |
| DELETE | /api/v1/practitioners/:practitionerId/facilities/:assignmentId | deactivatePractitionerAssignment | Protected granted operation | Deactivates relationship data                             | INV-004, INV-014, INV-021, INV-028, INV-029                   | Soft/idempotent deactivation                                    | Decide inactive-assignment disposition and hold rules                             | Authority and appointment dependency evidence   |
| POST   | /api/v1/patients                                               | createPatient                    | Protected granted operation | Creates patient and registration data                     | INV-005, INV-006, INV-007, INV-015, INV-021, INV-028, INV-029 | Creates patient and initial registration in one transaction     | Decide patient and registration retention start                                   | OPEN-02, OPEN-08, OPEN-10 dependencies          |
| GET    | /api/v1/patients                                               | listPatients                     | Protected granted operation | Reads patient data                                        | INV-005, INV-006, INV-007, INV-015, INV-021, INV-028, INV-029 | Lists scoped patient records                                    | Decide patient-access diagnostic retention                                        | OPEN-02, OPEN-06, OPEN-08, OPEN-10 dependencies |
| GET    | /api/v1/patients/:patientId                                    | getPatientById                   | Protected granted operation | Reads patient data                                        | INV-005, INV-006, INV-007, INV-015, INV-021, INV-028, INV-029 | Reads one scoped patient or privacy-preserving denial           | Decide patient-access and record retention                                        | OPEN-02, OPEN-06, OPEN-08, OPEN-10 dependencies |
| PATCH  | /api/v1/patients/:patientId                                    | updatePatient                    | Protected granted operation | Updates patient data                                      | INV-005, INV-006, INV-007, INV-015, INV-021, INV-028, INV-029 | Updates patient fields, preserves row                           | Decide correction/provenance and record retention                                 | OPEN-02, OPEN-08, OPEN-10 dependencies          |
| DELETE | /api/v1/patients/:patientId                                    | deactivatePatient                | Policy-blocked operation    | Deactivation route exists but workforce access is blocked | INV-005, INV-006, INV-007, INV-015, INV-021, INV-028, INV-029 | Global patient deactivation is blocked by policy                | Decide whether deactivation, restriction, deletion, or rights workflow is allowed | OPEN-02, OPEN-07, OPEN-08, OPEN-10 dependencies |
| POST   | /api/v1/appointments                                           | createAppointment                | Protected granted operation | Creates appointment and reminder data                     | INV-008, INV-009, INV-016, INV-020, INV-021, INV-028, INV-029 | Creates appointment and reminder schedule state                 | Decide appointment/reminder retention start                                       | Appointment, privacy, legal dependencies        |
| GET    | /api/v1/appointments                                           | listAppointments                 | Protected granted operation | Reads appointment data                                    | INV-008, INV-016, INV-021, INV-028, INV-029                   | Lists scoped appointment records                                | Decide appointment-access diagnostic retention                                    | Audit/log policy dependencies                   |
| GET    | /api/v1/appointments/:appointmentId                            | getAppointmentById               | Protected granted operation | Reads appointment data                                    | INV-008, INV-016, INV-021, INV-028, INV-029                   | Reads one appointment or privacy-preserving denial              | Decide appointment record and access-event retention                              | Clinical/privacy/legal dependencies             |
| PATCH  | /api/v1/appointments/:appointmentId                            | updateAppointment                | Protected granted operation | Updates appointment and reminder data                     | INV-008, INV-009, INV-016, INV-020, INV-021, INV-028, INV-029 | Updates schedule/status, preserves history and reminder linkage | Decide reschedule/change-history retention                                        | Appointment/reminder dependencies               |
| POST   | /api/v1/appointments/:appointmentId/cancel                     | cancelAppointment                | Protected granted operation | Updates appointment and reminder data                     | INV-008, INV-009, INV-016, INV-020, INV-021, INV-028, INV-029 | Cancels appointment and preserves cancellation history          | Decide cancellation-reason and reminder-state retention                           | Clinical/privacy/legal dependencies             |

## Deactivation Versus Deletion Proof

- `CURRENT REPOSITORY FACT`: facility DELETE behavior is soft and idempotent; it
  preserves the facility row and related references.
- `CURRENT REPOSITORY FACT`: practitioner DELETE behavior is soft and idempotent;
  it preserves practitioner rows and appointment history.
- `CURRENT REPOSITORY FACT`: practitioner-assignment DELETE behavior is soft and
  idempotent; it preserves roster relationship history.
- `CURRENT REPOSITORY FACT`: patient DELETE route/service behavior is soft and
  idempotent in route tests, but Sprint 15 workforce authorization policy blocks
  `DELETE /api/v1/patients/:patientId`; no workforce role is granted global
  patient deactivation authority.
- `PROPOSED CONTROL`: deactivation must not be treated as a substitute for a
  patient-rights deletion, restriction, correction, merge, or legal-hold workflow.
- `NOT DETERMINED`: whether physical deletion, field redaction, anonymization,
  archive, or preservation applies to any production patient category.
- `CURRENT REPOSITORY FACT`: migration down files drop tables for controlled
  rollback/test use; migration rollback is not a production data-deletion,
  patient-rights, legal-hold, or disposal mechanism.

## Backup And Restore Questions

Every backup and restore topic is unresolved until `OPEN-07`, `OPEN-10`, and
`OPEN-12` receive qualified evidence and product-owner decisions.

| Topic                    | Current fact     | Required question                                                                             |
| ------------------------ | ---------------- | --------------------------------------------------------------------------------------------- |
| Backup scope             | `NOT SELECTED`   | Which databases, logs, configuration metadata, documents, and artifacts are in scope?         |
| Snapshot/PITR model      | `NOT DETERMINED` | Are snapshots, point-in-time recovery, or logical exports required?                           |
| Replication              | `NOT SELECTED`   | Is replication used, and where are replicas located?                                          |
| Restore testing          | `NOT DETERMINED` | Who tests restores, how often, with what evidence, and using what synthetic or approved data? |
| Encryption               | `NOT DETERMINED` | What encryption controls, keys, access roles, and rotation practices apply?                   |
| Access ownership         | `NOT SELECTED`   | Who can access backups, approve restores, or perform emergency recovery?                      |
| Geographic location      | `NOT SELECTED`   | Which regions, facilities, support locations, and transfer paths apply?                       |
| Provider                 | `NOT SELECTED`   | Which hosting, backup, monitoring, identity, and communications providers are used?           |
| Retention                | `NOT DETERMINED` | What backup duration, expiry, destruction, and evidence rules apply?                          |
| Deletion propagation     | `NOT DETERMINED` | How do approved deletions, redactions, holds, or restrictions propagate into backups?         |
| Legal hold               | `NOT DETERMINED` | How are backup copies preserved or excluded during hold?                                      |
| Failed deletion recovery | `NOT DETERMINED` | How are partial failures retried, evidenced, and escalated?                                   |
| Disaster recovery        | `NOT DETERMINED` | What RTO/RPO, failover, incident command, and restore authority apply?                        |

## Proposed Legal Hold And Preservation Model

This is a `PROPOSED CONTROL`, not an approved workflow. Legal applicability depends
on qualified `OPEN-10` review.

| Step                   | Proposed evidence/control question                                                                   | Status           |
| ---------------------- | ---------------------------------------------------------------------------------------------------- | ---------------- |
| Authorized hold issuer | Which legal, privacy, clinical, security, or executive function may issue a hold?                    | `NOT DETERMINED` |
| Hold scope             | Which records, subjects, facilities, time windows, systems, backups, exports, and logs are in scope? | `NOT DETERMINED` |
| Hold start             | What evidence records the hold start, reason category, issuer, approval, and affected categories?    | `NOT DETERMINED` |
| Acknowledgement        | Which custodians must acknowledge and how is acknowledgement evidenced?                              | `NOT DETERMINED` |
| Preservation action    | Which deletion, expiry, archival, redaction, anonymization, or backup processes are suspended?       | `NOT DETERMINED` |
| Deletion conflict      | How are rights-deletion or purge requests handled when a hold applies?                               | `NOT DETERMINED` |
| Access controls        | Who may view, export, or administer held records?                                                    | `NOT DETERMINED` |
| Review cadence         | How often are holds reviewed for continued necessity?                                                | `NOT DETERMINED` |
| Hold release           | Who releases a hold and what evidence proves release?                                                | `NOT DETERMINED` |
| Resumed disposition    | How does normal disposition resume after release without accidental over-retention?                  | `NOT DETERMINED` |
| Evidence chain         | What immutable or tamper-evident evidence is required?                                               | `NOT DETERMINED` |

## Data-Subject Rights Interaction

Applicability of any right remains `NOT DETERMINED` pending `OPEN-02`, `OPEN-08`,
and `OPEN-10`. This section is a review prompt only.

| Topic                    | Interaction with retention/deletion                                           | Required evidence                                                          |
| ------------------------ | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Access                   | Retained records may need retrieval, filtering, and explanation               | Applicable right, identity verification, scope, and response workflow      |
| Correction               | Corrections may need provenance without exposing incorrect data unnecessarily | Patient identity ownership, field stewardship, audit/retention interaction |
| Restriction              | Processing may need limitation without destroying required records            | Legal basis, technical flagging model, access controls                     |
| Objection                | Continued processing may need documented justification or stop condition      | Applicable grounds, exception rules, review authority                      |
| Portability              | Export retention and deletion after disclosure need rules                     | Applicability, format, recipient controls, evidence retention              |
| Deletion                 | Deletion may conflict with safety, legal hold, audit, or identity integrity   | Qualified legal review, approved disposal method, exception handling       |
| Complaint                | Complaints may create preservation duties                                     | Complaint workflow, reviewer, evidence chain                               |
| Representative authority | Requests by guardians or representatives need validation                      | Authority model, identity verification, scope                              |
| Identity verification    | Rights processing itself may create sensitive evidence                        | Minimum evidence, storage, expiry, and deletion rules                      |

## Audit And Diagnostic Boundary

- `CURRENT REPOSITORY FACT`: runtime diagnostics are privacy-safe structured logs
  emitted to stdout/stderr with stable event codes and a closed allowlist.
- `CURRENT REPOSITORY FACT`: HTTP error responses are sanitized and include opaque
  request IDs.
- `CURRENT REPOSITORY FACT`: reminder worker logs contain aggregate counts only.
- `PROPOSED CONTROL`: approved security and clinical audit records, if any, should
  be defined by `OPEN-06` before `OPEN-07` selects audit retention.
- `NOT DETERMINED`: audit event fields, audit store, integrity model, review
  cadence, audit retention, legal hold, and deletion exceptions.
- `ABSENT/PROHIBITED`: operational diagnostics are not an approved durable security
  or clinical audit store.

## Candidate Disposal And Deletion Methods

These methods are candidates for review only. None is selected.

| Method                         | Review use case                                                         | Constraints                                                                 |
| ------------------------------ | ----------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Logical deactivation           | Preserve row and relationships while preventing active use              | Not equivalent to rights deletion or anonymization                          |
| Row deletion                   | Remove records after dependencies, holds, and safety needs are resolved | Must account for restrictive FKs and history preservation                   |
| Cascading or ordered deletion  | Remove dependent records in a controlled order                          | Not implemented as production workflow; risky without identity/legal review |
| Field redaction                | Remove selected values while retaining structural record                | Must define provenance, audit, and restoration behavior                     |
| Anonymization/pseudonymization | Reduce identifiability for approved uses                                | Legal effect `NOT DETERMINED`; requires qualified review                    |
| Export then purge              | Preserve approved evidence externally before deletion                   | Recipient, format, security, retention, and legal basis unresolved          |
| Backup expiry                  | Allow deleted records to age out of backups                             | Backup architecture and duration `NOT DETERMINED`                           |
| Cryptographic erasure          | Destroy keys to make encrypted data inaccessible                        | Key architecture `NOT SELECTED`; forensic erasure not claimed               |

## Exceptions And Failure Cases

`PROPOSED CONTROL`: an approved OPEN-07 policy should define handling for:

- active legal hold or preservation instruction;
- patient-safety preservation or continuity-of-care need;
- disputed identity, representative authority, or duplicate/merge review;
- incident investigation or security review;
- backup restore that reintroduces deleted, redacted, or restricted data;
- partial deletion/redaction/anonymization failure;
- downstream recipient, vendor, processor, subprocessor, or export deletion;
- vendor termination or data return/destruction evidence;
- corrupted, inaccessible, inconsistent, or orphaned records;
- conflict between deactivation, legal hold, audit preservation, and rights
  requests.

All exception authority, evidence, escalation paths, and time limits remain
`NOT DETERMINED`.

## Roles And RACI Evidence Needed

No reviewer names, organizations, providers, production owners, facilities, or
vendors are selected.

| Reviewer function               | Required OPEN-07 evidence                                                                            | Assignment status |
| ------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------- |
| Records management              | Retention categories, starts, durations, archival, legal hold, disposition, destruction evidence     | `NOT SELECTED`    |
| Privacy/data protection         | Purpose limitation, minimum necessary, notices, rights, complaints, deletion/restriction interaction | `NOT SELECTED`    |
| Qualified legal                 | Applicable laws, obligations, holds, disputes, regulator expectations, contracts, transfers          | `NOT SELECTED`    |
| Clinical safety                 | Care-continuity preservation, clinical risk of deletion, appointment/reminder history needs          | `NOT SELECTED`    |
| Patient administration/identity | MRN ownership, identity verification, duplicate resolution, merge/link/unmerge impact                | `NOT SELECTED`    |
| Information security            | Session/access evidence, incident preservation, secure disposal, backup/restore controls             | `NOT SELECTED`    |
| Platform/operations             | Backup architecture, restore, monitoring, logs, DR, production runbooks, purge execution             | `NOT SELECTED`    |
| Product decision authority      | Bounded outcome, rationale, limitations, dependencies, and non-authorization boundary                | `NOT SELECTED`    |

## Evidence Gaps

- Applicable legal requirements and qualified legal findings remain
  `NOT DETERMINED`.
- Retention triggers, durations, archival tiers, deletion deadlines, backup periods,
  and destruction evidence remain `NOT DETERMINED`.
- Approved processing purposes, lawful grounds, consent/notice/rights workflows, and
  minimum-necessary fields remain pending `OPEN-02`.
- Patient identity ownership, duplicate handling, merge, unmerge, representative
  authority, and cross-facility record ownership remain pending `OPEN-08`.
- Security and clinical audit event families, fields, storage, integrity, review,
  and retention remain pending `OPEN-06`.
- Production operating entity, provider, region, environments, monitoring, identity,
  support, backup architecture, owner, RACI, service objectives, and recovery targets
  remain pending `OPEN-12`.
- Legal-hold authority, scope, evidence chain, release, and resumed disposition remain
  `NOT DETERMINED`.
- Deletion verification, failed-disposal recovery, backup deletion propagation, and
  vendor/subprocessor destruction evidence remain `NOT DETERMINED`.
- Reviewer identities, organizations, dates, scope, limitations, findings, and durable
  evidence remain `NOT SELECTED` or `NOT DETERMINED`.

## OPEN-07 APPROVE Readiness

Unchecked items are prerequisites for an `APPROVE` outcome for the bounded
`OPEN-07` proposal only. They are not prerequisites for a properly evidenced
`REVISE` or `REJECT` outcome.

### A. OPEN-07 APPROVE Readiness

- [ ] Bounded policy scope is defined by environment, data categories, actors,
      systems, facilities, and processing purposes.
- [ ] Qualified records-management, privacy, legal, clinical, security, and
      operational evidence applies to that scope.
- [ ] Retention categories, start events, durations, archival tiers, and disposition
      methods are documented.
- [ ] Legal-hold, preservation, release, exception, failed-disposal, and restoration
      handling are documented.
- [ ] Backup scope, location, expiry, restore, deletion propagation, and destruction
      evidence are documented.
- [ ] Patient rights, identity verification, representative authority, duplicate/merge
      interaction, and complaint handling are reconciled with `OPEN-02` and `OPEN-08`.
- [ ] Authority, date, evidence URL, rationale, limitations, dependencies, and
      non-authorization boundary are recorded.
- [ ] Approval states that it does not by itself authorize runtime implementation,
      production deployment, or real patient-data processing.

### B. Independent Downstream Implementation And Production Blockers

- [ ] `OPEN-02` privacy, lawful-purpose, notice, consent, rights, and
      minimum-necessary policy remains independently governed.
- [ ] `OPEN-06` security and clinical audit policy remains independently governed.
- [ ] `OPEN-08` patient identity, ownership, duplicate, merge, and cross-facility
      policy remains independently governed.
- [ ] `OPEN-10` qualified legal applicability remains independently governed.
- [ ] `OPEN-12` deployment target, provider, backup, operating model, and operational
      ownership remains independently governed.
- [ ] Production architecture, providers, environments, backup locations, owners,
      service objectives, recovery objectives, and production gates remain separately
      blocked until approved.

These records remain independent. Pending downstream decisions do not necessarily
prevent recording a bounded `OPEN-07` product-owner outcome. `OPEN-07` approval would
not resolve or approve those dependencies. They remain blockers to dependent
implementation, production deployment, and real patient-data processing. Production
gates do not need to be unblocked merely to record an `OPEN-07` policy outcome.

## Independent Product-Owner Choices

No checkbox is selected.

- [ ] `APPROVE`: approve the proposed `OPEN-07` retention, archival, deletion,
      backup, and legal-hold model for the explicitly recorded governance scope,
      subject to recorded limitations, independent dependencies, and separate
      implementation and production authorization.
- [ ] `REVISE`: require specific corrections, missing evidence, narrower scope, or
      additional qualified review before reconsideration.
- [ ] `REJECT`: reject the proposal as unsuitable for the stated scope.

Outcome rules:

- `APPROVE` requires applicable `OPEN-07` readiness evidence and completed
  approval-readiness criteria for the bounded scope.
- Incomplete evidence may support a properly evidenced `REVISE` outcome identifying
  required corrections.
- A properly evidenced `REJECT` outcome may be recorded when the proposal is
  unsuitable.
- Recording `REVISE` or `REJECT` does not require satisfying `APPROVE` prerequisites.
- No outcome by itself authorizes runtime implementation, production deployment, or
  real patient-data processing.

## Final Governance State

| Decision  | Recorded product-owner outcome | Canonical decision type | Implementation/governance selection | Notes                                                                                                          |
| --------- | ------------------------------ | ----------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `OPEN-02` | `REVISE`                       | `OPEN DECISION`         | `PENDING`                           | Privacy, lawful purpose, notice, consent, rights, and minimum-necessary evidence remains incomplete            |
| `OPEN-06` | `REVISE`                       | `OPEN DECISION`         | `PENDING`                           | Audit events, store, integrity, review, and retention evidence remains incomplete                              |
| `OPEN-07` | `REVISE`                       | `OPEN DECISION`         | `PENDING`                           | Product-owner revision requested; no duration, trigger, method, hold rule, or production authority is selected |
| `OPEN-08` | `REVISE`                       | `OPEN DECISION`         | `PENDING`                           | Patient identity, duplicate, merge, and multi-facility ownership evidence remains incomplete                   |
| `OPEN-10` | `REVISE`                       | `OPEN DECISION`         | `PENDING`                           | Qualified legal applicability and production facts remain incomplete                                           |
| `OPEN-12` | `REVISE`                       | `OPEN DECISION`         | `PENDING`                           | Deployment target and operational ownership remain incomplete                                                  |

Production deployment remains `NOT AUTHORIZED`. Real patient-data processing remains
`NOT AUTHORIZED`. All production gates remain `BLOCKED`. This document does not
introduce a `CONFIRMED` record, select a provider, choose a retention period, approve
hard deletion, approve legal hold, or authorize production use. `OPEN-07` must be
reconsidered after retention categories and triggers, applicable durations, archival
and disposition rules, backup scope and expiry, restore and deletion-propagation
controls, legal-hold issuance and release authority, patient-rights and identity
interactions, audit-record dependencies, exception handling, failed-disposal recovery,
downstream-recipient obligations, and deletion/destruction evidence are reviewed and
documented by the required qualified functions.
