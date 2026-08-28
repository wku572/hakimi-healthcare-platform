# OPEN-10 Hypothetical Operating Model And Data-Flow Evidence Pack

> **HYPOTHETICAL**
>
> **SYNTHETIC DATA ONLY**
>
> **NOT APPROVED FOR PRODUCTION**

## Document Control

| Field                                 | Value                                                                                                   |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Purpose                               | Prepare operating-model and data-flow facts and questions for qualified `OPEN-10` review                |
| Decision effect                       | None; this document does not approve, revise, reject, or close any OPEN decision                        |
| Legal status                          | Evidence-preparation material only; **not legal advice**, a legal opinion, or a regulator determination |
| Production deployment                 | `NOT AUTHORIZED`                                                                                        |
| Real patient-data processing          | `NOT AUTHORIZED`                                                                                        |
| Data permitted for review and testing | Synthetic data only                                                                                     |
| Operating entity                      | `NOT SELECTED`                                                                                          |
| Production owner                      | `NOT SELECTED`                                                                                          |
| Deployment provider and region        | `NOT SELECTED`                                                                                          |
| Preliminary source input              | External evidence-preparation artifact; not a repository dependency or legal authority                  |
| Companion data inventory              | [Repository-reconciled proposed data inventory](./OPEN10_PROPOSED_DATA_INVENTORY.md)                    |
| Product-owner review                  | [GitHub issue #41](https://github.com/wku572/hakimi-healthcare-platform/issues/41)                      |

This pack describes one hypothetical workforce-only model so reviewers can identify missing facts and request evidence. It does not assert that the model will be adopted or that any law, role, obligation, registration, transfer mechanism, or retention period applies to Hakimi. Technical readiness cannot authorize production deployment or processing of real patient data.

## Evidence Hierarchy And Limitations

The preliminary packet is a source register and legal-review agenda, not authority for a legal conclusion. This pack relies only on:

- existing repository governance records, including [current system behavior](./CURRENT_SYSTEM.md), the [workforce access-control baseline](./ACCESS_CONTROL_BASELINE.md), the [Sprint 16 governance proposal](./PRODUCTION_READINESS_GOVERNANCE.md), the [canonical register](./REQUIREMENTS.md), and [operation traceability](./TRACEABILITY.md);
- the product-owner review record in [issue #41](https://github.com/wku572/hakimi-healthcare-platform/issues/41);
- the Ethiopian Ministry of Justice [publication page for Personal Data Protection Proclamation No. 1321/2024](https://justice.gov.et/en/law/personal-data-protection-proclamation/) and its [official proclamation PDF](https://justice.gov.et/wp-content/uploads/2025/04/seasiisia-seusiNse%C2%A1-1321-2016.pdf).

The Ministry publication confirms that the official instrument exists and provides its text. This pack does not interpret that instrument or conclude that any provision applies to a hypothetical Hakimi operator. A qualified reviewer must confirm the authoritative text, translation, scope, applicability, current guidance, and any other relevant source.

## Facts, Assumptions, And Unknowns

### Known Facts

| ID    | Verified fact                                                                                                                          | Repository evidence                                                                                                                                              | Consequence                                                                                      |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| KF-01 | Hakimi is currently a synthetic-data learning project.                                                                                 | [Current System](./CURRENT_SYSTEM.md)                                                                                                                            | No real patient data is authorized.                                                              |
| KF-02 | Sprint 15 implements workforce OIDC resource-server verification and server-derived authorization.                                     | [Access-Control Baseline](./ACCESS_CONTROL_BASELINE.md) and [Current System](./CURRENT_SYSTEM.md)                                                                | The implementation is current technical behavior, not production approval.                       |
| KF-03 | Patient authentication, patient sessions, patient recovery, and patient self-service are not implemented or authorized.                | [Access-Control Baseline](./ACCESS_CONTROL_BASELINE.md#deferred-and-blocked-decisions)                                                                           | The hypothetical boundary must remain workforce-only.                                            |
| KF-04 | The API exposes 26 documented HTTP operations: two publicly accessible health operations and 24 workforce-protected domain operations. | [Traceability](./TRACEABILITY.md)                                                                                                                                | A hypothetical review must include public probes and protected domain flows.                     |
| KF-05 | PostgreSQL stores facility, practitioner, patient-registration, appointment, reminder, and workforce authority structures.             | [Current System](./CURRENT_SYSTEM.md)                                                                                                                            | Production data inventory and legal classification remain to be reviewed.                        |
| KF-06 | Structured operational logs exclude request bodies, credentials, patient information, SQL, and raw errors.                             | [Operations Runbook](./OPERATIONS_RUNBOOK.md#privacy-boundary)                                                                                                   | Operational logs are not approved security or clinical audit evidence.                           |
| KF-07 | `OPEN-02`, `OPEN-06`, `OPEN-07`, `OPEN-08`, `OPEN-10`, and `OPEN-12` remain pending.                                                   | [Sprint 16 Governance](./PRODUCTION_READINESS_GOVERNANCE.md#decision-governance) and [issue #41](https://github.com/wku572/hakimi-healthcare-platform/issues/41) | No dependent policy or production gate may be treated as approved.                               |
| KF-08 | No production operating entity, deployment target, vendor, location, facility, or operational owner is approved.                       | [Sprint 16 Governance](./PRODUCTION_READINESS_GOVERNANCE.md#open-12-deployment-target-and-operational-ownership)                                                 | Responsibility, jurisdiction, contracting, transfer, and operational conclusions cannot be made. |

### Hypothetical Assumptions For Review Only

| ID    | Hypothetical assumption                                                                                                        | Why it is included                                                                   | Approval effect |
| ----- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | --------------- |
| HA-01 | Authorized workforce users could use a browser or workforce client to call the existing API for registration and scheduling.   | Provides a bounded human-to-system flow for review.                                  | None            |
| HA-02 | A future operator could deploy the API, PostgreSQL database, and reminder worker in a controlled environment.                  | Allows hosting and responsibility questions to be identified.                        | None            |
| HA-03 | A future external identity service could authenticate workforce users while Hakimi derives roles and scopes from its database. | Matches current resource-server architecture without selecting an identity provider. | None            |
| HA-04 | Workforce users could enter synthetic representations of patient demographics, facility registrations, and appointments.       | Allows minimum-purpose and data-classification review.                               | None            |
| HA-05 | Operations personnel could observe aggregate health and privacy-safe diagnostic events.                                        | Allows support, monitoring, and incident questions to be identified.                 | None            |
| HA-06 | Backups, external communications, audit storage, and production monitoring might be required later.                            | Makes currently absent vendor and location decisions visible.                        | None            |

No hypothetical assumption is a product requirement, architecture selection, legal fact, or production authorization.

### Unknown Or Unselected Facts

| Fact needed for review                                                                                          | Current value    |
| --------------------------------------------------------------------------------------------------------------- | ---------------- |
| Production operating entity, legal form, registration, address, and officers                                    | `NOT SELECTED`   |
| Controller, processor, joint-controller, healthcare-provider, or facility-operator roles                        | `NOT DETERMINED` |
| Countries or jurisdictions connected to a future operator, workforce, patients, facilities, vendors, or support | `NOT DETERMINED` |
| Production healthcare facilities and facility types                                                             | `NOT SELECTED`   |
| Patient population, age groups, minors, guardians, or vulnerable groups                                         | `NOT DETERMINED` |
| Hosting provider, service model, region, availability zones, and physical locations                             | `NOT SELECTED`   |
| Database, backup, archival, disaster-recovery, and restore locations                                            | `NOT SELECTED`   |
| Support, administration, monitoring, security-operations, and incident-response locations                       | `NOT SELECTED`   |
| Workforce identity provider, hosting location, and support model                                                | `NOT SELECTED`   |
| Email, SMS, voice, or other reminder communications provider and locations                                      | `NOT SELECTED`   |
| Production vendors, subprocessors, contracts, and transfer mechanisms                                           | `NOT SELECTED`   |
| Applicable laws, regulations, licenses, registrations, directives, or regulator procedures                      | `NOT DETERMINED` |
| Lawful basis for any proposed processing purpose                                                                | `NOT DETERMINED` |
| Retention periods, deletion deadlines, legal holds, and record-preservation rules                               | `NOT DETERMINED` |
| Named privacy, legal, security, clinical, data, service, and operations owners                                  | `NOT SELECTED`   |
| Production identity, secret, key, monitoring, alerting, and on-call design                                      | `NOT SELECTED`   |

## Operating-Entity Facts Required

The following evidence must exist before responsibility or applicability review can be completed:

| Required fact                                  | Evidence expected                                                                                              | Current status   |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------- |
| Legal identity and form                        | Registration evidence, legal name, form, address, and operating authority                                      | `NOT SELECTED`   |
| Product and healthcare role                    | Approved description of whether the entity operates software, facilities, healthcare services, or another role | `NOT DETERMINED` |
| Decision-making authority                      | Evidence of who determines purposes, means, access, vendors, retention, and patient-record handling            | `NOT DETERMINED` |
| Contracting relationships                      | Proposed agreements with facilities, practitioners, vendors, support providers, and any partners               | `NOT SELECTED`   |
| Geographic footprint                           | Entity, staff, patient, facility, hosting, support, and vendor locations                                       | `NOT DETERMINED` |
| Accountable officers                           | Named product, privacy, security, clinical, data, and operations authorities                                   | `NOT SELECTED`   |
| Insurance, licensing, and registration posture | Qualified review of required evidence for the selected operating model                                         | `NOT DETERMINED` |

## Hypothetical Workforce-Only System Boundary

### Included Components

- A workforce browser or client operated by an authorized workforce user.
- An external workforce identity service: `NOT SELECTED`.
- The Hakimi API and its existing health and workforce-protected operations.
- PostgreSQL holding synthetic domain and workforce authority records.
- The reminder worker using the existing development-safe delivery boundary; no production communications provider is selected.
- Privacy-safe stdout and stderr diagnostics that a future monitoring destination could consume; destination: `NOT SELECTED`.
- Operational administration and support functions: locations and owners `NOT SELECTED`.

### Explicitly Outside The Boundary

- Patient login, credentials, MFA, sessions, recovery, and self-service.
- Patient-operated applications or patient-derived authorization context.
- Real reminder transport, clinical records, payments, claims, analytics exports, or third-party clinical integrations.
- Production audit storage, backup service, hosted monitoring, or identity-provider selection.
- Production facilities, vendors, contracts, regions, and operational ownership.
- Any use of real patient data.

### Intended Actors

| Actor                        | Current or hypothetical role                 | Data boundary                                                       | Status                                                          |
| ---------------------------- | -------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------- |
| Anonymous health probe       | Calls liveness or readiness only             | Aggregate availability status; no domain records                    | Existing technical behavior                                     |
| `PLATFORM_ADMIN`             | Workforce platform administration            | No routine patient or appointment access                            | Existing synthetic authorization behavior                       |
| `FACILITY_ADMIN`             | Facility-scoped workforce administration     | Minimum facility registration and scheduling data in assigned scope | Existing synthetic authorization behavior                       |
| `SCHEDULER`                  | Facility-scoped registration and scheduling  | Minimum demographics and appointment data in assigned scope         | Existing synthetic authorization behavior                       |
| `PRACTITIONER`               | Own facility and appointment relationships   | Standalone patient-record access remains blocked                    | Existing synthetic authorization behavior                       |
| `OPERATIONS_OPERATOR`        | Operational access                           | No patient or appointment access                                    | Existing synthetic authorization behavior                       |
| Reminder worker              | Processes database-backed reminder jobs      | Minimum reminder state needed for the existing task                 | Existing synthetic behavior; production delivery `NOT SELECTED` |
| Platform or support operator | Hypothetical deployment and support function | Access model, location, and production authority `NOT DETERMINED`   | Hypothetical only                                               |
| Patient                      | No active system actor                       | No authentication or self-service                                   | Explicitly blocked                                              |

## Proposed Data Categories And Classifications

These are governance proposals from the Sprint 16 classification model, not legal classifications.

| Proposed classification | Example categories in the hypothetical model                                                                            | Handling question                                                                           | Legal classification |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | -------------------- |
| `PUBLIC`                | Liveness and aggregate readiness outcomes; approved public documentation                                                | What metadata can probes disclose without exposing topology?                                | `NOT DETERMINED`     |
| `INTERNAL`              | Architecture records, non-sensitive build metadata, facility service metadata where approved                            | Which staff and vendors need access?                                                        | `NOT DETERMINED`     |
| `RESTRICTED_WORKFORCE`  | Practitioner contact fields, workforce actor references, role and facility scopes                                       | Which identity, employment, licensure, and purpose controls are required?                   | `NOT DETERMINED`     |
| `RESTRICTED_PATIENT`    | Patient UUID, facility MRN, demographics, contact and address data, registrations, appointments, reminder relationships | Which fields are minimum necessary for each approved purpose?                               | `NOT DETERMINED`     |
| `RESTRICTED_SECURITY`   | Tokens, credentials, keys, session material, recovery material, and secret configuration                                | Which secret-management, access, rotation, and destruction controls are required?           | `NOT DETERMINED`     |
| `RESTRICTED_AUDIT`      | Proposed security and clinical audit evidence                                                                           | Which events, identifiers, integrity controls, reviewers, and retention rules are approved? | `NOT DETERMINED`     |

## Hypothetical Processing-Purpose Register

Every entry is a review hypothesis. No lawful basis, controller, processor, retention period, or production owner is determined.

| Purpose ID | Hypothetical purpose                                                    | Actors                                                 | Minimum proposed categories                         | Lawful basis     | Owner          | Evidence needed                                                                          |
| ---------- | ----------------------------------------------------------------------- | ------------------------------------------------------ | --------------------------------------------------- | ---------------- | -------------- | ---------------------------------------------------------------------------------------- |
| HYP-P01    | Maintain liveness and readiness visibility                              | Health probe, operations                               | `PUBLIC`, limited `INTERNAL`                        | `NOT DETERMINED` | `NOT SELECTED` | Approved probe disclosure and operations purpose                                         |
| HYP-P02    | Authenticate workforce and enforce server-derived access                | Workforce users, identity service, API                 | `RESTRICTED_WORKFORCE`, `RESTRICTED_SECURITY`       | `NOT DETERMINED` | `NOT SELECTED` | Identity relationship, role authority, MFA, revocation, and notice review                |
| HYP-P03    | Maintain facility and practitioner directory and roster                 | Platform and facility workforce                        | `INTERNAL`, `RESTRICTED_WORKFORCE`                  | `NOT DETERMINED` | `NOT SELECTED` | Facility relationship, field ownership, and minimum-necessary review                     |
| HYP-P04    | Register a patient at a facility                                        | Facility administrator, scheduler                      | `RESTRICTED_PATIENT`                                | `NOT DETERMINED` | `NOT SELECTED` | Approved identity, MRN, notice, purpose, and duplicate-handling policy                   |
| HYP-P05    | Schedule and manage appointments                                        | Facility administrator, scheduler, scoped practitioner | `RESTRICTED_PATIENT`, `RESTRICTED_WORKFORCE`        | `NOT DETERMINED` | `NOT SELECTED` | Approved appointment and practitioner-access policy                                      |
| HYP-P06    | Orchestrate appointment reminders without selecting a delivery provider | Reminder worker                                        | `RESTRICTED_PATIENT`, limited `INTERNAL`            | `NOT DETERMINED` | `NOT SELECTED` | Approved reminder purpose, channel, content, recipient, and vendor policy                |
| HYP-P07    | Diagnose reliability and security failures                              | Operations and security functions                      | `INTERNAL`; proposed `RESTRICTED_AUDIT`             | `NOT DETERMINED` | `NOT SELECTED` | Approved logging, audit, incident, access, and retention policy                          |
| HYP-P08    | Back up and restore service data                                        | Database and platform operations                       | All stored classes, encrypted and access-controlled | `NOT DETERMINED` | `NOT SELECTED` | Approved recovery objectives, locations, retention, restore, hold, and deletion controls |
| HYP-P09    | Respond to data-subject requests                                        | Privacy and patient-identity functions                 | `RESTRICTED_PATIENT`, `RESTRICTED_AUDIT`            | `NOT DETERMINED` | `NOT SELECTED` | Applicable rights, identity verification, exceptions, timing, and evidence workflow      |

## Conceptual Data Flow And Trust Boundaries

This is a conceptual narrative, not a selected deployment diagram.

1. A workforce user hypothetically authenticates with an external workforce identity service. The provider, client, hosting location, support location, and contractual role are `NOT SELECTED`.
2. The workforce client hypothetically sends a bearer access token to the Hakimi API over a protected network path. The production network, endpoint, certificate, gateway, and edge provider are `NOT SELECTED`.
3. The API validates identity evidence and derives current roles, facility scope, activation, revocation, and session state from PostgreSQL. Token claims do not create mutable authorization authority.
4. The API applies facility and relationship scope before reading or mutating synthetic facility, practitioner, patient-registration, or appointment records.
5. The API and reminder worker exchange state only through PostgreSQL. No queue, notification provider, or production communications path is selected.
6. The API and worker emit privacy-safe diagnostics to stdout or stderr. A production collector, monitoring destination, operator, and location are `NOT SELECTED`.
7. A hypothetical backup process could copy encrypted database state to a backup boundary. The service, region, keys, administrators, retention, legal hold, and destruction process are `NOT SELECTED`.
8. A hypothetical rights or incident process could require controlled review of domain and audit references. That workflow, authority, evidence store, and reviewer location are `NOT DETERMINED`.

### Trust Boundaries Requiring Review

| Boundary                                  | Data crossing                                                            | Required decision questions                                                                  | Current status   |
| ----------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- | ---------------- |
| Workforce user to identity service        | Credentials, factors, identity and session evidence                      | Who operates it, where, under what contract, and with what recovery and breach controls?     | `NOT SELECTED`   |
| Workforce client to API                   | Access token and domain requests                                         | Where is the client, endpoint, gateway, and TLS termination; what metadata is retained?      | `NOT SELECTED`   |
| API and worker to PostgreSQL              | Domain, authority, session, and reminder records                         | Who hosts and administers the database, keys, replicas, and network?                         | `NOT SELECTED`   |
| Runtime to monitoring                     | Privacy-safe diagnostic events                                           | Is the collector a processor or other recipient; where are collection and support performed? | `NOT DETERMINED` |
| Database to backup and archive            | Encrypted stored record set                                              | Where are copies, keys, restores, holds, and expiry managed?                                 | `NOT SELECTED`   |
| Operator to support or incident responder | Configuration, diagnostics, and potentially controlled record references | Which support locations, privileges, approvals, and evidence controls apply?                 | `NOT DETERMINED` |
| Hakimi to communications provider         | Reminder destination and content if later approved                       | Which channel, recipient, provider, location, and transfer rule applies?                     | `NOT SELECTED`   |

## Controller And Processor Responsibility Questions

No responsibility role is assigned. Qualified reviewers must determine:

1. Which entity would determine each processing purpose and essential means?
2. Whether a facility, future Hakimi operator, or another party would act as controller, processor, joint controller, healthcare provider, software provider, or another legally defined role.
3. Whether responsibility changes by purpose, facility relationship, patient identity record, support action, reminder, or audit event.
4. Which party would issue notices, establish lawful basis, answer rights requests, approve vendors, define retention, and report incidents.
5. Which party would own patient identity linkage, MRN assignment, duplicate review, merge, correction, and disputes.
6. Which contracts, instructions, allocation terms, security schedules, audit rights, return or deletion terms, and liability provisions would be required.
7. Whether multiple facilities or partners would jointly determine any purpose or means.
8. Which named authority could accept residual privacy, clinical, security, and operational risk.

## Proposed Vendor And Subprocessor Register

This register identifies vendor categories only. It does not select or approve a vendor or determine a legal role.

| Service category                               | Provider       | Potential data                                                          | Processing and support locations | Contractual role | Evidence required                                                                             |
| ---------------------------------------------- | -------------- | ----------------------------------------------------------------------- | -------------------------------- | ---------------- | --------------------------------------------------------------------------------------------- |
| Production hosting and network                 | `NOT SELECTED` | `NOT DETERMINED`                                                        | `NOT SELECTED`                   | `NOT DETERMINED` | Architecture, locations, security evidence, terms, subprocessors, exit plan                   |
| Managed database, if used                      | `NOT SELECTED` | Stored domain and authority classes                                     | `NOT SELECTED`                   | `NOT DETERMINED` | Encryption, administrators, replicas, backup, deletion, restore, subprocessors                |
| Backup or archive service                      | `NOT SELECTED` | Encrypted stored record set                                             | `NOT SELECTED`                   | `NOT DETERMINED` | Regions, keys, retention, legal hold, restore, destruction, exit evidence                     |
| Workforce identity service                     | `NOT SELECTED` | Workforce identity, authentication, and session evidence                | `NOT SELECTED`                   | `NOT DETERMINED` | MFA, lifecycle, recovery, breach, logs, support, subprocessor evidence                        |
| Monitoring and security tooling                | `NOT SELECTED` | Privacy-safe diagnostics; audit data only if separately approved        | `NOT SELECTED`                   | `NOT DETERMINED` | Field allowlist, locations, access, retention, alerting, incident and deletion terms          |
| Communications or reminder delivery            | `NOT SELECTED` | Recipient destination and approved reminder content                     | `NOT SELECTED`                   | `NOT DETERMINED` | Channel policy, location, delivery metadata, subprocessors, retention and failure handling    |
| Customer or facility support tooling           | `NOT SELECTED` | `NOT DETERMINED`; patient content prohibited unless separately approved | `NOT SELECTED`                   | `NOT DETERMINED` | Access controls, redaction, recording, support location, retention, breach and deletion terms |
| Legal, privacy, security, or clinical reviewer | `NOT SELECTED` | Minimum evidence required for review                                    | `NOT SELECTED`                   | `NOT DETERMINED` | Qualifications, confidentiality, conflict, access, retention, and work-product terms          |

## Location And Transfer Questions

### Hosting, Support, Backup, Monitoring, Identity, And Communications

| Function                           | Primary location | Replicas or failover               | Administrative or support access | Required reviewer question                                                           |
| ---------------------------------- | ---------------- | ---------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------ |
| API and worker hosting             | `NOT SELECTED`   | `NOT SELECTED`                     | `NOT SELECTED`                   | Which locations and entities process service traffic and diagnostics?                |
| PostgreSQL                         | `NOT SELECTED`   | `NOT SELECTED`                     | `NOT SELECTED`                   | Where are primary, replica, maintenance, and recovery operations performed?          |
| Backups and archives               | `NOT SELECTED`   | `NOT SELECTED`                     | `NOT SELECTED`                   | Where are copies and keys stored, restored, held, and destroyed?                     |
| Monitoring and security operations | `NOT SELECTED`   | `NOT SELECTED`                     | `NOT SELECTED`                   | Where are logs, alerts, support, and incident evidence accessed?                     |
| Workforce identity                 | `NOT SELECTED`   | `NOT SELECTED`                     | `NOT SELECTED`                   | Where are credentials, identity records, factors, sessions, and recovery processed?  |
| Reminder communications            | `NOT SELECTED`   | `NOT SELECTED`                     | `NOT SELECTED`                   | Where are recipient details, content, delivery metadata, and support processed?      |
| Facility and workforce support     | `NOT SELECTED`   | Not applicable or `NOT DETERMINED` | `NOT SELECTED`                   | Can support access domain records, and what approval and location constraints apply? |

### Cross-Border Transfer Questions

1. Which source, destination, transit, replication, backup, support, and remote-administration countries would be involved?
2. Which data categories and data subjects would be transferred or remotely accessed?
3. Which entity initiates, controls, receives, or supports each transfer?
4. Does the selected operating model create localization, approval, notification, contractual, safeguard, or documentation requirements?
5. What authoritative mechanism and evidence would permit each transfer, if any?
6. Do identity, monitoring, communications, support, source-control, incident, or ticketing services create transfers even when application hosting is local?
7. How would onward transfers and vendor subprocessors be discovered, approved, monitored, and changed?
8. How would suspension, exit, return, deletion, and proof of destruction work if transfer authority ends?

Every answer is currently `NOT DETERMINED` because no entity, provider, contract, location, or transfer has been selected.

## Retention-Category Questions

No duration is proposed or implied.

| Category                                                          | Retention trigger | Duration         | Archive rule     | Deletion and backup treatment | Legal hold       | Owner          |
| ----------------------------------------------------------------- | ----------------- | ---------------- | ---------------- | ----------------------------- | ---------------- | -------------- |
| Patient identity and facility registrations                       | `NOT DETERMINED`  | `NOT DETERMINED` | `NOT DETERMINED` | `NOT DETERMINED`              | `NOT DETERMINED` | `NOT SELECTED` |
| Appointments and lifecycle history                                | `NOT DETERMINED`  | `NOT DETERMINED` | `NOT DETERMINED` | `NOT DETERMINED`              | `NOT DETERMINED` | `NOT SELECTED` |
| Reminder processing records                                       | `NOT DETERMINED`  | `NOT DETERMINED` | `NOT DETERMINED` | `NOT DETERMINED`              | `NOT DETERMINED` | `NOT SELECTED` |
| Workforce actors, roles, and sessions                             | `NOT DETERMINED`  | `NOT DETERMINED` | `NOT DETERMINED` | `NOT DETERMINED`              | `NOT DETERMINED` | `NOT SELECTED` |
| Security and clinical audit evidence                              | `NOT DETERMINED`  | `NOT DETERMINED` | `NOT DETERMINED` | `NOT DETERMINED`              | `NOT DETERMINED` | `NOT SELECTED` |
| Operational diagnostics                                           | `NOT DETERMINED`  | `NOT DETERMINED` | `NOT DETERMINED` | `NOT DETERMINED`              | `NOT DETERMINED` | `NOT SELECTED` |
| Backups, replicas, exports, and recovery artifacts                | `NOT DETERMINED`  | `NOT DETERMINED` | `NOT DETERMINED` | `NOT DETERMINED`              | `NOT DETERMINED` | `NOT SELECTED` |
| Consent, notice, rights-request, complaint, and decision evidence | `NOT DETERMINED`  | `NOT DETERMINED` | `NOT DETERMINED` | `NOT DETERMINED`              | `NOT DETERMINED` | `NOT SELECTED` |

Reviewers must identify category-specific legal and business triggers, minimum and maximum periods where applicable, medical-record implications, patient-rights interactions, legal holds, deletion authority, backup expiry, downstream copies, and evidence of disposal.

## Data-Subject Rights Workflow Questions

No rights workflow or response period is approved.

| Workflow stage                      | Required question                                                                                                                | Current status   |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| Intake                              | Which channels, languages, accessibility controls, and entity receive a request?                                                 | `NOT DETERMINED` |
| Identity and authority verification | How is the requester verified without collecting disproportionate additional data; how are guardians or representatives handled? | `NOT DETERMINED` |
| Scope and search                    | Which systems, facilities, aliases, backups, vendors, and audit records must be searched?                                        | `NOT DETERMINED` |
| Legal triage                        | Which right, exception, restriction, preservation duty, or third-party interest applies?                                         | `NOT DETERMINED` |
| Facility coordination               | Which party responds when facilities and a platform operator share records or responsibility?                                    | `NOT DETERMINED` |
| Fulfilment                          | What secure format and channel provide access, correction, restriction, objection, portability, or deletion where applicable?    | `NOT DETERMINED` |
| Patient identity correction         | How are duplicates, aliases, merges, unmerges, MRNs, and conflicting facility data resolved safely?                              | `NOT DETERMINED` |
| Timing and escalation               | What response, extension, escalation, complaint, and appeal periods apply?                                                       | `NOT DETERMINED` |
| Evidence                            | What minimum event proves receipt, verification, decision, fulfilment, and communication without copying sensitive content?      | `NOT DETERMINED` |
| Vendor execution                    | How are approved requests propagated to processors, subprocessors, exports, replicas, and backup lifecycle?                      | `NOT DETERMINED` |

## Security, Breach, DPIA, DPO, And Registration Questions

| Topic                                | Existing technical evidence                                                                                                                            | Required qualified determination                                                                                                     | Current status    |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ | ----------------- |
| Security safeguards                  | Strict validation, parameterized SQL, privacy-safe errors and logs, workforce MFA requirement, server-derived authorization, revocation, and CI checks | Which production organizational and technical controls, assurance tests, risk acceptance, and evidence are required?                 | `NOT DETERMINED`  |
| Security and clinical audit          | Operational logging exists; durable audit policy and storage do not                                                                                    | Which events, fields, integrity, access, review, alert, failure, and retention controls are required?                                | `OPEN-06 PENDING` |
| Incident and breach response         | Operational diagnostics and runbook foundations exist                                                                                                  | What constitutes an incident or breach, who assesses it, who must be notified, on what timeline, with what content and preservation? | `NOT DETERMINED`  |
| DPIA or equivalent assessment        | Sprint 16 proposes a risk-review gate                                                                                                                  | Is an assessment required for the selected model, who performs and approves it, and what residual risk is acceptable?                | `NOT DETERMINED`  |
| DPO or privacy role                  | Proposed RACI includes a privacy function but no named owner                                                                                           | Is a designated role required, what qualifications, independence, reporting, resources, and contact channels apply?                  | `NOT DETERMINED`  |
| Controller or processor registration | No production entity or legal role is selected                                                                                                         | Must any entity register or file before processing; with whom, when, and using what evidence?                                        | `NOT DETERMINED`  |
| Records of processing                | Hypothetical purpose and flow registers are incomplete                                                                                                 | What inventory, purpose, lawful basis, recipient, transfer, retention, and safeguard records are required?                           | `NOT DETERMINED`  |
| Vendor assurance                     | No production vendor is selected                                                                                                                       | Which due-diligence, contract, subprocessor, audit, breach, deletion, continuity, and exit controls are mandatory?                   | `NOT DETERMINED`  |
| Business continuity                  | Health checks and container validation exist                                                                                                           | Which service and recovery objectives, backups, restore tests, manual procedures, and clinical-safety controls are required?         | `NOT DETERMINED`  |

Passing tests, audits, container builds, schema checks, or security reviews is technical evidence only. It cannot determine legal applicability, approve an operating entity, pass a production gate, authorize deployment, or authorize real patient-data processing.

## Evidence Gaps And Reviewer Assignments

No reviewer or production owner is selected. Assignments below identify required expertise, not a person or organization.

| Evidence gap                                         | Required reviewer function                                                                         | Named reviewer | Deliverable                                                                                                                      | Dependencies                                                         | Status  |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ------- |
| Operating entity and business-role facts             | Product authority and qualified legal reviewer                                                     | `NOT SELECTED` | Verified entity, role, registrations, contracts, facilities, users, and geographic facts                                         | Operating-model selection                                            | Missing |
| Legal and regulatory applicability                   | Qualified counsel with relevant jurisdictional, healthcare, and data-protection expertise          | `NOT SELECTED` | Scoped memorandum citing authoritative sources, facts, conclusions, assumptions, exclusions, effective date, and review triggers | All operating-model and flow facts                                   | Missing |
| Privacy purposes, notices, consent cases, and rights | Privacy, clinical, product, and qualified legal reviewers                                          | `NOT SELECTED` | Approved purpose and processing inventory, notices, rights workflow, recipients, and safeguards                                  | `OPEN-02`, `OPEN-10`                                                 | Missing |
| Security and clinical audit policy                   | Security, clinical safety, privacy, operations, and qualified legal reviewers                      | `NOT SELECTED` | Approved event catalogue, field exclusions, atomicity, integrity, review, failure, and access model                              | `OPEN-06`, `OPEN-07`, `OPEN-10`                                      | Missing |
| Retention, deletion, backup, and legal hold          | Records, privacy, clinical, operations, security, and qualified legal reviewers                    | `NOT SELECTED` | Category schedule with triggers, periods, archive, hold, deletion, backup, owner, and evidence rules                             | `OPEN-06`, `OPEN-07`, `OPEN-10`, `OPEN-12`                           | Missing |
| Patient identity and multi-facility ownership        | Clinical safety, patient administration, privacy, security, product, and qualified legal reviewers | `NOT SELECTED` | Matching, duplicate, link, merge, unmerge, provenance, ownership, and correction policy                                          | `OPEN-02`, `OPEN-07`, `OPEN-08`, `OPEN-10`                           | Missing |
| Hosting, vendors, locations, transfers, and RACI     | Service, platform, security, privacy, data, procurement, operations, and qualified legal reviewers | `NOT SELECTED` | Selected target, architecture, location inventory, vendor register, transfer analysis, contracts, named RACI, and exit plan      | `OPEN-10`, `OPEN-12`                                                 | Missing |
| Clinical and healthcare obligations                  | Qualified clinical-safety and healthcare regulatory reviewers                                      | `NOT SELECTED` | Facility, practitioner, patient-safety, medical-record, communications, and professional-responsibility assessment               | Operating entity, facilities, users, `OPEN-01`, `OPEN-09`, `OPEN-11` | Missing |

Evidence is reviewable only when it identifies the author and qualifications, states facts and assumptions, cites authoritative sources and dates, separates legal conclusions from recommendations, records unresolved questions and dependencies, and contains no patient data, credentials, secrets, or unnecessary operational detail.

## Decision And Production Gates

| Decision  | Status after this evidence pack | Why it remains open                                                                |
| --------- | ------------------------------- | ---------------------------------------------------------------------------------- |
| `OPEN-02` | `PENDING`                       | No approved purpose, notice, consent, minimum-necessary, or rights policy          |
| `OPEN-06` | `PENDING`                       | No approved audit-event, review, integrity, or retention policy                    |
| `OPEN-07` | `PENDING`                       | No approved period, archive, deletion, backup, or legal-hold schedule              |
| `OPEN-08` | `PENDING`                       | No approved patient identity, duplicate, merge, or multi-facility ownership policy |
| `OPEN-10` | `PENDING`                       | No selected operating model or qualified applicability determination               |
| `OPEN-12` | `PENDING`                       | No selected deployment target, vendor, location, owner, or RACI assignment         |

All production and real-patient-data gates in the [Sprint 16 governance proposal](./PRODUCTION_READINESS_GOVERNANCE.md#production-and-real-patient-data-gates) remain `BLOCKED`. `OPEN-01`, `OPEN-09`, and `OPEN-11` also remain separate blockers for production scopes that use healthcare, appointment, or reminder workflows.

## Qualified Review Questions

The selected qualified reviewers must answer and cite authoritative evidence for at least these questions:

1. Which entity, jurisdictions, legal roles, healthcare roles, and facts define the proposed operating model?
2. Which authoritative laws, regulations, directives, licenses, professional rules, contracts, and regulator procedures apply, and from what effective date?
3. Which processing purpose, data category, recipient, and actor has which lawful basis, notice, consent case, and minimum-necessary fields?
4. Which rights, verification, response, exception, complaint, correction, and evidence workflows are required?
5. Which security, audit, breach, risk-assessment, DPO, registration, and regulator-engagement duties apply?
6. Which controller, processor, joint-controller, facility, practitioner, vendor, and subprocessor responsibilities and contracts are required?
7. Which hosting, support, backup, monitoring, identity, communications, remote-access, and transfer locations are permitted under what conditions?
8. Which category-specific retention, archival, deletion, backup-expiry, legal-hold, and medical-record obligations apply?
9. Which patient identity, duplicate, merge, ownership, correction, minor, guardian, and cross-facility rules are required?
10. Which unresolved facts or approvals still block a synthetic pilot, production deployment, or real patient-data processing?

## Review Outcome

This pack is ready only as structured input to qualified review. It does not justify selecting `APPROVE`, `REVISE`, or `REJECT` for `OPEN-10` or any related decision. Record any later outcome independently in [issue #41](https://github.com/wku572/hakimi-healthcare-platform/issues/41), including the decision date, accountable authority, reviewer evidence, assumptions, conclusions, and explicit remaining dependencies.

Until that evidence is reviewed and every applicable gate receives separate approval:

- keep all six Sprint 16 decisions `PENDING`;
- keep all production gates `BLOCKED`;
- use synthetic data only;
- do not create a production implementation branch;
- do not deploy Hakimi to production; and
- do not process real patient data.
