# Product Backlog

The items below are deferred on purpose. They are not baseline requirements yet.

## Near-Term Product Decisions

- Resolve patient identity, duplicate detection, and merge policy in [OPEN-08](./REQUIREMENTS.md), then evaluate the dependent architecture candidate in [DEC-01](./REQUIREMENTS.md).
- Finalize appointment boundary rules, transition rules, and rescheduling semantics in [OPEN-09](./REQUIREMENTS.md), then evaluate the dependent architecture candidate in [DEC-02](./REQUIREMENTS.md).
- Decide the remaining healthcare, privacy, legal, audit, retention, patient-identity, reminder, and deployment baseline captured in [OPEN_DECISIONS.md](./OPEN_DECISIONS.md).
- Keep identity-role assignment administration, patient-role activation, patient authentication, patient MFA, patient recovery, patient self-service, cross-facility patient writes, and global patient deactivation blocked until their governing decisions are approved.
- Review and approve the minimum authoritative actor, workforce-role, facility-scope, activation, revocation, and session persistence and migration boundary in the proposed [Sprint 15 implementation specification](./SPRINT_15_IMPLEMENTATION_SPEC.md) before runtime coding; do not infer it from token claims or practitioner-facility rosters.
- Keep production deployment and real patient-data processing blocked pending `OPEN-02`, `OPEN-10`, `OPEN-12`, applicable review, and resolution of the audit, retention, and patient-identity dependencies in `OPEN-06`, `OPEN-07`, and `OPEN-08`.

## Future Product Work

- Define an emergency contact model for patients after identity policy is settled.
- Decide whether richer patient demographics should include age-derived presentation fields or stay date-of-birth only.
- Replace the development-safe reminder adapter with a real delivery channel.
- After specification approval, implement only the [approved bounded Sprint 15 workforce authentication and authorization foundation](./ACCESS_CONTROL_BASELINE.md#recorded-approval) according to the [Sprint 15 implementation specification](./SPRINT_15_IMPLEMENTATION_SPEC.md), using synthetic data under its explicit production gate.
- Add clinical records, claims, payments, and other downstream healthcare workflows later.

## Platform Follow-Up

- Keep the schema verifier aligned whenever a new migration is introduced.
- Keep traceability current whenever a public API operation is added, removed, or renamed.
- Keep the documentation baseline validator in sync with the canonical register.
