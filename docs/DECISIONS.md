# Decisions

This document records the current decision posture that follows from the canonical requirements register.

## Current Decision State

- [BR-01](./REQUIREMENTS.md) remains proposed and not yet owner-approved.
- [DEC-01](./REQUIREMENTS.md) is a proposed identity-resolution architecture candidate. It has no independent policy authority and depends on the stakeholder decision in [OPEN-08](./REQUIREMENTS.md).
- [DEC-02](./REQUIREMENTS.md) is a proposed appointment-policy enforcement architecture candidate. It has no independent policy authority and depends on the stakeholder decision in [OPEN-09](./REQUIREMENTS.md).
- [OPEN-03](./REQUIREMENTS.md), [OPEN-04](./REQUIREMENTS.md), and [OPEN-05](./REQUIREMENTS.md) now have separately reviewable Sprint 14 proposals in [ACCESS_CONTROL_BASELINE.md](./ACCESS_CONTROL_BASELINE.md). They remain `OPEN DECISION`; documentation does not constitute approval or runtime implementation.
- [OPEN-01](./REQUIREMENTS.md) through [OPEN-12](./REQUIREMENTS.md) remain open because the unresolved healthcare, privacy, legal, role, authentication, authorization, audit, retention, demographic, appointment, reminder, and deployment questions have not been approved.

## What Counts As A Decision Here

A decision in this documentation baseline is a rule that needs explicit stakeholder approval before it can be treated as a product commitment. The repository already implements many behaviors, but implementation alone does not promote them to confirmed product policy.

## Decision Handling

- Keep proposed product vision separate from baseline behavior.
- Keep open healthcare and legal rules visible until they are explicitly approved.
- Keep candidate architecture decisions distinguishable from as-built facts.
- Treat the Sprint 14 access-control mechanism as a proposal subordinate to `OPEN-03`, `OPEN-04`, and `OPEN-05`, not as an independently authoritative decision.

## Decision Authority And Dependencies

| Stakeholder authority        | Dependent candidate architecture record | Authority boundary                                                                                                                                                                         | Explicit dependency                                                           |
| ---------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| [OPEN-08](./REQUIREMENTS.md) | [DEC-01](./REQUIREMENTS.md)             | `OPEN-08` decides patient identity, duplicate-detection, merge, demographic, and multi-facility policy. `DEC-01` may only select technical identity-resolution mechanisms.                 | `DEC-01` cannot advance until `OPEN-08` defines the policy it must implement. |
| [OPEN-09](./REQUIREMENTS.md) | [DEC-02](./REQUIREMENTS.md)             | `OPEN-09` decides appointment boundaries, blocking statuses, transitions, rescheduling, duration, and cancellation policy. `DEC-02` may only select enforcement boundaries and mechanisms. | `DEC-02` cannot advance until `OPEN-09` defines the policy it must implement. |

## Sprint 14 Decision Authority

The Sprint 14 proposals intentionally do not create competing architecture-decision records. Stakeholder-owned OPEN records remain authoritative until an explicit approval, revision, or rejection is recorded.

| Authoritative stakeholder record | Proposed resolution                                                                                                       | Authority boundary                                                                                                                          | Dependency before Sprint 15                                                                                  |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| [OPEN-03](./REQUIREMENTS.md)     | Human and service actors, six human roles, privileges, and facility scope                                                 | The product owner decides role semantics and role-assignment authority. The access-control document only proposes a reviewable model.       | Approve the role catalogue and who may assign each role.                                                     |
| [OPEN-04](./REQUIREMENTS.md)     | Federated OIDC for humans, workload identities for services, and bounded credential/session lifecycle                     | The product owner and security stakeholders decide authentication policy. The proposal does not select a provider or implement credentials. | Approve or revise mechanism, durations, MFA, activation, deactivation, revocation, expiration, and recovery. |
| [OPEN-05](./REQUIREMENTS.md)     | Default-deny authorization, immutable server-derived context, facility isolation, patient boundaries, and denial behavior | Product, clinical, privacy, and security stakeholders decide who may access patient data. The 26-row matrix is proposed, not enforced.      | Approve the operation matrix and resolve any blocking dependency before changing runtime or OpenAPI.         |

`OPEN-03` supplies the role vocabulary consumed by `OPEN-05`. `OPEN-04` establishes trustworthy actor identity, but successful authentication never grants domain access by itself. `OPEN-05` consumes both and remains responsible for operation, facility, relationship, patient, and field authorization.
