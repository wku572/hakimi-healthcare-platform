# Decisions

This document records the current decision posture that follows from the canonical requirements register.

## Current Decision State

- [BR-01](./REQUIREMENTS.md) remains proposed and not yet owner-approved.
- [DEC-01](./REQUIREMENTS.md) is a proposed identity-resolution architecture candidate. It has no independent policy authority and depends on the stakeholder decision in [OPEN-08](./REQUIREMENTS.md).
- [DEC-02](./REQUIREMENTS.md) is a proposed appointment-policy enforcement architecture candidate. It has no independent policy authority and depends on the stakeholder decision in [OPEN-09](./REQUIREMENTS.md).
- [OPEN-01](./REQUIREMENTS.md) through [OPEN-12](./REQUIREMENTS.md) remain open because the unresolved healthcare, privacy, legal, role, authentication, authorization, audit, retention, demographic, appointment, reminder, and deployment questions have not been approved.

## What Counts As A Decision Here

A decision in this documentation baseline is a rule that needs explicit stakeholder approval before it can be treated as a product commitment. The repository already implements many behaviors, but implementation alone does not promote them to confirmed product policy.

## Decision Handling

- Keep proposed product vision separate from baseline behavior.
- Keep open healthcare and legal rules visible until they are explicitly approved.
- Keep candidate architecture decisions distinguishable from as-built facts.

## Decision Authority And Dependencies

| Stakeholder authority        | Dependent candidate architecture record | Authority boundary                                                                                                                                                                         | Explicit dependency                                                           |
| ---------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| [OPEN-08](./REQUIREMENTS.md) | [DEC-01](./REQUIREMENTS.md)             | `OPEN-08` decides patient identity, duplicate-detection, merge, demographic, and multi-facility policy. `DEC-01` may only select technical identity-resolution mechanisms.                 | `DEC-01` cannot advance until `OPEN-08` defines the policy it must implement. |
| [OPEN-09](./REQUIREMENTS.md) | [DEC-02](./REQUIREMENTS.md)             | `OPEN-09` decides appointment boundaries, blocking statuses, transitions, rescheduling, duration, and cancellation policy. `DEC-02` may only select enforcement boundaries and mechanisms. | `DEC-02` cannot advance until `OPEN-09` defines the policy it must implement. |
