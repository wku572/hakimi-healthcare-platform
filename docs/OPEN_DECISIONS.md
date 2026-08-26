# Open Decisions

This file records unresolved stakeholder questions and the deferred remainder of decisions approved with revisions.

## Open Items

1. Healthcare and business rules
   - Related canonical records: [OPEN-01](./REQUIREMENTS.md)
   - Question: What product policy governs the broader healthcare workflow beyond the implemented vertical slices?
2. Privacy and consent policy
   - Related canonical records: [OPEN-02](./REQUIREMENTS.md)
   - Question: What notice, consent, purpose-limitation, and patient privacy policy should the platform enforce?
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
   - Deferred remainder: Patient self-service, cross-facility patient writes, global patient deactivation, and patient-derived authorization context remain blocked pending `OPEN-02`, `OPEN-07`, `OPEN-08`, and `OPEN-10`.
6. Audit requirements
   - Related canonical records: [OPEN-06](./REQUIREMENTS.md)
   - Question: What audit events, retention, and review rules are required?
7. Retention and deletion
   - Related canonical records: [OPEN-07](./REQUIREMENTS.md)
   - Question: When is soft deletion sufficient and when, if ever, is hard deletion allowed?
8. Patient demographics, identity, and multi-facility registration
   - Related canonical records: [OPEN-08](./REQUIREMENTS.md)
   - Question: What patient identity, merge, and cross-facility registration rules should apply?
9. Appointment business rules
   - Related canonical records: [OPEN-09](./REQUIREMENTS.md)
   - Question: What appointment boundary, blocking-status, transition, rescheduling, duration, and cancellation rules should apply?
10. Applicable legal and regulatory requirements
    - Related canonical records: [OPEN-10](./REQUIREMENTS.md)
    - Question: Which jurisdictions, healthcare regulations, data-protection laws, and compliance obligations apply?
11. Reminder policy
    - Related canonical records: [OPEN-11](./REQUIREMENTS.md)
    - Question: What timing, channels, content, timezone presentation, retry limits, and failure-handling rules should reminders use?
12. Deployment target and operational ownership
    - Related canonical records: [OPEN-12](./REQUIREMENTS.md)
    - Question: What production target will be used, and who owns environments, operations, backups, incidents, and on-call response?

## Explicitly Deferred

- Emergency contact storage and validation.
- Duplicate-patient merge behavior.
- Age presentation rules beyond date of birth.
- Real notification transport for reminders.
- Any clinical record model that would expand the current demographic baseline.

## Decisions Not Inferred By Sprint 14

The Sprint 14 proposal does not resolve:

- [OPEN-02](./REQUIREMENTS.md): privacy, consent, notice, or purpose limitation;
- [OPEN-06](./REQUIREMENTS.md): audit events, audit review, or audit retention;
- [OPEN-07](./REQUIREMENTS.md): retention, hard deletion, or global patient deactivation;
- [OPEN-10](./REQUIREMENTS.md): applicable legal, regulatory, healthcare, or data-protection obligations.

These remain independent stakeholder decisions after the bounded workforce approvals for `OPEN-03`, `OPEN-04`, and `OPEN-05`.

The approval permits synthetic-data-only Sprint 15 implementation and testing, not production deployment or real patient-data processing. Production activation remains blocked pending `OPEN-02`, `OPEN-10`, `OPEN-12`, and applicable review. `OPEN-06`, `OPEN-07`, and `OPEN-08` remain unresolved for audit, retention, and patient identity. The minimum authoritative access-state persistence and migration boundary must be specified before runtime coding but is not selected by this documentation change.
