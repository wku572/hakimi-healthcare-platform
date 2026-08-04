# Hakimi / ሀኪሜ

Hakimi is a Practo-like healthcare appointment platform for Ethiopia.
This repository starts as a monorepo foundation for the web app, API, shared types, and future DevOps work.

## Workspace Layout

- `apps/web` - React + Vite frontend
- `apps/api` - Node.js + Express API
- `packages/shared` - shared TypeScript types and contracts
- `docs` - project documentation
- `infrastructure` - empty structure for future DevOps configuration
- `.github/workflows` - reserved for future CI/CD

## Prerequisites

- Node.js 24+
- npm 11+

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy environment defaults if you need local overrides:

   ```bash
   cp .env.example .env
   ```

3. Start the development servers:

   ```bash
   npm run dev
   ```

## Verification

Run the project checks from the repository root:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run format:check
```

## Notes

- Do not commit secrets.
- Keep the repository strict, typed, and workspace-aware.
- DevOps infrastructure is intentionally empty for now.
