# Open Decisions

These are the unresolved stakeholder questions that remain deliberately open.

## Open Items

1. Healthcare and business rules
   - Related canonical records: [OPEN-01](./REQUIREMENTS.md)
   - Question: What product policy governs the broader healthcare workflow beyond the implemented vertical slices?
2. Privacy and consent policy
   - Related canonical records: [OPEN-02](./REQUIREMENTS.md)
   - Question: What notice, consent, purpose-limitation, and patient privacy policy should the platform enforce?
3. User roles
   - Related canonical records: [OPEN-03](./REQUIREMENTS.md)
   - Proposed resolution: Adopt the six human roles, four service actors, privilege boundaries, and facility-scoping model in [ACCESS_CONTROL_BASELINE.md](./ACCESS_CONTROL_BASELINE.md).
   - Approval still required: Product owner must approve, revise, or reject role names, multi-role behavior, role-assignment authority, and facility membership rules independently from authentication and authorization.
4. Authentication
   - Related canonical records: [OPEN-04](./REQUIREMENTS.md)
   - Proposed resolution: Use OIDC Authorization Code with PKCE for humans, unique workload identities for services, 10-minute access tokens, rotated refresh tokens, an 8-hour maximum workforce session, 30-minute workforce inactivity timeout, explicit revocation, and privacy-safe recovery.
   - Approval still required: Product owner and security stakeholders must approve or revise the mechanism, durations, workforce MFA, patient MFA and recovery factors, activation/deactivation behavior, and identity-provider selection criteria.
5. Authorization and patient-data access
   - Related canonical records: [OPEN-05](./REQUIREMENTS.md)
   - Proposed resolution: Use default-deny authorization from immutable server-derived context and the complete 26-operation role, facility, patient, field, and denial matrix in [TRACEABILITY.md](./TRACEABILITY.md).
   - Approval still required: Product, clinical, privacy, and security stakeholders must approve or revise directory visibility, staff patient-data boundaries, practitioner relationships, patient self-service, field privileges, controlled cross-facility access, and `401`/`403`/privacy-preserving `404` behavior.
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

These remain independent stakeholder decisions even if `OPEN-03`, `OPEN-04`, or `OPEN-05` is later approved.
