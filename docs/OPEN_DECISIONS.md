# Open Decisions

This file records unresolved stakeholder questions and the deferred remainder of decisions approved with revisions.

## Open Items

1. Healthcare and business rules
   - Related canonical records: [OPEN-01](./REQUIREMENTS.md)
   - Question: What product policy governs the broader healthcare workflow beyond the implemented vertical slices?
2. Privacy and consent policy
   - Related canonical records: [OPEN-02](./REQUIREMENTS.md)
   - Question: What notice, consent, purpose-limitation, and patient privacy policy should the platform enforce?
   - Sprint 16 proposal: [purpose-bound privacy and minimum necessary access](./PRODUCTION_READINESS_GOVERNANCE.md#open-02-privacy-consent-lawful-purpose-and-minimum-necessary-access).
   - Decision status: `OPEN DECISION`; approve, revise, or reject selection is `PENDING`.
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
   - Decision status: `OPEN DECISION`; approve, revise, or reject selection is `PENDING`.
7. Retention and deletion
   - Related canonical records: [OPEN-07](./REQUIREMENTS.md)
   - Question: When is soft deletion sufficient and when, if ever, is hard deletion allowed?
   - Sprint 16 proposal: [category schedules, archival, deletion, backups, and legal hold](./PRODUCTION_READINESS_GOVERNANCE.md#open-07-retention-archival-deletion-backup-and-legal-hold).
   - Decision status: `OPEN DECISION`; no duration is proposed and selection is `PENDING`.
8. Patient demographics, identity, and multi-facility registration
   - Related canonical records: [OPEN-08](./REQUIREMENTS.md)
   - Question: What patient identity, merge, and cross-facility registration rules should apply?
   - Sprint 16 proposal: [immutable platform identity, facility MRNs, steward-reviewed linking, and non-destructive merge](./PRODUCTION_READINESS_GOVERNANCE.md#open-08-patient-identity-and-multi-facility-ownership).
   - Decision status: `OPEN DECISION`; approve, revise, or reject selection is `PENDING`.
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
    - Decision status: `OPEN DECISION`; no jurisdiction, regulator, or legal conclusion is selected and selection is `PENDING`.
11. Reminder policy
    - Related canonical records: [OPEN-11](./REQUIREMENTS.md)
    - Question: What timing, channels, content, timezone presentation, retry limits, and failure-handling rules should reminders use?
12. Deployment target and operational ownership
    - Related canonical records: [OPEN-12](./REQUIREMENTS.md)
    - Question: What production target will be used, and who owns environments, operations, backups, incidents, and on-call response?
    - Sprint 16 proposal: [target-selection criteria and operational RACI roles](./PRODUCTION_READINESS_GOVERNANCE.md#open-12-deployment-target-and-operational-ownership).
    - Decision status: `OPEN DECISION`; no provider, target, named owner, or approve/revise/reject selection is recorded.

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

These remain independent stakeholder decisions after the bounded workforce approvals and Sprint 15 implementation for `OPEN-03`, `OPEN-04`, and `OPEN-05`. The Sprint 16 package also keeps `OPEN-08` and `OPEN-12` independently pending.

Sprint 15 remains synthetic-data-only. Production activation and real patient-data processing are blocked until the six Sprint 16 decisions, their dependencies, qualified reviews, named operational ownership, and the applicable [production gates](./PRODUCTION_READINESS_GOVERNANCE.md#production-and-real-patient-data-gates) receive genuine recorded approval. `OPEN-01`, `OPEN-09`, and `OPEN-11` also remain independent blockers for production scopes that use their healthcare, appointment, or reminder workflows.
