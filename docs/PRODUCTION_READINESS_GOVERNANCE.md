# Sprint 16 Production-Readiness And Data-Governance Proposal

## Document Status

- Status: `PROPOSED FOR REVIEW`
- Change type: documentation and decision package only
- Production deployment: `NOT AUTHORIZED`
- Real patient-data processing: `NOT AUTHORIZED`
- Governing open decisions: [OPEN-02](./REQUIREMENTS.md), [OPEN-06](./REQUIREMENTS.md), [OPEN-07](./REQUIREMENTS.md), [OPEN-08](./REQUIREMENTS.md), [OPEN-10](./REQUIREMENTS.md), and [OPEN-12](./REQUIREMENTS.md)
- Current technical baseline: Sprint 15 workforce access control is implemented for synthetic data, but it is not evidence of production approval.

This document proposes controls and decision choices. It does not resolve an OPEN record, establish a legal conclusion, assign a named person, select a regulator or hosting provider, set a retention period, or authorize production use. An accountable authority must record decision evidence separately before any proposal becomes governing policy.

## Decision Governance

Each decision is independent. Approval of one item does not approve its dependencies. A dated product-owner outcome may be `APPROVE`, `REVISE`, or `REJECT`; outcome authority and evidence must be recorded for any outcome, not only for approval. `OPEN-10` and `OPEN-12` now have product-owner authority and evidence for `REVISE`, while qualified external-review evidence and required implementation facts remain incomplete. Their implementation/governance selections remain `PENDING`, and production gates remain `BLOCKED`.

| Decision  | Independent subject                                                                  | Current status  | Recorded product-owner outcome | Accountable approval authority                                       | Required consultation                                                               | Recorded selection |
| --------- | ------------------------------------------------------------------------------------ | --------------- | ------------------------------ | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------ |
| `OPEN-02` | Privacy, consent, lawful purpose, and minimum necessary access                       | `OPEN DECISION` | `NOT RECORDED`                 | Product Decision Authority                                           | Privacy, clinical, security, and legal reviewers                                    | `PENDING`          |
| `OPEN-06` | Security and clinical audit events, review, and evidence handling                    | `OPEN DECISION` | `NOT RECORDED`                 | Product Decision Authority                                           | Security, clinical safety, privacy, operations, and legal reviewers                 | `PENDING`          |
| `OPEN-07` | Retention, archival, deletion, backup, and legal hold                                | `OPEN DECISION` | `NOT RECORDED`                 | Product Decision Authority                                           | Privacy, records-management, clinical, operations, security, and legal reviewers    | `PENDING`          |
| `OPEN-08` | Patient identity, duplicate resolution, linking, merge, and multi-facility ownership | `OPEN DECISION` | `NOT RECORDED`                 | Product Decision Authority                                           | Clinical safety, patient administration, privacy, security, and legal reviewers     | `PENDING`          |
| `OPEN-10` | Applicable legal and regulatory requirements                                         | `OPEN DECISION` | `REVISE`                       | Product Decision Authority; approval requires qualified legal advice | Qualified legal, regulatory, privacy, clinical, and security reviewers              | `PENDING`          |
| `OPEN-12` | Deployment target and operational ownership                                          | `OPEN DECISION` | `REVISE`                       | Product Decision Authority                                           | Service, platform, security, privacy, clinical safety, data, and legal stakeholders | `PENDING`          |

For each record, product-owner review must record exactly one outcome and attach dated outcome evidence:

- `APPROVE`: accept the proposed resolution and its dependencies without filling unresolved details by implication.
- `REVISE`: return exact changes, owners, and evidence needed before another review.
- `REJECT`: record why the proposal is unsuitable and whether a replacement is required.

The recorded product-owner outcomes for `OPEN-10` and `OPEN-12` are `REVISE`, but the implementation and governance selections remain `PENDING` because required revision evidence, implementation facts, and qualified external findings are incomplete. No other Sprint 16 outcome is recorded in this package.

### Related Decisions Outside Sprint 16

This package does not resolve [OPEN-01](./REQUIREMENTS.md) healthcare and business workflow rules, [OPEN-09](./REQUIREMENTS.md) appointment policy, or [OPEN-11](./REQUIREMENTS.md) reminder policy. They remain independent blockers for any production scope that uses the affected workflow. The six Sprint 16 decisions are necessary governance inputs, not a complete product authorization by themselves.

## OPEN-02: Privacy, Consent, Lawful Purpose, And Minimum Necessary Access

### Current Evidence

- Runtime errors and structured logs use privacy-safe boundaries, request bodies are not logged, and access is default deny.
- Workforce access is facility-scoped, while patient authentication and self-service remain blocked.
- The repository has no approved privacy notice, consent model, lawful-purpose catalogue, patient-rights process, or production data-use authorization.

### Proposed Resolution

Adopt a purpose-bound privacy model before real data is introduced:

1. Maintain an approved purpose catalogue for registration, scheduling, care coordination, security, operations, and legally required processing.
2. Associate every production access path with one approved purpose, actor class, minimum data set, and accountable owner.
3. Distinguish consent from other lawful grounds; do not treat consent as the universal basis or infer a basis before `OPEN-10` review.
4. Present approved notice before collection where required, and version notice or consent evidence without storing clinical narrative in the consent record.
5. Collect only fields required for the approved purpose and deny secondary use by default.
6. Provide a reviewed process for access, correction, objection, restriction, withdrawal, and complaint requests where applicable.
7. Prohibit production support staff, platform operators, and logs from exposing patient content unless a separately approved exception applies.
8. Require privacy review for exports, analytics, integrations, new fields, and cross-facility sharing.

### Alternatives

- Purpose catalogue with consent only where legally or clinically appropriate, as proposed.
- Consent-centric processing for every purpose, which risks invalid or impractical consent.
- Broad operational purpose without per-operation mapping, which is simpler but conflicts with minimum-necessary governance.

### Risks And Dependencies

- `OPEN-10` must establish applicable lawful grounds, notices, patient rights, age or capacity rules, and cross-border restrictions.
- `OPEN-06` must make access and consent events reviewable without over-collecting sensitive content.
- `OPEN-07` must govern privacy evidence and request records.
- `OPEN-08` must prevent privacy choices from attaching to the wrong patient.
- Unbounded consent capture could create sensitive data without a lawful retention basis.

### Decision Choice

| Choice    | Review action                                                                                            |
| --------- | -------------------------------------------------------------------------------------------------------- |
| `APPROVE` | Accept the purpose-bound, minimum-necessary proposal subject to separately approved legal applicability. |
| `REVISE`  | Specify which purposes, notices, rights, consent cases, or responsible roles must change.                |
| `REJECT`  | Record the replacement privacy governance model and why it is safer.                                     |

Recorded selection: `PENDING`.

## OPEN-06: Security And Clinical Audit Events

### Current Evidence

- Operational JSON logs are intentionally privacy-minimized and are not clinical audit records.
- Workforce authentication, authorization, provisioning, revocation, and domain mutations exist, but no durable audit-event store, review workflow, or approved event policy exists.

### Proposed Resolution

Create separate, append-only security and clinical audit streams. Neither stream may contain request or response bodies, bearer tokens, claims, credentials, secrets, SQL, raw errors, contact details, free-text clinical content, or copied domain snapshots.

Minimum proposed event families:

| Event family             | Trigger                                                                                              | Minimum proposed evidence                                                                                                             | Explicit exclusion                                 |
| ------------------------ | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Authentication security  | Authentication success or generic rejection, session revocation, actor activation or deactivation    | Opaque event ID, UTC time, server-derived actor reference when known, event code, outcome, request ID where available                 | Token, issuer subject, claims, credential material |
| Authorization security   | Protected operation denied; high-risk grant evaluated; scope or role changed                         | Event ID, UTC time, actor reference, normalized operation, facility scope reference when required, outcome and stable reason category | Policy internals, supplied values, patient content |
| Authority administration | Actor, role, facility scope, practitioner binding, or recovery action changes                        | Event ID, UTC time, initiating actor or controlled process, action, target authority reference, outcome                               | Provisioning payload and identity-provider claims  |
| Patient access           | Patient collection or record read, registration, update, or attempted deactivation                   | Event ID, UTC time, actor reference, normalized action, patient record reference, facility context, outcome, purpose code             | Demographic snapshot, MRN, contact information     |
| Appointment activity     | Appointment creation, read, update, completion-state change, or cancellation                         | Event ID, UTC time, actor reference, appointment reference, facility context, action, outcome                                         | Reason text, patient or practitioner details       |
| Operational security     | Audit pipeline failure, integrity failure, privileged configuration change, backup or restore action | Event ID, UTC time, workload identity reference, event code, outcome                                                                  | Secrets, connection strings, backup contents       |

Proposed controls:

- Generate event IDs server-side and write audit evidence atomically with a state change or through a durable transactional outbox approved by later architecture review.
- Make records append-only, integrity-protected, access-controlled, encrypted, and independently monitored for pipeline failure.
- Define reviewer roles, review frequency, escalation thresholds, export approval, and evidence-access auditing before production.
- Record correction by linked compensating event rather than mutation.
- Treat audit access itself as auditable.

### Alternatives

- Transactional audit rows in the application database.
- Transactional outbox with a separate audit store.
- Vendor-managed immutable audit storage after `OPEN-12`, provided it meets the approved legal and privacy requirements.

### Risks And Dependencies

- Atomicity, availability, and tamper resistance differ across alternatives and require architecture review.
- Over-logging creates privacy and breach exposure; under-logging impairs safety and investigation.
- Retention depends on `OPEN-07`; event legality and evidentiary requirements depend on `OPEN-10`.
- Patient identity references depend on `OPEN-08` merge and alias semantics.

### Decision Choice

| Choice    | Review action                                                                                                           |
| --------- | ----------------------------------------------------------------------------------------------------------------------- |
| `APPROVE` | Approve the event families and privacy boundary; require a separate implementation architecture and retention decision. |
| `REVISE`  | Identify event families, fields, review controls, or atomicity requirements to change.                                  |
| `REJECT`  | Record the replacement evidence model and minimum events.                                                               |

Recorded selection: `PENDING`.

## OPEN-07: Retention, Archival, Deletion, Backup, And Legal Hold

### Current Evidence

- Facilities, practitioners, assignments, and patients use lifecycle deactivation; appointments and reminders preserve history.
- Soft deletion is not erasure, and no approved retention schedule, archival tier, hard-deletion workflow, backup lifecycle, or legal-hold process exists.

### Proposed Resolution

Adopt a record-schedule model before production. Every category must receive a documented trigger, approved retention duration, archive rule, deletion method, legal basis, accountable owner, and hold behavior. Sprint 16 intentionally supplies no durations.

| Record category                      | Proposed trigger                            | Required decision before production                                        | Deletion or disposition boundary                                            |
| ------------------------------------ | ------------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Patient identity and registrations   | End of relationship or other approved event | Duration, patient-rights interaction, identity-merge handling, legal basis | No hard deletion until linked-record and hold checks pass                   |
| Appointments and lifecycle history   | Appointment lifecycle event                 | Clinical or business record status, duration, correction policy            | Preserve referential integrity; use approved archival or disposal workflow  |
| Reminder processing records          | Terminal reminder state                     | Operational evidence need and approved duration                            | Delete or aggregate only under approved schedule                            |
| Workforce authority and sessions     | Deactivation, revocation, or expiry         | Security evidence duration and identity-provider dependency                | Remove or pseudonymize only after security and hold requirements            |
| Security and clinical audit evidence | Event occurrence                            | `OPEN-06` event class and `OPEN-10` evidentiary obligations                | Append-only during retention; controlled destruction afterward              |
| Operational logs                     | Event occurrence                            | Troubleshooting and security duration                                      | Shortest approved duration; no patient content                              |
| Backups                              | Backup creation                             | Recovery objectives, legal hold, encryption, and media lifecycle           | Expire through backup lifecycle; do not promise immediate row-level erasure |

Proposed controls:

- Freeze scheduled disposal for records within a documented legal hold; log hold placement, release, and affected categories without copying content.
- Make deletion authorized, two-person reviewed for high-risk classes, idempotent, evidenced, and recoverable only within the approved backup lifecycle.
- Propagate approved deletion to replicas, indexes, caches, exports, and downstream processors.
- Document that backup expiration, not direct mutation of immutable media, may be the deletion mechanism where legally acceptable.
- Test restore and disposal controls using synthetic data.

### Alternatives

- One uniform duration, which is simple but unlikely to fit distinct operational, clinical, security, and legal purposes.
- Category-specific schedules, as proposed.
- Indefinite retention, which maximizes historical availability but creates disproportionate privacy and security risk.

### Risks And Dependencies

- `OPEN-10` must establish mandatory minimum or maximum periods and legal-hold duties.
- `OPEN-06` must classify audit evidence.
- `OPEN-08` must define merged-patient and duplicate-record disposition.
- `OPEN-12` must assign backup, archive, restore, and disposal ownership.

### Decision Choice

| Choice    | Review action                                                                                         |
| --------- | ----------------------------------------------------------------------------------------------------- |
| `APPROVE` | Approve category-specific schedules and control requirements, leaving durations pending legal review. |
| `REVISE`  | Specify categories, triggers, disposal controls, or ownership changes.                                |
| `REJECT`  | Record a replacement retention and disposal model.                                                    |

Recorded selection: `PENDING`.

## OPEN-08: Patient Identity And Multi-Facility Ownership

### Current Evidence

- A patient has a server-generated UUID; each registration links that patient to one facility with an MRN unique within that facility.
- A patient may technically have multiple registrations, but no approved matching, linking, duplicate review, merge, unmerge, survivorship, or multi-facility write policy exists.
- Sprint 15 blocks cross-facility patient writes and global patient deactivation.

### Proposed Resolution

Use a stable platform patient identifier with facility-owned registration identifiers:

1. Keep the platform patient UUID immutable and never expose MRN as a global identity key.
2. Keep MRN ownership facility-scoped and prohibit moving or silently rewriting an MRN across facilities.
3. Allow multiple facility registrations only after an approved match-and-link workflow confirms the same person.
4. Present possible duplicates to an authorized patient-identity steward; never auto-merge solely on name, phone, email, address, date of birth, or probabilistic score.
5. Normalize comparison data without erasing the originally supplied values required for approved records.
6. Use deterministic matches only as candidate signals, not proof of identity.
7. Merge through a transaction that selects a survivor, preserves immutable aliases and provenance, re-points approved relationships, records conflicts, and emits audit evidence.
8. Provide a separately authorized unmerge or correction process for erroneous links; never destructively discard the losing record.
9. Assign each registration to its facility while platform-level identity stewardship governs links and merges.
10. Keep cross-facility demographic writes and global deactivation blocked until field ownership, conflict resolution, and patient-rights rules are approved.

Proposed duplicate-review states are `POTENTIAL`, `UNDER_REVIEW`, `LINKED`, `NOT_A_MATCH`, and `MERGED`; these are vocabulary candidates, not an approved schema.

### Alternatives

- One independent patient record per facility with no cross-facility linking.
- A platform master patient with facility registrations, as proposed.
- External master-patient-index integration after an integration and deployment decision.

### Risks And Dependencies

- False merges can cause clinical harm and privacy breaches; missed duplicates fragment history.
- Demographic uncertainty, name variation, partial dates, minors, guardians, and unidentified patients require clinical and legal decisions not inferred here.
- `OPEN-02` governs sharing purpose and notice; `OPEN-06` governs identity-event evidence; `OPEN-07` governs aliases and merged records; `OPEN-10` governs rights and legal constraints.
- `DEC-01` may select implementation architecture only after this stakeholder policy is approved.

### Decision Choice

| Choice    | Review action                                                                                                                 |
| --------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `APPROVE` | Approve immutable platform identity, facility MRNs, steward-reviewed linking, and non-destructive merge principles.           |
| `REVISE`  | Specify ownership, matching inputs, uncertain-demographic handling, merge authority, or multi-facility write rules to change. |
| `REJECT`  | Record the replacement identity and facility-ownership model.                                                                 |

Recorded selection: `PENDING`.

## OPEN-10: Legal And Regulatory Applicability

### Current Evidence

- The product vision references Ethiopia, but repository intent does not establish jurisdiction, deployment location, user location, organizational role, or applicable law.
- No qualified legal opinion, regulator determination, contractual framework, or compliance evidence is recorded.
- GitHub issue #41 records a product-owner `REVISE` outcome for `OPEN-10` on 2026-08-31. That outcome is a governance review result, not substantive legal advice or a qualified legal-applicability determination.

### Proposed Resolution

Require a qualified, jurisdiction-specific review before production authorization. The review agenda must determine, without presupposing conclusions:

- operating entities, controller/processor or equivalent responsibilities, contracting parties, and care-provider roles;
- jurisdictions connected to patients, workforce, facilities, infrastructure, support, and data transfers;
- healthcare, patient-record, professional, data-protection, cybersecurity, consumer, communications, accessibility, and electronic-transaction obligations;
- lawful grounds, consent cases, notices, minors or capacity, guardianship, and patient-rights procedures;
- data localization, cross-border transfer, processor-contract, and subcontractor requirements;
- security safeguards, breach assessment, notification, evidence preservation, and regulator engagement;
- record retention, deletion, legal hold, auditability, admissibility, and medical-record correction requirements;
- appointment-reminder communications and any channel-specific restrictions;
- licensing, insurance, procurement, and contractual requirements for production operators and vendors.

The review output must cite qualified evidence, effective dates, scope, assumptions, unresolved questions, and an owner for monitoring change. This document names no regulator or legal rule.

### Alternatives

- Obtain qualified review before any production design, as proposed.
- Limit a synthetic pilot to avoid real-data applicability while review proceeds.
- Infer rules from general web research, which is rejected as insufficient for production authorization.

### Risks And Dependencies

- Legal conclusions can change with entity structure, location, target users, hosting, and data flow.
- `OPEN-02`, `OPEN-06`, `OPEN-07`, `OPEN-08`, and `OPEN-12` cannot be finalized safely without applicability findings.
- A documentation approval without qualified review is not legal evidence.

### Decision Choice

| Choice    | Review action                                                                             |
| --------- | ----------------------------------------------------------------------------------------- |
| `APPROVE` | Approve the review agenda and require qualified findings before production authorization. |
| `REVISE`  | Specify missing jurisdictions, entity facts, review topics, or evidence standards.        |
| `REJECT`  | Record an alternative qualified-review process.                                           |

Recorded selection: `PENDING`.

### Product-Owner Review Outcome

| Field                      | Value                                                                                                                                                      |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Outcome                    | `REVISE`                                                                                                                                                   |
| Decision date              | 2026-08-31                                                                                                                                                 |
| Authority                  | Habte Selasie - Repository Owner and Product Decision Authority                                                                                            |
| Evidence URL               | [GitHub issue #41 REVISE comment](https://github.com/wku572/hakimi-healthcare-platform/issues/41#issuecomment-5475291583)                                  |
| Canonical decision type    | `OPEN DECISION`                                                                                                                                            |
| Completion/selection state | `PENDING`                                                                                                                                                  |
| Non-authorization boundary | This outcome does not approve a legal conclusion, production deployment, real patient-data processing, a provider, a jurisdiction, or any production gate. |

Rationale: the repository now contains a hypothetical operating model, proposed data inventory, data-flow and trust-boundary register, and qualified-review questionnaire. These materials are sufficient for structured consultation but not for a qualified legal-applicability determination.

`OPEN-10` must remain open and be reconsidered only after these required revisions exist:

- approved production operating entity;
- participating facilities and intended service population;
- actual deployment target, providers, regions, support locations, backup locations, identity provider, monitoring destination, and communications facts;
- controller, processor, healthcare-provider, contracting, and responsibility facts;
- qualified legal reviewer identity, scope, findings, limitations, date, and durable evidence;
- approved processing purposes and dependencies from `OPEN-02`, `OPEN-06`, `OPEN-07`, `OPEN-08`, and `OPEN-12`;
- applicable jurisdiction, regulator, registration, transfer, contractual, and legal-obligation findings.

Issue #41 remains open for follow-up evidence and the other Sprint 16 decisions. Production deployment and real patient-data processing remain `NOT AUTHORIZED`, and all production gates remain `BLOCKED`.

## OPEN-12: Deployment Target And Operational Ownership

### Current Evidence

- Docker, Compose, health checks, CI quality gates, supply-chain checks, and an operational runbook exist.
- Compose is a local baseline; no production target, service-level objective, recovery objective, on-call owner, incident authority, backup owner, secret owner, or production identity provider is approved.
- GitHub issue #41 records a product-owner `REVISE` outcome for `OPEN-12` on 2026-08-31. That outcome is a governance review result, not production authorization or operational approval.

### Proposed Resolution

Select a production target only after architecture, privacy, legal, residency, security, availability, support, and cost review. Record named owners only in the later approval evidence, not in this proposal.

Proposed operational RACI roles:

| Activity                                    | Accountable role                 | Responsible role                 | Consulted roles                                                        | Informed roles                    |
| ------------------------------------------- | -------------------------------- | -------------------------------- | ---------------------------------------------------------------------- | --------------------------------- |
| Production authorization                    | Product Decision Authority       | Service Owner                    | Legal, privacy, security, clinical safety, operations, data governance | Delivery stakeholders             |
| Application releases and rollback           | Service Owner                    | Application Operations           | Security, database, clinical safety                                    | Product stakeholders              |
| Runtime platform, network, and capacity     | Platform Operations Owner        | Platform Operations              | Service owner, security                                                | Product stakeholders              |
| Database availability and schema operations | Data Platform Owner              | Database Operations              | Service owner, security, data governance                               | Product stakeholders              |
| Backup, restore, archival, and disposal     | Data Protection Operations Owner | Database and Platform Operations | Legal, privacy, security, data governance                              | Product and clinical stakeholders |
| Identity provider and workforce access      | Identity Service Owner           | Identity Operations              | Security, service owner, facility administration                       | Product stakeholders              |
| Security incident response                  | Security Incident Owner          | Security Operations              | Service, platform, privacy, legal, clinical safety                     | Product authority                 |
| Privacy incident and rights requests        | Privacy Owner                    | Privacy Operations               | Legal, security, data steward, service owner                           | Product authority                 |
| Patient identity stewardship                | Patient Identity Owner           | Authorized Data Stewards         | Clinical safety, privacy, facility administration                      | Product authority                 |
| Clinical safety incident                    | Clinical Safety Owner            | Clinical Operations              | Service, privacy, legal, security                                      | Product authority                 |

No role above has a named assignee yet. Production remains blocked until every accountable and responsible role has an accepted assignment, escalation path, and separation-of-duties review.

### Alternatives

- Managed platform with contracted operational controls.
- Organization-operated infrastructure.
- Hybrid operation with explicit shared-responsibility boundaries.

### Risks And Dependencies

- Shared-responsibility gaps can leave backups, incidents, keys, identity, or deletion unmanaged.
- Target selection can change applicable law, data-transfer posture, and recovery design.
- `OPEN-10` informs location and contract constraints; `OPEN-06` and `OPEN-07` inform evidence and storage; `OPEN-02` informs processing controls.

### Decision Choice

| Choice    | Review action                                                                                                    |
| --------- | ---------------------------------------------------------------------------------------------------------------- |
| `APPROVE` | Approve the selection criteria and RACI roles, contingent on named assignments and a separately reviewed target. |
| `REVISE`  | Specify target criteria, service levels, responsibilities, or escalation changes.                                |
| `REJECT`  | Record a replacement ownership and deployment-governance model.                                                  |

Recorded selection: `PENDING`.

### Product-Owner Review Outcome

| Field                      | Value                                                                                                                                                        |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Outcome                    | `REVISE`                                                                                                                                                     |
| Decision date              | 2026-08-31                                                                                                                                                   |
| Authority                  | Habte Selasie - Repository Owner and Product Decision Authority                                                                                              |
| Evidence URL               | [GitHub issue #41 OPEN-12 REVISE comment](https://github.com/wku572/hakimi-healthcare-platform/issues/41#issuecomment-5475887779)                            |
| Canonical decision type    | `OPEN DECISION`                                                                                                                                              |
| Completion/selection state | `PENDING`                                                                                                                                                    |
| Non-authorization boundary | This outcome does not approve a production target, provider, architecture, region, owner, RACI, service objective, recovery objective, or operational model. |

Rationale: the repository has a local container, Compose, health, CI, supply-chain, and runbook baseline, but it lacks the production operating facts and accepted operational ownership evidence needed to select a production target or ownership model.

`OPEN-12` must remain open and be reconsidered only after these required revisions exist:

- approved production operating entity and service owner;
- selected deployment target, provider, architecture, region, and environments;
- participating facilities and intended users;
- named operational, security, privacy, clinical, data, and legal owners;
- accepted RACI and shared-responsibility model;
- service-level, availability, capacity, support, and maintenance objectives;
- recovery-time, recovery-point, backup, restore, and disaster-recovery objectives;
- monitoring, alerting, escalation, incident-command, and on-call ownership;
- production identity, secret, certificate, and privileged-access ownership;
- release, migration, rollback, emergency-change, and production-acceptance authority;
- qualified privacy, security, clinical, operational, and legal review evidence.

Issue #41 remains open for follow-up evidence and the remaining Sprint 16 decisions. No production target, provider, architecture, region, owner, RACI, service objective, recovery objective, or operational model is selected. Production deployment and real patient-data processing remain `NOT AUTHORIZED`, and all production gates remain `BLOCKED`.

## Data Classification And Handling Matrix

This proposed classification governs future production design only. It does not reclassify current synthetic test data as approved production data.

| Classification         | Examples                                                                                     | Access                                                      | Storage and transport                                                           | Logging and non-production                                                                  | Sharing and disposal                                                                  |
| ---------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `PUBLIC`               | Liveness and aggregate readiness status; approved public documentation                       | Anonymous only where explicitly documented                  | Integrity protection; TLS in deployment                                         | May be logged without hidden environment detail                                             | Public release review; ordinary approved disposal                                     |
| `INTERNAL`             | Architecture documents, non-sensitive build metadata, aggregate service metrics              | Workforce need-to-know                                      | Approved repositories and encrypted transport                                   | No production values in development artifacts                                               | Internal recipients; approved schedule                                                |
| `RESTRICTED_WORKFORCE` | Practitioner contact data, workforce actor references, roles, facility scopes                | Explicit workforce role and scope                           | Encryption in transit and at rest; access review                                | Synthetic only outside production; no identity claims or credentials in logs                | Approved operational purpose; evidenced disposal                                      |
| `RESTRICTED_PATIENT`   | Patient identity, MRN, demographics, contact and address data, appointment relationships     | Minimum necessary role, facility, relationship, and purpose | Strong encryption, scoped queries, backup controls, audited access              | Synthetic only in tests; prohibited from operational logs, tickets, fixtures, and snapshots | No export or cross-facility sharing without approved purpose; schedule and hold apply |
| `RESTRICTED_SECURITY`  | Tokens, credentials, signing keys, session material, recovery material, secret configuration | Dedicated security or workload boundary only                | Approved secret or key management; never general database fields without review | Never log, echo, snapshot, commit, or use in tickets and fixtures                           | Never share through ordinary channels; rotate/revoke and securely destroy             |
| `RESTRICTED_AUDIT`     | Proposed security and clinical audit evidence                                                | Separately authorized reviewers and custodians              | Append-only integrity controls, encryption, monitored pipeline                  | Synthetic validation only; audit contents excluded from operational logs                    | Controlled export, legal hold, and approved destruction                               |

## Production And Real-Patient-Data Gates

Every gate is currently `BLOCKED`. Passing a technical check is evidence for review, not self-authorization.

| Gate                                | Required evidence                                                                                                                       | Accountable approval                                                                      | Current state | Failure condition                                                                                                     |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------- |
| G1 Governance decisions             | Recorded outcomes for the six Sprint 16 decisions plus every other OPEN record applicable to the requested production scope             | Product Decision Authority                                                                | `BLOCKED`     | Any applicable decision, including `OPEN-01`, `OPEN-09`, or `OPEN-11`, remains pending, contradictory, or unsupported |
| G2 Legal applicability              | Qualified review with scope, assumptions, effective date, obligations, and unresolved issues                                            | Product Decision Authority acting on qualified legal advice                               | `BLOCKED`     | No qualified review or unresolved blocking obligation                                                                 |
| G3 Privacy and data governance      | Approved purposes, notices, rights process, classifications, identity stewardship, retention schedule, and legal-hold process           | Product Decision Authority with privacy and clinical review                               | `BLOCKED`     | Missing purpose, owner, patient-rights, identity, retention, or sharing rule                                          |
| G4 Security and audit readiness     | Threat review, production identity configuration, audit implementation, key and secret controls, penetration findings, incident process | Security Owner and Product Decision Authority                                             | `BLOCKED`     | Unresolved high-risk finding or absent audit and response control                                                     |
| G5 Operational readiness            | Approved target, named RACI, service and recovery objectives, backups, restore test, monitoring, on-call and rollback rehearsal         | Product Decision Authority and Operations Owner                                           | `BLOCKED`     | Unowned duty, failed restore, absent rollback, or unapproved target                                                   |
| G6 Limited production authorization | Bounded environment, data classes, users, facilities, support window, stop criteria, and signed approval                                | Product Decision Authority                                                                | `BLOCKED`     | Scope or stop authority is ambiguous                                                                                  |
| G7 Real patient-data processing     | All prior gates plus explicit data-processing authorization for the bounded purpose and population                                      | Product Decision Authority with required legal, privacy, security, and clinical approvals | `BLOCKED`     | Any prior gate is blocked or approval does not explicitly cover real data                                             |

## Bounded Follow-On Implementation Plan

No phase below is authorized by this proposal. Each begins only after its governing decision and architecture are approved.

1. Record decisions and qualified review evidence without changing runtime behavior.
2. Design security and clinical audit persistence, atomicity, integrity, review, and failure handling under approved `OPEN-06` and `OPEN-07` rules.
3. Design retention schedules, legal hold, archival, backup expiry, and evidenced disposal only after future approved `OPEN-07`, `OPEN-10`, and `OPEN-12` rules exist.
4. Design patient matching, steward review, links, merge, unmerge, provenance, and cross-facility field ownership under approved `OPEN-08`; then evaluate `DEC-01`.
5. Select the production topology and assign named RACI owners under approved `OPEN-12` and legal constraints.
6. Implement each concern as a separate reviewed runtime sprint with migrations, contracts, threat tests, rollback proof, synthetic fixtures, and documentation.
7. Conduct security, privacy, clinical safety, legal, restore, incident, and rollback reviews.
8. Request a separately recorded bounded production decision, followed by a separately recorded real-patient-data decision.

## Operation Governance Coverage

The single operation-level privacy, audit, retention, identity, and ownership reconciliation is maintained in [TRACEABILITY.md](./TRACEABILITY.md#sprint-16-production-governance-matrix). It contains all 26 OpenAPI and Express operations exactly once. The matrix proposes governance treatment but does not authorize production use.

## Explicit Exclusions

- No runtime, API, OpenAPI, migration, package, lockfile, container, Compose, test, script, or CI change.
- No production deployment or real patient-data processing.
- No legal conclusion, regulator selection, jurisdiction assumption, retention duration, hosting provider, issue number, or fabricated evidence.
- No clinical record, break-glass, patient authentication, patient self-service, role administration, analytics, export, or integration implementation.
- No automatic normative promotion of as-built behavior.
