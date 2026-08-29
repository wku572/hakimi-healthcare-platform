# Documentation Baseline

This directory contains the product baseline package for Hakimi / ሀኪሜ.

## Contents

- [PRODUCT_VISION.md](./PRODUCT_VISION.md) - proposed product direction and scope boundaries
- [CURRENT_SYSTEM.md](./CURRENT_SYSTEM.md) - as-built snapshot of the current repository
- [REQUIREMENTS.md](./REQUIREMENTS.md) - the single canonical requirements register
- [PRODUCT_BACKLOG.md](./PRODUCT_BACKLOG.md) - deferred product work that depends on open decisions
- [DECISIONS.md](./DECISIONS.md) - the recorded decision posture and open architecture/product choices
- [OPEN_DECISIONS.md](./OPEN_DECISIONS.md) - unresolved stakeholder questions that remain explicitly open
- [TRACEABILITY.md](./TRACEABILITY.md) - operation-level mapping from API surface to requirements and tests
- [ACCESS_CONTROL_BASELINE.md](./ACCESS_CONTROL_BASELINE.md) - accountable approved-with-revisions workforce identity and access-control baseline, authoritative-state constraints, and production gate
- [SPRINT_15_IMPLEMENTATION_SPEC.md](./SPRINT_15_IMPLEMENTATION_SPEC.md) - implemented workforce persistence, OIDC resource-server, provisioning, authorization, and synthetic-test boundary
- [PRODUCTION_READINESS_GOVERNANCE.md](./PRODUCTION_READINESS_GOVERNANCE.md) - proposed Sprint 16 privacy, audit, retention, patient-identity, legal-review, operational-ownership, and production-gate decisions
- [OPEN10_HYPOTHETICAL_OPERATING_MODEL.md](./OPEN10_HYPOTHETICAL_OPERATING_MODEL.md) - hypothetical synthetic-data-only operating-model and data-flow evidence pack for qualified `OPEN-10` review
- [OPEN10_PROPOSED_DATA_INVENTORY.md](./OPEN10_PROPOSED_DATA_INVENTORY.md) - repository-reconciled proposed data inventory for qualified `OPEN-10` review
- [OPEN10_HYPOTHETICAL_DATA_FLOW.md](./OPEN10_HYPOTHETICAL_DATA_FLOW.md) - hypothetical current/future flow and trust-boundary reconciliation for qualified `OPEN-10` review
- [OPERATIONS_RUNBOOK.md](./OPERATIONS_RUNBOOK.md) - privacy-safe runtime event catalogue and diagnostic procedures

## Validation

Run the read-only baseline validator from the repository root:

```bash
node scripts/validate-product-baseline.mjs
```

The validator checks the canonical register, internal documentation links, and API traceability coverage. Sprint-specific matrix reconciliation and documentation-only scope are also reviewed with the procedures documented in the applicable governance package.
