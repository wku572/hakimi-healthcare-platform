# Decisions

This document records the current decision posture that follows from the canonical requirements register.

## Current Decision State

- [BR-01](./REQUIREMENTS.md) remains proposed and not yet owner-approved.
- [DEC-01](./REQUIREMENTS.md) is a proposed identity-resolution architecture candidate. It has no independent policy authority and depends on the stakeholder decision in [OPEN-08](./REQUIREMENTS.md).
- [DEC-02](./REQUIREMENTS.md) is a proposed appointment-policy enforcement architecture candidate. It has no independent policy authority and depends on the stakeholder decision in [OPEN-09](./REQUIREMENTS.md).
- [OPEN-03](./REQUIREMENTS.md), [OPEN-04](./REQUIREMENTS.md), and [OPEN-05](./REQUIREMENTS.md) are **APPROVED WITH REVISIONS** and `PLANNED` under the [recorded approval](./ACCESS_CONTROL_BASELINE.md#recorded-approval) for a bounded workforce-only Sprint 15. Runtime implementation has not begun.
- Patient-role activation, patient authentication, patient MFA, patient recovery, patient self-service, cross-facility patient writes, global patient deactivation, and identity-role assignment administration remain blocked.
- [OPEN-01](./REQUIREMENTS.md), [OPEN-02](./REQUIREMENTS.md), and [OPEN-06](./REQUIREMENTS.md) through [OPEN-12](./REQUIREMENTS.md) retain unresolved scope outside the approved workforce baseline.

## What Counts As A Decision Here

A decision in this documentation baseline is a rule that needs explicit stakeholder approval before it can be treated as a product commitment. The repository already implements many behaviors, but implementation alone does not promote them to confirmed product policy.

## Decision Handling

- Keep proposed product vision separate from baseline behavior.
- Keep open healthcare and legal rules visible until they are explicitly approved.
- Keep candidate architecture decisions distinguishable from as-built facts.
- Treat the product-owner revisions as the authoritative Sprint 15 workforce boundary. Deferred patient-facing policy remains subordinate to its unresolved OPEN records.
- Treat Habte Selasie, Repository Owner and Product Decision Authority, as the accountable decision owner recorded on 2026-08-26 in [GitHub issue #36](https://github.com/wku572/hakimi-healthcare-platform/issues/36).

## Decision Authority And Dependencies

| Stakeholder authority        | Dependent candidate architecture record | Authority boundary                                                                                                                                                                         | Explicit dependency                                                           |
| ---------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| [OPEN-08](./REQUIREMENTS.md) | [DEC-01](./REQUIREMENTS.md)             | `OPEN-08` decides patient identity, duplicate-detection, merge, demographic, and multi-facility policy. `DEC-01` may only select technical identity-resolution mechanisms.                 | `DEC-01` cannot advance until `OPEN-08` defines the policy it must implement. |
| [OPEN-09](./REQUIREMENTS.md) | [DEC-02](./REQUIREMENTS.md)             | `OPEN-09` decides appointment boundaries, blocking statuses, transitions, rescheduling, duration, and cancellation policy. `DEC-02` may only select enforcement boundaries and mechanisms. | `DEC-02` cannot advance until `OPEN-09` defines the policy it must implement. |

## Sprint 14 Decision Outcomes

The [recorded approval](./ACCESS_CONTROL_BASELINE.md#recorded-approval) establishes these outcomes without creating competing architecture-decision records. Canonical status is `PLANNED` for the approved workforce scope; blocked patient-facing scope remains documented as a limitation of the same authority record.

| Authoritative stakeholder record | Recorded outcome        | Approved Sprint 15 boundary                                                                                                                  | Blocked boundary                                                                                               |
| -------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| [OPEN-03](./REQUIREMENTS.md)     | APPROVED WITH REVISIONS | Five active workforce roles, deferred `PATIENT` role, service actors, privileges, and facility scope.                                        | Identity-role assignment administration and patient-role activation.                                           |
| [OPEN-04](./REQUIREMENTS.md)     | APPROVED WITH REVISIONS | OIDC Authorization Code with PKCE, workforce MFA, short-lived access tokens, revocation, and unique workload identities.                     | Patient authentication, patient MFA, and patient account recovery.                                             |
| [OPEN-05](./REQUIREMENTS.md)     | APPROVED WITH REVISIONS | Default deny, immutable server-derived workforce context, facility isolation, same-facility workforce access, and privacy-preserving denial. | Patient self-service, cross-facility patient writes, global patient deactivation, and patient-derived context. |

`OPEN-03` supplies the workforce role vocabulary consumed by `OPEN-05`. `OPEN-04` establishes trustworthy workforce identity, but successful authentication never grants domain access by itself. `OPEN-05` consumes both and remains responsible for operation, facility, relationship, patient, and field authorization. Blocked patient-facing capabilities cannot be implemented by extending these approvals implicitly.

Sprint 15 requires an authoritative server-side source for actor mapping, mutable workforce roles, facility scopes, activation, and revocation. Initial assignments use controlled out-of-band provisioning; practitioner-facility roster operations never grant authentication roles; token claims cannot create mutable authority. The Sprint 15 implementation specification must define the minimum persistence and migration boundary before runtime coding, without this approval-recording change selecting a design.

The approval authorizes bounded design, implementation, and testing with synthetic data only. It does not authorize production deployment or processing of real patient data. Production activation remains blocked by `OPEN-02`, `OPEN-10`, `OPEN-12`, and applicable reviews; `OPEN-06`, `OPEN-07`, and `OPEN-08` also remain unresolved for audit, retention, and patient-identity policy.
