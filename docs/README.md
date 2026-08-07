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

## Validation

Run the read-only baseline validator from the repository root:

```bash
node scripts/validate-product-baseline.mjs
```

The validator checks the canonical register, internal documentation links, and API traceability coverage.
