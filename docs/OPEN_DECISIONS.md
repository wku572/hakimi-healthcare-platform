# Open Decisions

This file records unresolved stakeholder questions and the deferred remainder of decisions approved with revisions.

The [Sprint 17 governance remediation plan](./SPRINT_17_GOVERNANCE_REMEDIATION_PLAN.md) organizes evidence collection for the six Sprint 16 `REVISE` outcomes without changing any decision outcome, selection, or production gate.

## Open Items

1. Healthcare and business rules
   - Related canonical records: [OPEN-01](./REQUIREMENTS.md)
   - Question: What product policy governs the broader healthcare workflow beyond the implemented vertical slices?
2. Privacy and consent policy
   - Related canonical records: [OPEN-02](./REQUIREMENTS.md)
   - Question: What notice, consent, purpose-limitation, and patient privacy policy should the platform enforce?
   - Sprint 16 proposal: [purpose-bound privacy and minimum necessary access](./PRODUCTION_READINESS_GOVERNANCE.md#open-02-privacy-consent-lawful-purpose-and-minimum-necessary-access).
   - Evidence pack: [privacy, consent, lawful-purpose, and minimum-necessary access evidence](./OPEN02_PRIVACY_PURPOSE_AND_CONSENT_EVIDENCE.md).
   - Product-owner review outcome: `REVISE`, recorded by Habte Selasie, Repository Owner and Product Decision Authority, on 2026-09-01 in [GitHub issue #41](https://github.com/wku572/hakimi-healthcare-platform/issues/41#issuecomment-5490115520).
   - Decision status: `OPEN DECISION`; implementation/governance selection remains `PENDING`; no lawful basis, consent model, notice, rights implementation, jurisdiction, regulator, operating entity, provider, production owner, production deployment, real patient-data processing, or production gate is selected.
   - Required revision: reconsider only after bounded processing purposes, applicable lawful grounds, consent and withdrawal rules where applicable, notices, transparency obligations, patient-rights and complaint workflows, representative authority, minimum-necessary fields, exception handling, and dependent evidence are reviewed and documented by the required qualified functions.
3. User roles
   - Related canonical records: [OPEN-03](./REQUIREMENTS.md)
   - Recorded outcome: [APPROVED WITH REVISIONS](./ACCESS_CONTROL_BASELINE.md#recorded-approval) for the workforce-only Sprint 15 role catalogue and facility scope.
   - Deferred remainder: Identity-role assignment administration is excluded, and `PATIENT` role activation remains blocked pending `OPEN-08`.
4. Authentication
   - Related canonical records: [OPEN-04](./REQUIREMENTS.md)
   - Recorded outcome: [APPROVED WITH REVISIONS](./ACCESS_CONTROL_BASELINE.md#recorded-approval) for OIDC Authorization Code with PKCE, workforce MFA, short-lived access tokens, revocation, and unique workload identities.
   - Deferred remainder: Patient authentication, patient MFA, patient account recovery, and patient session lifecycle remain blocked pending `OPEN-02`, `OPEN-07`, `OPEN-08`, and `OPEN-10`.
5. Authorization and patient-data access
   - Related canonical records: [OPEN-05](./REQUIREMENTS.md)
   - Recorded outcome: [APPROVED WITH REVISIONS](./ACCESS_CONTROL_BASELINE.md#recorded-approval) for default-deny workforce authorization, immutable server-derived context, facility isolation, and privacy-preserving denial in the 26-operation matrix.
   - Deferred remainder: Patient self-service, cross-facility patient writes, global patient deactivation, and patient-derived authorization context remain blocked pending `OPEN-02`, `OPEN-07`, `OPEN-08`, and `OPEN-10`; practitioner access to standalone patient records remains blocked pending `OPEN-09`.
6. Audit requirements
   - Related canonical records: [OPEN-06](./REQUIREMENTS.md)
   - Question: What audit events, retention, and review rules are required?
   - Sprint 16 proposal: [separate security and clinical audit event families](./PRODUCTION_READINESS_GOVERNANCE.md#open-06-security-and-clinical-audit-events).
   - Evidence pack: [security and clinical audit evidence](./OPEN06_SECURITY_AND_CLINICAL_AUDIT_EVIDENCE.md).
   - Product-owner review outcome: `REVISE`, recorded by Habte Selasie, Repository Owner and Product Decision Authority, on 2026-09-01 in [GitHub issue #41](https://github.com/wku572/hakimi-healthcare-platform/issues/41#issuecomment-5494209792).
   - Decision status: `OPEN DECISION`; implementation/governance selection remains `PENDING`; no audit policy, current diagnostics as durable audit evidence, audit store, integrity mechanism, trusted timestamping, audit retention, deletion or legal-hold rule, provider, SIEM, destination, region, recipient, reviewer, production owner, production deployment, real patient-data processing, or production gate is selected.
   - Required revision: reconsider only after required security and clinical audit event families, actor/subject/resource/facility/action/outcome/reason/correlation/timestamp fields, minimum-necessary and privacy-safe field boundaries, clinical significance and patient-safety requirements, authentication/authorization/provisioning/session/revocation evidence, audit-write atomicity and failed-write behavior, integrity and tamper-evidence controls, trusted time, ordering, durable storage, recipient model, audit access, review, alerting, escalation, segregation of duties, investigation, disclosure, export, redaction, evidence-chain controls, retention/deletion/backup/restoration/legal-hold dependencies, exception handling, recovery handling, named operational ownership, and qualified-review evidence are reviewed and documented by the required qualified functions.
7. Retention and deletion
   - Related canonical records: [OPEN-07](./REQUIREMENTS.md)
   - Question: When is soft deletion sufficient and when, if ever, is hard deletion allowed?
   - Sprint 16 proposal: [category schedules, archival, deletion, backups, and legal hold](./PRODUCTION_READINESS_GOVERNANCE.md#open-07-retention-archival-deletion-backup-and-legal-hold).
   - Evidence pack: [retention, deletion, backup, and legal-hold evidence](./OPEN07_RETENTION_DELETION_AND_LEGAL_HOLD_EVIDENCE.md).
   - Product-owner review outcome: `REVISE`, recorded by Habte Selasie, Repository Owner and Product Decision Authority, on 2026-09-01 in [GitHub issue #41](https://github.com/wku572/hakimi-healthcare-platform/issues/41#issuecomment-5491419798).
   - Decision status: `OPEN DECISION`; implementation/governance selection remains `PENDING`; no retention period, trigger, archival tier, deletion deadline, backup period, disposition method, legal-hold rule, provider, jurisdiction, reviewer, production owner, production deployment, real patient-data processing, or production gate is selected.
   - Required revision: reconsider only after retention categories and triggers, applicable durations, archival and disposition rules, backup scope and expiry, restore and deletion-propagation controls, legal-hold issuance and release authority, patient-rights and identity interactions, audit-record dependencies, exception handling, failed-disposal recovery, downstream-recipient obligations, and deletion/destruction evidence are reviewed and documented by the required qualified functions.
8. Patient demographics, identity, and multi-facility registration
   - Related canonical records: [OPEN-08](./REQUIREMENTS.md)
   - Question: What patient identity, merge, and cross-facility registration rules should apply?
   - Sprint 16 proposal: [immutable platform identity, facility MRNs, steward-reviewed linking, and non-destructive merge](./PRODUCTION_READINESS_GOVERNANCE.md#open-08-patient-identity-and-multi-facility-ownership).
   - Evidence pack: [patient identity and multi-facility ownership evidence](./OPEN08_PATIENT_IDENTITY_AND_OWNERSHIP_EVIDENCE.md).
   - Product-owner review outcome: `REVISE`, recorded by Habte Selasie, Repository Owner and Product Decision Authority, on 2026-09-02 in [GitHub issue #41](https://github.com/wku572/hakimi-healthcare-platform/issues/41#issuecomment-5507593372).
   - Decision status: `OPEN DECISION`; implementation/governance selection remains `PENDING`; no matching algorithm, score, threshold, biometric, national identifier, master-patient-index product, identity provider, duplicate conclusion, steward, link/merge/unmerge authority, survivorship rule, representative-authority rule, cross-facility owner, write hierarchy, reviewer, jurisdiction, legal conclusion, patient authentication, production technology, runtime implementation, production deployment, real patient-data processing, or production gate is selected.
   - Required revision: reconsider only after identity-proofing evidence and assurance, duplicate-candidate generation and review rules, steward authority and escalation, link/merge/unmerge authority, survivorship and alias handling, field-level provenance and source authority, demographic correction and dispute workflows, representative/guardian/proxy/delegated authority, cross-facility ownership/write-authority/conflict-resolution rules, patient-safety controls, audit-event and evidence requirements, retention/deletion/backup/restoration/legal-hold dependencies, legal applicability, operational ownership and recovery, and qualified-review evidence are reviewed and documented by the required qualified functions.
9. Appointment business rules
   - Related canonical records: [OPEN-09](./REQUIREMENTS.md)
   - Question: What appointment boundary, blocking-status, transition, rescheduling, duration, and cancellation rules should apply?
10. Applicable legal and regulatory requirements
    - Related canonical records: [OPEN-10](./REQUIREMENTS.md)
    - Question: Which jurisdictions, healthcare regulations, data-protection laws, and compliance obligations apply?
    - Sprint 16 proposal: [qualified legal and regulatory applicability review agenda](./PRODUCTION_READINESS_GOVERNANCE.md#open-10-legal-and-regulatory-applicability).
    - Hypothetical evidence pack: [synthetic-data-only operating model and data-flow questions](./OPEN10_HYPOTHETICAL_OPERATING_MODEL.md).
    - Proposed data inventory: [repository-reconciled technical data assets and evidence gaps](./OPEN10_PROPOSED_DATA_INVENTORY.md).
    - Data-flow evidence: [hypothetical flows and trust boundaries reconciled to inventory and operations](./OPEN10_HYPOTHETICAL_DATA_FLOW.md).
    - Qualified review questionnaire: [blank evidence-collection instrument for qualified legal and regulatory reviewers](./OPEN10_QUALIFIED_LEGAL_REVIEW_QUESTIONNAIRE.md).
    - Product-owner review outcome: `REVISE`, recorded by Habte Selasie, Repository Owner and Product Decision Authority, on 2026-08-31 in [GitHub issue #41](https://github.com/wku572/hakimi-healthcare-platform/issues/41#issuecomment-5475291583).
    - Decision status: `OPEN DECISION`; implementation/governance selection remains `PENDING`; no jurisdiction, regulator, legal conclusion, provider, operating entity, retention period, production deployment, real patient-data processing, or production gate is selected.
    - Required revision: reconsider only after an approved production operating entity, intended facilities and service population, actual provider/location/support/backup/identity/monitoring/communications facts, responsibility facts, qualified legal-review evidence, approved dependent purposes and policies, and applicable jurisdiction/regulator/registration/transfer/contractual/legal-obligation findings exist.
11. Reminder policy
    - Related canonical records: [OPEN-11](./REQUIREMENTS.md)
    - Question: What timing, channels, content, timezone presentation, retry limits, and failure-handling rules should reminders use?
12. Deployment target and operational ownership
    - Related canonical records: [OPEN-12](./REQUIREMENTS.md)
    - Question: What production target will be used, and who owns environments, operations, backups, incidents, and on-call response?
    - Sprint 16 proposal: [target-selection criteria and operational RACI roles](./PRODUCTION_READINESS_GOVERNANCE.md#open-12-deployment-target-and-operational-ownership).
    - Product-owner review outcome: `REVISE`, recorded by Habte Selasie, Repository Owner and Product Decision Authority, on 2026-08-31 in [GitHub issue #41](https://github.com/wku572/hakimi-healthcare-platform/issues/41#issuecomment-5475887779).
    - Decision status: `OPEN DECISION`; implementation/governance selection remains `PENDING`; no production target, provider, architecture, region, owner, RACI, service objective, recovery objective, operational model, production deployment, real patient-data processing, or production gate is selected.
    - Required revision: reconsider only after an approved production operating entity and service owner, selected target/provider/architecture/region/environments, participating facilities and intended users, named owners, accepted RACI and shared-responsibility model, service and recovery objectives, monitoring and incident ownership, identity/secret/certificate/privileged-access ownership, release/change authority, and qualified external-review evidence exist.

## Explicitly Deferred

- Emergency contact storage and validation.
- Duplicate-patient merge behavior.
- Age presentation rules beyond date of birth.
- Real notification transport for reminders.
- Any clinical record model that would expand the current demographic baseline.

## Decisions Not Inferred By Sprint 16

The Sprint 16 proposal does not resolve:

- [OPEN-02](./REQUIREMENTS.md): privacy, consent, notice, or purpose limitation;
- [OPEN-06](./REQUIREMENTS.md): audit events, audit review, or audit retention;
- [OPEN-07](./REQUIREMENTS.md): retention, hard deletion, or global patient deactivation;
- [OPEN-08](./REQUIREMENTS.md): patient identity, duplicate handling, merge, or multi-facility ownership;
- [OPEN-10](./REQUIREMENTS.md): applicable legal, regulatory, healthcare, or data-protection obligations.
- [OPEN-12](./REQUIREMENTS.md): production target, named operational ownership, backups, incidents, or on-call responsibility.

These remain independent stakeholder decisions after the bounded workforce approvals and Sprint 15 implementation for `OPEN-03`, `OPEN-04`, and `OPEN-05`. `OPEN-02`, `OPEN-06`, `OPEN-07`, `OPEN-08`, `OPEN-10`, and `OPEN-12` have recorded `REVISE` outcomes but remain pending for implementation/governance selection.

Sprint 15 remains synthetic-data-only. Production activation and real patient-data processing are blocked until the six Sprint 16 decisions, their dependencies, qualified reviews, named operational ownership, and the applicable [production gates](./PRODUCTION_READINESS_GOVERNANCE.md#production-and-real-patient-data-gates) receive genuine recorded approval. `OPEN-01`, `OPEN-09`, and `OPEN-11` also remain independent blockers for production scopes that use their healthcare, appointment, or reminder workflows.

Use the [Sprint 17 remediation plan](./SPRINT_17_GOVERNANCE_REMEDIATION_PLAN.md) to track evidence collection and readiness for product-owner reconsideration.
