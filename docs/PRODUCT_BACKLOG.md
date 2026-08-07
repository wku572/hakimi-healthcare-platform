# Product Backlog

The items below are deferred on purpose. They are not baseline requirements yet.

## Near-Term Product Decisions

- Resolve patient identity, duplicate detection, and merge policy in [OPEN-08](./REQUIREMENTS.md), then evaluate the dependent architecture candidate in [DEC-01](./REQUIREMENTS.md).
- Finalize appointment boundary rules, transition rules, and rescheduling semantics in [OPEN-09](./REQUIREMENTS.md), then evaluate the dependent architecture candidate in [DEC-02](./REQUIREMENTS.md).
- Decide the healthcare, privacy, legal, role, authentication, authorization, audit, retention, and deployment baseline captured in [OPEN_DECISIONS.md](./OPEN_DECISIONS.md).

## Future Product Work

- Define an emergency contact model for patients after identity policy is settled.
- Decide whether richer patient demographics should include age-derived presentation fields or stay date-of-birth only.
- Replace the development-safe reminder adapter with a real delivery channel.
- Add authentication and authorization only after the product-owner baseline is explicitly approved.
- Add clinical records, claims, payments, and other downstream healthcare workflows later.

## Platform Follow-Up

- Keep the schema verifier aligned whenever a new migration is introduced.
- Keep traceability current whenever a public API operation is added, removed, or renamed.
- Keep the documentation baseline validator in sync with the canonical register.
