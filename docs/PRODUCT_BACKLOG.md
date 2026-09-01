# Product Backlog

The items below are deferred on purpose. They are not baseline requirements yet.

## Near-Term Product Decisions

- Resolve patient identity, duplicate detection, and merge policy in [OPEN-08](./REQUIREMENTS.md), then evaluate the dependent architecture candidate in [DEC-01](./REQUIREMENTS.md).
- Finalize appointment boundary rules, transition rules, and rescheduling semantics in [OPEN-09](./REQUIREMENTS.md), then evaluate the dependent architecture candidate in [DEC-02](./REQUIREMENTS.md).
- Decide the remaining healthcare, privacy, legal, audit, retention, patient-identity, reminder, and deployment baseline captured in [OPEN_DECISIONS.md](./OPEN_DECISIONS.md).
- Keep identity-role assignment administration, patient-role activation, patient authentication, patient MFA, patient recovery, patient self-service, cross-facility patient writes, and global patient deactivation blocked until their governing decisions are approved.
- Continue the six independent decision packets in the [Sprint 16 production-readiness governance proposal](./PRODUCTION_READINESS_GOVERNANCE.md). `OPEN-02`, `OPEN-07`, `OPEN-10`, and `OPEN-12` have product-owner review outcomes of `REVISE` and must be reconsidered after their required evidence exists; `OPEN-06` and `OPEN-08` still need separate approve, revise, or reject evidence.
- Keep production deployment and real patient-data processing blocked pending `OPEN-02`, `OPEN-07`, `OPEN-10`, `OPEN-12`, applicable review, and resolution of the audit and patient-identity dependencies in `OPEN-06` and `OPEN-08`.

## Future Product Work

- Define an emergency contact model for patients after identity policy is settled.
- Decide whether richer patient demographics should include age-derived presentation fields or stay date-of-birth only.
- Replace the development-safe reminder adapter with a real delivery channel.
- Keep the implemented [Sprint 15 workforce authentication and authorization foundation](./ACCESS_CONTROL_BASELINE.md#recorded-approval) synthetic-data-only until every applicable production gate is explicitly approved.
- After governing decisions are approved, specify audit evidence, retention and legal hold, patient identity, and production operations as separate bounded implementation sprints; do not combine policy approval with runtime implementation.
- Add clinical records, claims, payments, and other downstream healthcare workflows later.

## Platform Follow-Up

- Keep the schema verifier aligned whenever a new migration is introduced.
- Keep traceability current whenever a public API operation is added, removed, or renamed.
- Keep the documentation baseline validator in sync with the canonical register.
