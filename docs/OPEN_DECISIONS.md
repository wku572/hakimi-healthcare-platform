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
   - Question: What role hierarchy, if any, should the product use?
4. Authentication
   - Related canonical records: [OPEN-04](./REQUIREMENTS.md)
   - Question: When and how should authentication be introduced?
5. Authorization and patient-data access
   - Related canonical records: [OPEN-05](./REQUIREMENTS.md)
   - Question: Who may view or modify patient data and under which scopes?
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
