# Local OIDC Development Provider

This document describes the Phase 1 local identity-provider foundation and
Phase 2 PostgreSQL-backed synthetic workforce authorization data for Hakimi
workforce authentication development.

Status:

- Development only.
- Synthetic data only.
- Not approved for production.
- No patient authentication or patient self-service.
- No production MFA claim.
- PostgreSQL provisioning is development-only and must be explicitly enabled.
- React login, logout, token storage, and protected routing remain a later phase.

## Provider

The local Compose profile uses Keycloak `26.3.5`:

```bash
docker compose --profile local-oidc up -d oidc
```

The service imports
[`infrastructure/local-oidc/hakimi-local-realm.json`](../infrastructure/local-oidc/hakimi-local-realm.json)
on startup and publishes only the loopback development port
`127.0.0.1:8080`.

## Realm

| Setting                    | Value                                                                     |
| -------------------------- | ------------------------------------------------------------------------- |
| Realm                      | `hakimi-local`                                                            |
| Issuer                     | `http://localhost:8080/realms/hakimi-local`                               |
| JWKS                       | `http://localhost:8080/realms/hakimi-local/protocol/openid-connect/certs` |
| API audience               | `hakimi-api`                                                              |
| Required development `acr` | `workforce-mfa`                                                           |

The `workforce-mfa` `acr` value is a local development compatibility claim. It
does not prove production MFA and must not be used as production assurance
evidence.

## Browser Client

| Setting                      | Value                                                                        |
| ---------------------------- | ---------------------------------------------------------------------------- |
| Client ID                    | `hakimi-web`                                                                 |
| Client type                  | Public browser client                                                        |
| Flow                         | Authorization Code with PKCE `S256`                                          |
| Implicit flow                | Disabled                                                                     |
| Resource-owner password flow | Disabled                                                                     |
| Service account              | Disabled                                                                     |
| Redirect URIs                | `http://localhost:5173/auth/callback`, `http://127.0.0.1:5173/auth/callback` |
| Web origins                  | `http://localhost:5173`, `http://127.0.0.1:5173`                             |

The browser client has no client secret. Hakimi authorization never trusts
Keycloak realm roles or client roles; the API continues deriving actor, role,
facility-scope, session, and revocation state from PostgreSQL.

## Fictional Workforce User

| Setting                    | Value                                  |
| -------------------------- | -------------------------------------- |
| Username                   | `demo.scheduler`                       |
| Display name               | `Demo Scheduler`                       |
| Deterministic OIDC subject | `00000000-0000-4000-8000-0000000000d5` |
| Password                   | `change-me-local-demo-only`            |

The password is a local demonstration credential committed only for deterministic
development import. It is not a production credential and must not be reused
outside local development.

## API Environment For Host-Run Development

The API verifier already requires exact issuer, audience, signature, token age,
authentication age, `sub`, `sid`, and `acr`. Do not relax those checks for the
local provider.

When running the API on the host with `npm run dev --workspace @hakimi/api`,
use these private `.env` overrides:

```env
NODE_ENV=development
OIDC_ISSUER=http://localhost:8080/realms/hakimi-local
OIDC_AUDIENCE=hakimi-api
OIDC_JWKS_URI=http://localhost:8080/realms/hakimi-local/protocol/openid-connect/certs
OIDC_ALLOWED_ALGORITHMS=RS256
OIDC_REQUIRED_ACR_VALUES=workforce-mfa
OIDC_CLOCK_TOLERANCE_SECONDS=30
HAKIMI_ENABLE_LOCAL_DEMO_PROVISIONING=true
```

The production-shaped Compose `api` service still runs with
`NODE_ENV=production`. The API environment validator intentionally rejects
non-HTTPS JWKS URLs in production, except for non-production loopback
development. Run the API on the host for this Phase 1 local OIDC diagnostic
path, or provide a production-appropriate HTTPS issuer and JWKS.

## PostgreSQL-Backed Synthetic Authorization Data

After PostgreSQL is running and migrations are applied, provision the fictional
local demo actor and scheduling records with:

```bash
npm run access:provision:local-demo
```

The command refuses to run when `NODE_ENV=production` and also refuses to run
unless `HAKIMI_ENABLE_LOCAL_DEMO_PROVISIONING=true` is set in the caller
environment or private `.env` file.

Provisioned records are deterministic and idempotent:

- workforce actor `Demo Scheduler`, mapped to issuer
  `http://localhost:8080/realms/hakimi-local` and OIDC subject
  `00000000-0000-4000-8000-0000000000d5`;
- `SCHEDULER` role scoped to `Addis Family Clinic`;
- `Addis Family Clinic` plus one out-of-scope fictional facility for isolation
  checks;
- fictional practitioners and practitioner-facility assignments;
- fictional patients and facility registrations;
- one future scheduled appointment for the in-scope facility.

The command does not create a workforce session. Sessions remain
post-authentication records created by the existing API authorization boundary
when a valid OIDC bearer token reaches a protected route.

## Discovery And JWKS Checks

```bash
docker compose --profile local-oidc up -d oidc
curl http://localhost:8080/realms/hakimi-local/.well-known/openid-configuration
curl http://localhost:8080/realms/hakimi-local/protocol/openid-connect/certs
```

Expected:

- discovery returns issuer `http://localhost:8080/realms/hakimi-local`;
- JWKS contains an asymmetric signing key;
- no Hakimi healthcare API route becomes unauthenticated.

## Diagnostic Authorization Code + PKCE Flow

Use a standards-compliant browser or HTTP diagnostic client to request
Authorization Code with PKCE against:

```text
http://localhost:8080/realms/hakimi-local/protocol/openid-connect/auth
```

Required request characteristics:

- `client_id=hakimi-web`;
- `response_type=code`;
- `scope=openid`;
- redirect URI exactly `http://localhost:5173/auth/callback` or
  `http://127.0.0.1:5173/auth/callback`;
- `code_challenge_method=S256`;
- a fresh PKCE verifier/challenge pair.

Exchange the returned code at:

```text
http://localhost:8080/realms/hakimi-local/protocol/openid-connect/token
```

Do not publish full access tokens in logs, tickets, screenshots, or commits.
Decode claims locally only to confirm:

- `iss` is `http://localhost:8080/realms/hakimi-local`;
- `aud` includes `hakimi-api`;
- `sub` is `00000000-0000-4000-8000-0000000000d5`;
- `sid` is present;
- `iat` and `exp` are present and bounded;
- `auth_time` is present;
- `acr` is `workforce-mfa`.

After Phase 2 provisioning, the same valid token should resolve to the
PostgreSQL-backed `Demo Scheduler` actor and authorize facility-scoped scheduler
operations. Unknown OIDC subjects, inactive actors, missing roles, and
out-of-scope facility requests continue to fail through the existing
privacy-preserving authentication and authorization responses.
