# OPEN-08 Patient Identity And Ownership Evidence

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

| Field                               | Value                                                                                                                                                                                                                                                                                                                                                                                 |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Purpose                             | Repository-reconciled evidence package for `OPEN-08` patient identity, facility-scoped registration, duplicate handling, linking, merge/unmerge, provenance, demographic correction, representative authority, and multi-facility ownership                                                                                                                                           |
| Decision effect                     | Records the product-owner `REVISE` outcome only; this document does not approve patient-identity policy, create identity resolution, or close `OPEN-08`                                                                                                                                                                                                                               |
| Canonical decision type             | `OPEN DECISION`                                                                                                                                                                                                                                                                                                                                                                       |
| Implementation/governance selection | `PENDING`                                                                                                                                                                                                                                                                                                                                                                             |
| Recorded product-owner outcome      | `REVISE`                                                                                                                                                                                                                                                                                                                                                                              |
| Decision date                       | 2026-09-02                                                                                                                                                                                                                                                                                                                                                                            |
| Authority                           | Habte Selasie - Repository Owner and Product Decision Authority                                                                                                                                                                                                                                                                                                                       |
| Evidence URL                        | [GitHub issue #41 OPEN-08 REVISE comment](https://github.com/wku572/hakimi-healthcare-platform/issues/41#issuecomment-5507593372)                                                                                                                                                                                                                                                     |
| Identity-resolution runtime         | `NOT IMPLEMENTED / NOT DETERMINED`                                                                                                                                                                                                                                                                                                                                                    |
| Production steward or owner         | `NOT SELECTED` / `NOT DETERMINED`                                                                                                                                                                                                                                                                                                                                                     |
| Production gates                    | `BLOCKED`                                                                                                                                                                                                                                                                                                                                                                             |
| Review issue                        | [GitHub issue #41](https://github.com/wku572/hakimi-healthcare-platform/issues/41) remains open for Sprint 16 product-owner review                                                                                                                                                                                                                                                    |
| Governing records                   | [OPEN-08](./REQUIREMENTS.md), [Open Decisions](./OPEN_DECISIONS.md), [Sprint 16 governance](./PRODUCTION_READINESS_GOVERNANCE.md), [OPEN-02 privacy evidence](./OPEN02_PRIVACY_PURPOSE_AND_CONSENT_EVIDENCE.md), [OPEN-06 audit evidence](./OPEN06_SECURITY_AND_CLINICAL_AUDIT_EVIDENCE.md), and [OPEN-07 retention evidence](./OPEN07_RETENTION_DELETION_AND_LEGAL_HOLD_EVIDENCE.md) |

This document is governance evidence only. It is not clinical-safety approval,
privacy approval, legal advice, patient-identity proofing, merge-policy approval,
production authorization, or authorization to process real patient data.

## 2. Scope And Authority Boundary

- `CURRENT REPOSITORY FACT`: the repository implements synthetic patient and
  patient-facility registration tables, API contracts, validation, route handlers,
  services, repositories, access policy, schema verification, and tests.
- `PROPOSED OPEN-08 CONTROL`: candidate patient identity, duplicate, linking,
  merge, unmerge, provenance, representative-authority, and ownership rules
  require stakeholder approval.
- `REQUIRED EXTERNAL EVIDENCE`: patient administration, health-information
  management, clinical safety, privacy, information security, legal/regulatory,
  records-management, operations, and product authority must review the model.
- `NOT IMPLEMENTED / NOT DETERMINED`: identity proofing, duplicate scoring,
  matching, linking, merge, unmerge, survivorship, representative authority,
  cross-facility ownership, production stewardship, patient authentication, and
  legal applicability are absent or unresolved.

Synthetic records are not real patients. A repository-implemented interface is not
evidence of live patient traffic, live facilities, production callers, production
support, or real patient-data processing.

## 3. Evidence-Label Definitions

| Label                              | Meaning in this evidence package                                                                                                            |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `CURRENT REPOSITORY FACT`          | Implemented schema, route, contract, validation, repository, authorization, diagnostic, documentation, or test evidence                     |
| `PROPOSED OPEN-08 CONTROL`         | Candidate patient-identity or ownership policy requiring stakeholder approval                                                               |
| `REQUIRED EXTERNAL EVIDENCE`       | Evidence required from qualified reviewers, accountable owners, participating facilities, records stewards, contracts, or policy            |
| `NOT IMPLEMENTED / NOT DETERMINED` | Identity component, reviewer, workflow, owner, authority, legal conclusion, threshold, algorithm, provider, or production fact is absent    |
| `NOT SELECTED`                     | A steward, owner, provider, algorithm, score, threshold, biometric, national identifier, MPI product, jurisdiction, or region is not chosen |
| `ABSENT/PROHIBITED`                | Verified absent from the implemented repository or explicitly prohibited by current governance                                              |

## 4. Current Patient-Identity Repository Facts

`CURRENT REPOSITORY FACT`: the repository stores a synthetic platform patient UUID
and one or more facility-scoped registrations. It does not prove a verified human
identity.

| Area                      | Exact repository source and symbol                                                                                                                                    | Current behavior                                                                                                          |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Patient migration         | `apps/api/database/migrations/up/003_create_patients_and_registrations.sql`                                                                                           | Creates `patients` and `patient_facility_registrations` with bounded columns, constraints, indexes, and restrictive FKs   |
| Schema verification       | `apps/api/src/schema-verify.ts :: verifyPatientsSchema`, `verifyPatientFacilityRegistrationsSchema`                                                                   | Verifies patient tables, bounded types, constraints, indexes, and foreign keys                                            |
| Shared contract           | `packages/shared/src/patient-api.ts :: Patient`, `PatientFacilityRegistration`, `CreatePatientInput`, `UpdatePatientInput`, `PatientListQuery`, `PatientListResponse` | Defines API-facing patient and registration shapes                                                                        |
| Runtime validation        | `apps/api/src/patients/schemas.ts :: createPatientSchema`, `updatePatientSchema`, `listPatientsQuerySchema`, `patientIdParamSchema`                                   | Strictly validates body, path, and query input; rejects unknown fields; normalizes email/admin sex through schema/service |
| Patient route             | `apps/api/src/patients/router.ts :: createPatientsRouter`                                                                                                             | Exposes create, list/search, get, update, and delete route handlers with authorization before service execution           |
| Patient service           | `apps/api/src/patients/service.ts :: createPatientService`                                                                                                            | Creates patient plus first registration in one transaction; normalizes fields; hydrates registrations                     |
| Patient repository        | `apps/api/src/patients/repository.ts :: createPatientRepository`                                                                                                      | Uses parameterized SQL; maps rows to contracts; scopes patient and registration reads by authorized facilities            |
| Workforce authorization   | `apps/api/src/access/policy.ts :: operationPolicy`, `protectedOperations`                                                                                             | Grants patient create/list/get/update to `FACILITY_ADMIN` and `SCHEDULER`; `deactivatePatient` has zero permitted roles   |
| Privacy-preserving denial | `apps/api/src/access/service.ts :: createAccessService`; `apps/api/src/http/error-middleware.ts :: createApiErrorHandler`                                             | Uses server-derived scope and stable error envelopes without raw SQL, request bodies, tokens, claims, or patient payloads |
| Current diagnostics       | `apps/api/src/observability/logger.ts :: createStructuredLogger`; `apps/api/src/http/request-observability.ts :: createRequestObservabilityMiddleware`                | Logs normalized routes and safe fields only, not patient bodies, query values, headers, tokens, claims, or concrete IDs   |

Critical distinctions:

- A platform patient UUID is not proof of a verified human identity.
- A facility-scoped MRN is not a universal or cross-facility identifier.
- A unique database constraint is not a complete duplicate-detection policy.
- Patient registration is not identity proofing.
- Updating demographic fields is not an approved identity-correction workflow.
- Deactivation is not merge, deletion, or identity resolution.
- Authorization scope is not data ownership.
- Existing tests prove repository behavior only, not clinical safety or production
  suitability.

## 5. Identity Terminology

| Term                              | Definition for this evidence package                                                                                        |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Platform patient UUID             | Repository-generated `patients.id` used as an internal synthetic platform record key; it is not identity proofing           |
| Facility MRN                      | `patient_facility_registrations.medical_record_number`, unique only within a facility, not universal across facilities      |
| Patient-facility registration     | Join record connecting one patient UUID to one facility and facility MRN                                                    |
| Identity proofing                 | External process that verifies a human identity; `NOT IMPLEMENTED / NOT DETERMINED`                                         |
| Duplicate candidate               | Potential match that requires review; no candidate-generation algorithm is selected                                         |
| Confirmed duplicate               | Steward-reviewed duplicate conclusion; this is a domain term only, not a repository governance status or `CONFIRMED` record |
| Link                              | Non-destructive association between patient records or identifiers; `NOT IMPLEMENTED / NOT DETERMINED`                      |
| Merge                             | Governed survivor/alias process that preserves history and downstream references; `NOT IMPLEMENTED / NOT DETERMINED`        |
| Unmerge                           | Governed reversal or correction process after mistaken link or merge; `NOT IMPLEMENTED / NOT DETERMINED`                    |
| Survivorship                      | Rule choosing which values remain visible after merge; no rule is selected                                                  |
| Provenance                        | Evidence of source, time, actor, facility, and reason for an identity field or relationship; policy is unresolved           |
| Source authority                  | Facility, steward, document, system, or reviewer trusted for a field; no authority hierarchy is selected                    |
| Representative/guardian authority | Evidence that another person may act for a patient; `NOT IMPLEMENTED / NOT DETERMINED`                                      |
| Cross-facility ownership          | Policy for which facility or steward may write, correct, link, or merge shared patient data; no owner is selected           |

## 6. Current Patient And Registration Schema

`CURRENT REPOSITORY FACT`: Migration `003` defines two patient-domain tables with
20 total columns.

| Table                            | Columns                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Constraints                                                                                                                                                                                                                                                         | Indexes                                                                                           | Deletion behavior                                                             |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `patients`                       | `id uuid PRIMARY KEY DEFAULT uuidv7()`, `first_name varchar(100) NOT NULL`, `middle_name varchar(100)`, `last_name varchar(100)`, `date_of_birth date`, `administrative_sex varchar(20) NOT NULL`, `phone varchar(30)`, `email varchar(254)`, `address_line varchar(200)`, `city varchar(100)`, `region varchar(100)`, `is_active boolean NOT NULL DEFAULT true`, `created_at timestamptz NOT NULL DEFAULT now()`, `updated_at timestamptz NOT NULL DEFAULT now()` | Primary key plus nonblank checks for names/contact/address/city/region and `patients_administrative_sex_check` allowing `female`, `male`, `other`, `unknown`                                                                                                        | `patients_name_search_idx`, `patients_last_name_first_name_id_idx`                                | Soft deactivation through `is_active=false`; no hard-delete workflow approved |
| `patient_facility_registrations` | `id uuid PRIMARY KEY DEFAULT uuidv7()`, `patient_id uuid NOT NULL`, `facility_id uuid NOT NULL`, `medical_record_number varchar(50) NOT NULL`, `created_at timestamptz NOT NULL DEFAULT now()`, `updated_at timestamptz NOT NULL DEFAULT now()`                                                                                                                                                                                                                    | `patient_facility_registrations_mrn_not_blank_check`, `patient_facility_registrations_patient_id_fkey`, `patient_facility_registrations_facility_id_fkey`, `patient_facility_registrations_facility_mrn_key`, `patient_facility_registrations_patient_facility_key` | `patient_facility_registrations_patient_id_idx`, `patient_facility_registrations_facility_id_idx` | `ON DELETE RESTRICT` to patients and facilities; no delete route              |

Patient-related migration constraints reconciled directly from Migration `003`:

- `patient_facility_registrations_facility_mrn_key`: unique
  `(facility_id, medical_record_number)`.
- `patient_facility_registrations_patient_facility_key`: unique
  `(patient_id, facility_id)`.
- `patient_facility_registrations_patient_id_fkey`: references `patients(id)` with
  `ON DELETE RESTRICT`.
- `patient_facility_registrations_facility_id_fkey`: references
  `healthcare_facilities(id)` with `ON DELETE RESTRICT`.
- `patients_administrative_sex_check`: stores one of `female`, `male`, `other`, or
  `unknown`, lowercased.

## 7. Platform UUID Versus Facility MRN Boundary

`CURRENT REPOSITORY FACT`: `patients.id` is a platform record key. Facility MRNs
are facility-scoped registration identifiers. Reusing the same MRN in different
facilities is possible because the unique constraint is `(facility_id,
medical_record_number)`.

`PROPOSED OPEN-08 CONTROL`: any cross-facility identity decision should preserve
the distinction between internal platform UUID, facility-owned MRN, patient-facing
identity evidence, and future aliases or merged records.

`NOT IMPLEMENTED / NOT DETERMINED`: no global MRN, national identifier, biometric,
master patient index, duplicate score, matching threshold, cross-facility owner, or
identity-proofing authority is selected.

## 8. Current API And Authorization Boundary

`CURRENT REPOSITORY FACT`: the API exposes five patient-related HTTP operations.
Sprint 15 protects all patient operations with workforce authentication and
authorization. `FACILITY_ADMIN` and `SCHEDULER` have patient create/list/get/update
grants within facility scope. `deactivatePatient` is policy-blocked with zero
permitted roles, and `PATIENT` grants remain zero.

| Count                                    | Repository result |
| ---------------------------------------- | ----------------- |
| Patient OpenAPI operations               | 5                 |
| Patient Express operations               | 5                 |
| Patient access-policy entries            | 5                 |
| Patient operations with workforce grants | 4                 |
| Patient policy-blocked operations        | 1                 |
| `PATIENT` grants                         | 0                 |

## 9. Patient-Operation Reconciliation

| Method | Route                         | OpenAPI operation   | Express route/symbol                                      | Current repository behavior                                                                                                                                                                                                                                                                                                                                                                                          | Proposed OPEN-08 policy question                                                | Current access result                                                                                             |
| ------ | ----------------------------- | ------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| POST   | `/api/v1/patients`            | `createPatient`     | `apps/api/src/patients/router.ts :: createPatientsRouter` | Creates one patient plus initial facility registration in one transaction after active facility and authorization checks                                                                                                                                                                                                                                                                                             | What identity evidence is required before creating a patient record?            | Granted to `FACILITY_ADMIN`, `SCHEDULER` within target facility scope                                             |
| GET    | `/api/v1/patients`            | `listPatients`      | `apps/api/src/patients/router.ts :: createPatientsRouter` | Lists/searches patients with deterministic pagination and scope-filtered registrations                                                                                                                                                                                                                                                                                                                               | Which patient search fields are minimum necessary and safe against enumeration? | Granted to `FACILITY_ADMIN`, `SCHEDULER` within server-derived facility scope                                     |
| GET    | `/api/v1/patients/:patientId` | `getPatientById`    | `apps/api/src/patients/router.ts :: createPatientsRouter` | Returns scoped patient record and scoped registrations or privacy-preserving not-found behavior                                                                                                                                                                                                                                                                                                                      | Which roles may view which identity/demographic fields and under what purpose?  | Granted to `FACILITY_ADMIN`, `SCHEDULER` for authorized facility relationship                                     |
| PATCH  | `/api/v1/patients/:patientId` | `updatePatient`     | `apps/api/src/patients/router.ts :: createPatientsRouter` | PATCH validation/shared/service/repository layers accept `firstName`, `middleName`, `lastName`, `dateOfBirth`, `administrativeSex`, `phone`, `email`, `addressLine`, `city`, `region`, and `isActive`; current route authorization allows only the ten demographic/contact fields for `FACILITY_ADMIN` and `SCHEDULER`, excludes `isActive`, and therefore cannot deactivate a patient under real access enforcement | What correction, provenance, source authority, and dispute workflow applies?    | Granted to `FACILITY_ADMIN`, `SCHEDULER`; `PRACTITIONER` coarse access remains blocked from patient update fields |
| DELETE | `/api/v1/patients/:patientId` | `deactivatePatient` | `apps/api/src/patients/router.ts :: createPatientsRouter` | Authorization denies before domain service or repository mutation under current policy                                                                                                                                                                                                                                                                                                                               | Can any bounded deactivation, merge, correction, or deletion authority exist?   | Policy-blocked; zero permitted roles; no `PATIENT` grant                                                          |

## 10. Cross-Domain Patient References

| Domain                  | Current repository fact                                                                                                                    | OPEN-08 implication                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Facilities              | `patient_facility_registrations.facility_id` references `healthcare_facilities(id)` with `ON DELETE RESTRICT`                              | Facility ownership and MRN stewardship remain unresolved                                 |
| Practitioners           | Practitioner access to standalone patient records remains blocked pending `OPEN-09`; appointments link practitioner, patient, and facility | Care-team relationship and patient-record access require policy                          |
| Appointments            | `appointments.patient_id` references `patients(id)` with `ON DELETE RESTRICT`; appointment rows preserve history                           | Merge/survivorship must preserve appointment references                                  |
| Reminders               | `appointment_reminders` reference appointments, indirectly connecting to patient appointment context                                       | Reminder identity/contact handling depends on privacy, retention, and reminder policy    |
| Workforce authorization | Patient create/list/get/update require current workforce roles and facility scope; `deactivatePatient` is blocked                          | Authorization scope is not data ownership                                                |
| Logs and errors         | Structured diagnostics omit request bodies, query values, headers, cookies, tokens, claims, and concrete identifiers                       | Future identity workflow evidence must not leak patient identifiers or sensitive content |

## 11. Proposed Identity-Authority Model

`PROPOSED OPEN-08 CONTROL`: define identity authority separately from access
authorization. A future approved model should specify:

- who may create a patient record and what evidence is required;
- who owns facility MRNs and registration corrections;
- who may declare duplicate candidates and confirmed duplicates;
- who may link, merge, unmerge, or mark records disputed;
- which source wins when demographic values conflict;
- how facility-specific facts coexist with platform-level identity facts;
- how every identity decision is evidenced without over-collecting sensitive data.

## 12. Proposed Duplicate-Detection Intake

`PROPOSED OPEN-08 CONTROL`: duplicate intake should create reviewable candidate
signals without automatically merging records.

No matching algorithm, threshold, score, biometric, national identifier, master
patient index product, identity provider, or vendor is selected. Candidate sources,
field weights, false-positive handling, false-negative handling, and human review
requirements are `NOT IMPLEMENTED / NOT DETERMINED`.

## 13. Proposed Steward-Review Workflow

`PROPOSED OPEN-08 CONTROL`: duplicate and ownership decisions should be reviewed by
qualified patient-administration or health-information-management stewards before
any destructive or cross-facility action.

Reviewer names, organizations, escalation paths, evidence forms, dispute handling,
quality checks, and production stewardship are `NOT SELECTED` / `NOT DETERMINED`.

## 14. Proposed Linking Model

`PROPOSED OPEN-08 CONTROL`: future linking should be non-destructive and
provenance-preserving. A link should record the source, rationale, reviewer,
effective time, affected facilities, limitations, and reversal path only after
qualified approval.

The repository currently has no link table, link API, link status, link audit
store, or link review workflow.

## 15. Proposed Merge And Survivorship Model

`PROPOSED OPEN-08 CONTROL`: a future merge should select a survivor record,
preserve aliases and previous identifiers, retain downstream references, record
conflicts, and avoid deleting clinical or operational history.

Survivorship rules for name, DOB, administrative sex, contact fields, address,
facility MRNs, appointments, reminders, audit evidence, and future clinical records
are `NOT IMPLEMENTED / NOT DETERMINED`.

## 16. Proposed Unmerge And Correction Model

`PROPOSED OPEN-08 CONTROL`: mistaken links or merges should have a reversible
correction path with reviewed evidence, affected-record inventory, downstream
repair steps, and patient-safety review.

The repository has no unmerge workflow, no correction queue, no provenance store,
and no downstream repair process.

## 17. Provenance And Field-Level Source Authority

`PROPOSED OPEN-08 CONTROL`: future identity fields should identify source
authority, collection context, facility, reviewer, date, reason, confidence, and
limitations where approved.

Current patient columns do not store field-level provenance. Current
`updated_at` timestamps are not provenance, approval, source authority, or identity
proofing evidence.

## 18. Demographic Uncertainty And Conflicting Evidence

`CURRENT REPOSITORY FACT`: `date_of_birth` is nullable and validated as a complete
date when provided. `administrative_sex` must be `female`, `male`, `other`, or
`unknown`. Names/contact/address fields can be updated within current field policy.

`NOT IMPLEMENTED / NOT DETERMINED`: partial DOB, estimated age, unknown name,
uncertain sex/gender policy, aliases, transliteration, guardianship, cultural name
variation, conflicting documents, dispute status, and clinical-safety escalation are
not resolved.

## 19. Multi-Facility Ownership And Write Authority

`CURRENT REPOSITORY FACT`: a patient may have multiple facility registrations
because the database permits multiple `patient_facility_registrations` rows for the
same `patient_id`, with uniqueness only on `(patient_id, facility_id)`.

`PROPOSED OPEN-08 CONTROL`: define whether patient-level demographic fields are
platform-owned, facility-owned, source-owned, steward-owned, or jointly governed.
Also define whether one facility can change shared patient fields when another
facility owns the MRN or source evidence.

No cross-facility owner, write hierarchy, conflict-resolution rule, or steward is
selected.

## 20. Representative, Guardian, Proxy, And Delegated Authority Questions

`REQUIRED EXTERNAL EVIDENCE`: future policy must determine:

- when a representative, guardian, proxy, caregiver, or delegated user may act;
- what proof is required;
- how authority starts, expires, changes, or is revoked;
- whether authority differs by patient age, capacity, facility, purpose, or law;
- which operations require extra evidence or deny delegated access;
- how disputes are handled without exposing patient information.

The repository has no representative, guardian, proxy, delegated-user, or patient
self-service schema.

## 21. Identity Proofing And Verification Questions

`NOT IMPLEMENTED / NOT DETERMINED`: patient registration does not perform identity
proofing. A future verified-identity model would require qualified review of
accepted evidence, risk level, reviewer authority, expiry, renewal, disputes,
exceptions, minor/guardian handling, and data minimization.

No national identifier, biometric, document-verification provider, or identity
provider is selected.

## 22. Patient Authentication And Self-Service Boundary

Patient authentication, patient MFA, account recovery, patient sessions, portal
access, patient self-service, patient-derived authorization context, and `PATIENT`
role grants remain absent/blocked.

`OPEN-08` cannot activate patient-facing identity features by implication.
Patient-facing policy depends on `OPEN-02`, `OPEN-07`, `OPEN-08`, `OPEN-10`, and
the production gates.

## 23. Privacy And Minimum-Necessary Dependency

`OPEN-02` governs lawful purpose, consent or non-consent grounds, notices, rights,
complaints, representative authority, minimum-necessary fields, and exception
handling. `OPEN-08` should not approve identity collection, matching, linking, or
merge fields beyond the minimum necessary for an approved purpose.

## 24. Security And Audit Dependency

`OPEN-06` governs future security and clinical audit evidence. Identity actions
such as duplicate candidate creation, link, merge, unmerge, demographic correction,
representative-authority change, and cross-facility ownership change need approved
event families, minimum fields, integrity controls, review, and retention
dependencies before implementation.

## 25. Retention, Deletion, Backup, And Legal-Hold Dependency

`OPEN-07` governs retention, archival, deletion, backup, legal hold, disposal,
restore, and deletion-propagation behavior. Identity merge, unmerge, aliases,
previous MRNs, source evidence, and downstream references must not imply erasure or
hard deletion unless separately approved.

## 26. Legal And Regulatory Dependency

`OPEN-10` governs applicable legal and regulatory requirements. This package does
not select a jurisdiction, regulator, legal obligation, legal basis, identity
proofing requirement, representative-authority rule, retention duty, data-subject
right, or cross-border transfer conclusion.

## 27. Deployment And Operational-Ownership Dependency

`OPEN-12` governs production target, operating entity, operational RACI, service
objectives, support model, backups, incident handling, and production ownership. No
production steward, production owner, facility owner, support owner, hosting
provider, region, or vendor is selected here.

## 28. Error, Exception, And Recovery Cases

An approved `OPEN-08` policy should define behavior for:

- false-positive duplicate candidate;
- false-negative duplicate;
- concurrent registration;
- duplicate facility MRN;
- incorrect demographic update;
- mistaken link or merge;
- disputed identity;
- unavailable evidence;
- representative-authority dispute;
- cross-facility conflict;
- partial failure;
- unauthorized access;
- failed unmerge or correction;
- downstream references.

Current repository behavior covers duplicate facility MRN conflicts and transactional
create-plus-registration rollback. It does not cover identity review, merge,
unmerge, disputed identity, representative authority, or downstream correction
workflow.

## 29. Required Reviewer Functions And Evidence Gaps

| Reviewer function                                    | Required evidence                                                                                                 | Assignment status                                                         |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Patient administration/health-information management | MRN ownership, registration workflow, duplicate-review workflow, steward authority, merge/unmerge procedure       | `REQUIRED EXTERNAL EVIDENCE`; reviewer `NOT SELECTED`                     |
| Clinical safety                                      | Patient-safety impact, misidentification risk, false-positive/false-negative handling, escalation and correction  | `REQUIRED EXTERNAL EVIDENCE`; reviewer `NOT SELECTED`                     |
| Privacy/data protection                              | Minimum-necessary identity fields, notice, rights, representative authority, cross-facility disclosure boundaries | `REQUIRED EXTERNAL EVIDENCE`; reviewer `NOT SELECTED`                     |
| Information security                                 | IDOR, enumeration, spoofing, unauthorized linking, account takeover, insider access, evidence integrity           | `REQUIRED EXTERNAL EVIDENCE`; reviewer `NOT SELECTED`                     |
| Legal/regulatory                                     | Applicable identity, guardian, consent, records, disclosure, correction, retention, and cross-border rules        | `REQUIRED EXTERNAL EVIDENCE`; reviewer `NOT SELECTED`                     |
| Records management                                   | Source evidence, aliases, merged records, unmerge records, retention, deletion, legal hold, backup disposition    | `REQUIRED EXTERNAL EVIDENCE`; reviewer `NOT SELECTED`                     |
| Platform/operations                                  | Steward workflow operations, support boundaries, monitoring, recovery, backup/restore, production ownership       | `REQUIRED EXTERNAL EVIDENCE`; reviewer `NOT SELECTED`                     |
| Product decision authority                           | Bounded outcome, rationale, limitations, dependencies, and non-authorization boundary                             | `REVISE` outcome recorded; required qualified evidence remains incomplete |

## 30. OPEN-08 APPROVE-Readiness Checklist

Unchecked items are prerequisites for an `APPROVE` outcome for the bounded
`OPEN-08` governance proposal only. They are not prerequisites for a properly
evidenced `REVISE` or `REJECT` outcome.

### A. OPEN-08 Bounded Proposal Readiness

- [ ] Bounded patient identity scope is defined by environment, data category,
      patient population, facility, workflow, and processing purpose.
- [ ] Patient administration/HIM, clinical safety, privacy, security, legal,
      records-management, operations, and product evidence is documented.
- [ ] Platform UUID, facility MRN, duplicate candidate, confirmed duplicate, link,
      merge, unmerge, survivorship, provenance, and source-authority meanings are
      approved.
- [ ] Duplicate intake, steward review, merge/unmerge, demographic correction, and
      dispute workflows are approved.
- [ ] Representative, guardian, proxy, delegated authority, age/capacity, and
      exception rules are approved where applicable.
- [ ] Cross-facility ownership, write authority, conflict resolution, and access
      boundaries are approved.
- [ ] Authority, date, evidence URL, rationale, limitations, dependencies, and
      non-authorization boundary are recorded.
- [ ] Approval states that it does not by itself authorize runtime implementation,
      production deployment, or real patient-data processing.

### B. Independent Implementation And Production Blockers

- [ ] `OPEN-02` privacy, lawful-purpose, notice, consent/withdrawal, rights, and
      minimum-necessary evidence is resolved for the bounded scope.
- [ ] `OPEN-06` audit event, field, review, integrity, and evidence-chain policy is
      resolved for identity actions.
- [ ] `OPEN-07` retention, deletion, backup, restore, and legal-hold policy is
      resolved for identity evidence, aliases, links, merges, and disputes.
- [ ] `OPEN-10` legal applicability, representative authority, rights, and
      regulatory evidence is resolved.
- [ ] `OPEN-12` production ownership, steward operations, support, backup, and
      incident ownership is resolved.
- [ ] Production and real-patient-data gates receive independent recorded approval.

Independent blockers remain separate. Pending or revised dependent records do not
necessarily prevent recording a bounded `OPEN-08` outcome, but `OPEN-08` approval
would not approve those dependencies, authorize implementation, or pass a
production gate.

## 31. Independent Outcome Choices

No checkbox is selected.

- [ ] `APPROVE`: approve the proposed `OPEN-08` patient identity and
      multi-facility ownership model for the explicitly recorded governance scope,
      subject to recorded limitations, independent dependencies, and separate
      implementation and production authorization.
- [ ] `REVISE`: require specific corrections, missing evidence, narrower scope,
      different reviewer functions, different ownership boundaries, or additional
      qualified review before reconsideration.
- [ ] `REJECT`: reject the proposal as unsuitable for the stated scope and require a
      replacement identity evidence model if needed.

Outcome rules:

- `APPROVE` requires applicable `OPEN-08` readiness evidence and completed
  approval-readiness criteria for the bounded scope.
- Incomplete evidence may support a properly evidenced `REVISE` outcome identifying
  required corrections.
- A properly evidenced `REJECT` outcome may be recorded when the proposal is
  unsuitable.
- Recording `REVISE` or `REJECT` does not require satisfying `APPROVE`
  prerequisites.
- No outcome by itself authorizes runtime implementation, production deployment, or
  real patient-data processing.

## 32. Final Six-Decision Governance Matrix

| Decision  | Recorded product-owner outcome | Canonical decision type | Implementation/governance selection | Notes                                                                                               |
| --------- | ------------------------------ | ----------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------- |
| `OPEN-02` | `REVISE`                       | `OPEN DECISION`         | `PENDING`                           | Privacy, lawful-purpose, notice, consent, rights, and minimum-necessary evidence remains incomplete |
| `OPEN-06` | `REVISE`                       | `OPEN DECISION`         | `PENDING`                           | Audit evidence remains incomplete; no audit runtime or approved audit policy exists                 |
| `OPEN-07` | `REVISE`                       | `OPEN DECISION`         | `PENDING`                           | Retention, deletion, backup, and legal-hold evidence remains incomplete                             |
| `OPEN-08` | `REVISE`                       | `OPEN DECISION`         | `PENDING`                           | Patient identity, duplicate, merge, and multi-facility ownership evidence remains incomplete        |
| `OPEN-10` | `REVISE`                       | `OPEN DECISION`         | `PENDING`                           | Qualified legal applicability and production facts remain incomplete                                |
| `OPEN-12` | `REVISE`                       | `OPEN DECISION`         | `PENDING`                           | Deployment target and operational ownership remain incomplete                                       |

Production deployment remains `NOT AUTHORIZED`. Real patient-data processing remains
`NOT AUTHORIZED`. All production gates remain `BLOCKED`. This document introduces no
`CONFIRMED` record, no matching algorithm, no score, no threshold, no biometric, no
national identifier, no master-patient-index product, no identity provider, no
production steward, no merge authority, no cross-facility owner, no legal
conclusion, no patient authentication, and no production implementation.

## 33. Recorded OPEN-08 REVISE Outcome

| Field                      | Value                                                                                                                                                                                                                                       |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Outcome                    | `REVISE`                                                                                                                                                                                                                                    |
| Decision date              | 2026-09-02                                                                                                                                                                                                                                  |
| Authority                  | Habte Selasie - Repository Owner and Product Decision Authority                                                                                                                                                                             |
| Evidence URL               | [GitHub issue #41 OPEN-08 REVISE comment](https://github.com/wku572/hakimi-healthcare-platform/issues/41#issuecomment-5507593372)                                                                                                           |
| Canonical decision type    | `OPEN DECISION`                                                                                                                                                                                                                             |
| Completion/selection state | `PENDING`                                                                                                                                                                                                                                   |
| Non-authorization boundary | This outcome does not approve patient-identity policy, identity proofing, matching, linking, merge, unmerge, cross-facility ownership, patient authentication, production deployment, real patient-data processing, or any production gate. |

Rationale: this evidence package accurately separates platform UUID, facility MRN,
registration, identity proofing, duplicate review, linking, merge/unmerge,
provenance, representative authority, and cross-facility ownership. Qualified
patient-administration, clinical-safety, privacy, security, legal,
records-management, operational, and product evidence remains incomplete.

`OPEN-08` must remain open and be reconsidered only after these required revisions
are reviewed and documented by the required qualified functions:

- identity-proofing evidence and assurance;
- duplicate-candidate generation and review rules;
- steward authority and escalation;
- link, merge, and unmerge authority;
- survivorship and alias handling;
- field-level provenance and source authority;
- demographic correction and dispute workflows;
- representative, guardian, proxy, and delegated authority;
- cross-facility ownership, write authority, and conflict resolution;
- patient-safety controls;
- audit-event and evidence requirements;
- retention, deletion, backup, restoration, and legal-hold dependencies;
- legal applicability;
- operational ownership and recovery;
- qualified-review evidence.

Issue #41 remains open for follow-up evidence and reconsideration. Production
deployment and real patient-data processing remain `NOT AUTHORIZED`, and all
production gates remain `BLOCKED`.

## Patient-Related Evidence Classification Method

This section makes the patient-related `INV`, `DF`, and `TB` inclusion counts
reproducible instead of preserving earlier totals by assumption.

Classification categories:

- `DIRECT PATIENT IDENTITY/DATA`: the source record directly contains, represents,
  references, stores, returns, or prohibits patient identity, demographics, contact,
  registration, appointment, reminder, clinical, or real-patient data.
- `PATIENT-ACCESS OR SECURITY DEPENDENCY`: the source record does not itself need to
  contain patient demographic content, but it controls, protects, authorizes,
  observes, tests, configures, or constrains access to patient data or
  patient-related operations.
- `HYPOTHETICAL PATIENT-DATA DEPENDENCY`: the source record is not implemented as a
  current patient-data store or flow, but it would affect patient identity, privacy,
  retention, audit, backup, support, export, or external processing if a future
  production model is approved.

Reproducible exclusion rule: exclude an `INV`, `DF`, or `TB` identifier when its
source title/description has no direct patient/registration/appointment/reminder
content, does not protect or govern patient-data access, and is not a future
dependency for patient identity, patient-data handling, patient rights, audit,
retention, backup, communications, or production external processing.

| ID      | Source title/description                                                     | Category                              | Why included                                                                     | Direct patient data or dependency |
| ------- | ---------------------------------------------------------------------------- | ------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------- |
| INV-003 | Practitioner master, professional, contact, and profile data                 | PATIENT-ACCESS OR SECURITY DEPENDENCY | Practitioner relationships affect care-team and appointment identity context     | Dependency                        |
| INV-004 | Practitioner-facility roster assignment                                      | PATIENT-ACCESS OR SECURITY DEPENDENCY | Facility/practitioner relationships constrain patient appointment access         | Dependency                        |
| INV-005 | Patient identifiers, demographics, and lifecycle                             | DIRECT PATIENT IDENTITY/DATA          | Core patient identity and demographic table                                      | Direct patient data               |
| INV-006 | Patient contact and address                                                  | DIRECT PATIENT IDENTITY/DATA          | Patient phone, email, address, city, and region                                  | Direct patient data               |
| INV-007 | Patient-facility registration and MRN                                        | DIRECT PATIENT IDENTITY/DATA          | Facility-scoped MRN and registration ownership boundary                          | Direct patient data               |
| INV-008 | Appointment relationship, schedule, state, cancellation, and history         | DIRECT PATIENT IDENTITY/DATA          | Appointments link patient, practitioner, facility, schedule, and status          | Direct patient data               |
| INV-009 | Appointment-reminder schedule, lease, retry, error category, and lifecycle   | DIRECT PATIENT IDENTITY/DATA          | Reminder rows derive from patient appointments                                   | Direct patient data               |
| INV-014 | Practitioner and assignment API contract data                                | PATIENT-ACCESS OR SECURITY DEPENDENCY | Practitioner/assignment contracts support care-team and facility scope           | Dependency                        |
| INV-015 | Patient and registration API contract data                                   | DIRECT PATIENT IDENTITY/DATA          | Patient request/response contract surface                                        | Direct patient data               |
| INV-016 | Appointment API contract data                                                | DIRECT PATIENT IDENTITY/DATA          | Appointment contracts expose patient-related relationships                       | Direct patient data               |
| INV-020 | Reminder processing context                                                  | DIRECT PATIENT IDENTITY/DATA          | Processing context is appointment-derived                                        | Direct patient data               |
| INV-021 | Server-derived authorization candidate and context                           | PATIENT-ACCESS OR SECURITY DEPENDENCY | Determines patient-operation access and facility scope                           | Dependency                        |
| INV-023 | Database connection and credential configuration                             | PATIENT-ACCESS OR SECURITY DEPENDENCY | Database access protects patient tables                                          | Dependency                        |
| INV-025 | Reminder-worker configuration                                                | PATIENT-ACCESS OR SECURITY DEPENDENCY | Worker settings affect patient appointment reminder processing                   | Dependency                        |
| INV-026 | Logging configuration                                                        | PATIENT-ACCESS OR SECURITY DEPENDENCY | Logging controls patient-data exposure boundaries                                | Dependency                        |
| INV-028 | Structured operational event records                                         | PATIENT-ACCESS OR SECURITY DEPENDENCY | Diagnostics can reveal or protect patient-access metadata                        | Dependency                        |
| INV-030 | Synthetic domain fixtures                                                    | DIRECT PATIENT IDENTITY/DATA          | Test fixtures include synthetic patients, registrations, appointments, reminders | Direct synthetic patient data     |
| INV-033 | Future production vendor, location, and recipient inventory                  | HYPOTHETICAL PATIENT-DATA DEPENDENCY  | Future vendors/locations could process patient data                              | Dependency                        |
| INV-034 | Future legal, purpose, audit, retention, rights, and responsibility metadata | HYPOTHETICAL PATIENT-DATA DEPENDENCY  | Future rights/audit/retention metadata governs patient identity evidence         | Dependency                        |
| INV-035 | Real patient data                                                            | DIRECT PATIENT IDENTITY/DATA          | Explicitly prohibited real patient content                                       | Direct patient data, prohibited   |
| INV-036 | Patient credentials, sessions, account recovery, and self-service            | HYPOTHETICAL PATIENT-DATA DEPENDENCY  | Patient authentication remains absent but would affect identity ownership        | Dependency                        |
| INV-038 | Clinical notes, diagnoses, attachments, and medical images                   | DIRECT PATIENT IDENTITY/DATA          | Explicitly absent clinical patient content                                       | Direct patient data, prohibited   |
| INV-039 | Payments, insurance, and claims                                              | DIRECT PATIENT IDENTITY/DATA          | Explicitly absent patient payer/claim content                                    | Direct patient data, prohibited   |
| INV-040 | Production communications-provider and delivery records                      | HYPOTHETICAL PATIENT-DATA DEPENDENCY  | Future communications could expose patient reminder content/destinations         | Dependency                        |
| INV-041 | Approved security or clinical audit records                                  | HYPOTHETICAL PATIENT-DATA DEPENDENCY  | Future audit records would evidence patient access or identity actions           | Dependency                        |
| INV-042 | Production backup, export, analytics, and external reporting data            | HYPOTHETICAL PATIENT-DATA DEPENDENCY  | Future copies/exports could include patient data                                 | Dependency                        |
| DF-003  | Workforce bearer-token authentication interface                              | PATIENT-ACCESS OR SECURITY DEPENDENCY | Authentication gates all workforce-protected patient operations                  | Dependency                        |
| DF-005  | Server-derived authorization and session mechanism                           | PATIENT-ACCESS OR SECURITY DEPENDENCY | Authorization scopes patient operations and facility relationships               | Dependency                        |
| DF-008  | Synthetic patient-registration interface behavior                            | DIRECT PATIENT IDENTITY/DATA          | Patient create/list/get/update interface behavior                                | Direct patient data               |
| DF-009  | Patient-deactivation policy-denial interface                                 | DIRECT PATIENT IDENTITY/DATA          | Patient deactivation target is denied before mutation                            | Direct patient target/dependency  |
| DF-010  | Synthetic appointment interface behavior                                     | DIRECT PATIENT IDENTITY/DATA          | Appointment flows include patient references                                     | Direct patient data               |
| DF-011  | Reminder creation and appointment-driven state changes                       | DIRECT PATIENT IDENTITY/DATA          | Reminder state is derived from patient appointments                              | Direct patient data               |
| DF-012  | Reminder-worker claim and processing cycle                                   | DIRECT PATIENT IDENTITY/DATA          | Worker processes patient appointment reminder context                            | Direct patient data               |
| DF-013  | Development no-op delivery boundary                                          | PATIENT-ACCESS OR SECURITY DEPENDENCY | Future reminder delivery minimization depends on this boundary                   | Dependency                        |
| DF-015  | Structured operational event output                                          | PATIENT-ACCESS OR SECURITY DEPENDENCY | Diagnostics can affect patient-data exposure and evidence boundaries             | Dependency                        |
| DF-017  | Session revocation and recovery                                              | PATIENT-ACCESS OR SECURITY DEPENDENCY | Revocation controls future patient-operation access                              | Dependency                        |
| DF-018  | Migration catalogue and schema management                                    | PATIENT-ACCESS OR SECURITY DEPENDENCY | Migration/schema tooling governs patient table shape                             | Dependency                        |
| DF-019  | Environment/configuration injection                                          | PATIENT-ACCESS OR SECURITY DEPENDENCY | Configuration protects database, OIDC, logging, and worker behavior              | Dependency                        |
| DF-020  | Synthetic unit and integration testing                                       | DIRECT PATIENT IDENTITY/DATA          | Tests include synthetic patient fixtures and cleanup                             | Direct synthetic patient data     |
| DF-021  | Future monitoring collection                                                 | HYPOTHETICAL PATIENT-DATA DEPENDENCY  | Future monitoring could receive patient-access metadata                          | Dependency                        |
| DF-022  | Future backup/archive                                                        | HYPOTHETICAL PATIENT-DATA DEPENDENCY  | Future backup/archive could copy patient identity records                        | Dependency                        |
| DF-023  | Future reminder communications                                               | HYPOTHETICAL PATIENT-DATA DEPENDENCY  | Future communications could process patient reminder content/destinations        | Dependency                        |
| DF-024  | Future rights/audit/breach/legal-hold evidence workflows                     | HYPOTHETICAL PATIENT-DATA DEPENDENCY  | Future rights/audit/hold workflows depend on identity proof and patient scope    | Dependency                        |
| TB-002  | Conceptual workforce HTTP client to Hakimi workforce-protected interface     | PATIENT-ACCESS OR SECURITY DEPENDENCY | Boundary protects workforce patient operations                                   | Dependency                        |
| TB-004  | API/access/domain/tooling to PostgreSQL                                      | PATIENT-ACCESS OR SECURITY DEPENDENCY | Boundary protects stored patient and registration tables                         | Dependency                        |
| TB-005  | Reminder worker to PostgreSQL                                                | PATIENT-ACCESS OR SECURITY DEPENDENCY | Boundary protects patient appointment reminder state                             | Dependency                        |
| TB-006  | Reminder worker to development adapter                                       | PATIENT-ACCESS OR SECURITY DEPENDENCY | Boundary prevents production reminder disclosure in current no-op adapter        | Dependency                        |
| TB-007  | Conceptual controlled-operator stdin to provisioning process                 | PATIENT-ACCESS OR SECURITY DEPENDENCY | Workforce provisioning controls patient-operation authority                      | Dependency                        |
| TB-009  | Environment/local development file to API/worker/tools                       | PATIENT-ACCESS OR SECURITY DEPENDENCY | Configuration boundary protects database/OIDC/logging/worker inputs              | Dependency                        |
| TB-010  | API/worker/provisioning process to stdout/stderr                             | PATIENT-ACCESS OR SECURITY DEPENDENCY | Logging boundary prevents patient-data leakage                                   | Dependency                        |
| TB-012  | Runtime stdout/stderr to future monitoring collector                         | HYPOTHETICAL PATIENT-DATA DEPENDENCY  | Future collector could receive patient-access metadata                           | Dependency                        |
| TB-013  | PostgreSQL to future backup/archive system                                   | HYPOTHETICAL PATIENT-DATA DEPENDENCY  | Future backup/archive could copy patient data                                    | Dependency                        |
| TB-014  | Future reminder adapter to communications provider/recipient                 | HYPOTHETICAL PATIENT-DATA DEPENDENCY  | Future adapter could transmit patient reminder content or destinations           | Dependency                        |
| TB-015  | Hakimi data/processes to future rights/audit/incident/legal-hold tooling     | HYPOTHETICAL PATIENT-DATA DEPENDENCY  | Future governance workflows depend on identity and patient-data scope            | Dependency                        |

## Reconciliation Summary

| Source                                                 | Repository result                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OpenAPI operations                                     | 26 documented operations                                                                                                                                                                                                                                                                                    |
| Express operations                                     | 26 registered operations                                                                                                                                                                                                                                                                                    |
| Public health operations                               | 2                                                                                                                                                                                                                                                                                                           |
| Workforce-protected operations                         | 24                                                                                                                                                                                                                                                                                                          |
| Protected operations with grants                       | 23                                                                                                                                                                                                                                                                                                          |
| Policy-blocked protected operations                    | 1                                                                                                                                                                                                                                                                                                           |
| `PATIENT` grants                                       | 0                                                                                                                                                                                                                                                                                                           |
| Patient-related HTTP operations                        | 5                                                                                                                                                                                                                                                                                                           |
| Patient-related inventory IDs                          | 26 unique IDs: `INV-003`, `INV-004`, `INV-005`, `INV-006`, `INV-007`, `INV-008`, `INV-009`, `INV-014`, `INV-015`, `INV-016`, `INV-020`, `INV-021`, `INV-023`, `INV-025`, `INV-026`, `INV-028`, `INV-030`, `INV-033`, `INV-034`, `INV-035`, `INV-036`, `INV-038`, `INV-039`, `INV-040`, `INV-041`, `INV-042` |
| Patient-related data-flow IDs                          | 17 unique IDs: `DF-003`, `DF-005`, `DF-008`, `DF-009`, `DF-010`, `DF-011`, `DF-012`, `DF-013`, `DF-015`, `DF-017`, `DF-018`, `DF-019`, `DF-020`, `DF-021`, `DF-022`, `DF-023`, `DF-024`                                                                                                                     |
| Patient-related trust-boundary IDs                     | 11 unique IDs: `TB-002`, `TB-004`, `TB-005`, `TB-006`, `TB-007`, `TB-009`, `TB-010`, `TB-012`, `TB-013`, `TB-014`, `TB-015`                                                                                                                                                                                 |
| PostgreSQL tables including migration catalogue        | 11                                                                                                                                                                                                                                                                                                          |
| Patient-domain PostgreSQL tables                       | 2: `patients`, `patient_facility_registrations`                                                                                                                                                                                                                                                             |
| Patient-domain columns                                 | 20 total: 14 `patients` columns and 6 registration columns                                                                                                                                                                                                                                                  |
| Patient-domain foreign keys                            | 2 direct registration FKs plus appointment/reminder downstream references                                                                                                                                                                                                                                   |
| Patient-domain unique constraints                      | 2 registration uniqueness constraints                                                                                                                                                                                                                                                                       |
| Patient test files with direct patient-module coverage | 3: `patients.routes.test.ts`, `patients.service.test.ts`, `patients.integration.ts`                                                                                                                                                                                                                         |
| Direct patient-module `it` declarations                | 23                                                                                                                                                                                                                                                                                                          |
| Files with patient-related test references             | 14                                                                                                                                                                                                                                                                                                          |
