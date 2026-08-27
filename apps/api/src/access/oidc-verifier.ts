import { createHash } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { createAuthenticationRequiredError } from '../http/api-error.js';
import type { AccessRuntimeEnvironment } from '../env.js';
import type { VerifiedOidcIdentity } from './types.js';

const MAX_TOKEN_BYTES = 16 * 1024;
const MAX_TOKEN_AGE_SECONDS = 600;
const MAX_AUTHENTICATION_AGE_SECONDS = 8 * 60 * 60;
const MAX_SUBJECT_LENGTH = 255;
const MAX_SESSION_ID_LENGTH = 255;

type OidcVerifierOptions = Readonly<{
  keyResolver?: JWTVerifyGetKey | undefined;
  now?: (() => Date) | undefined;
}>;

export type OidcVerifier = Readonly<{
  verifyAuthorizationHeader(value: unknown): Promise<VerifiedOidcIdentity>;
}>;

function extractBearerToken(value: unknown) {
  if (
    typeof value !== 'string' ||
    value.includes(',') ||
    Buffer.byteLength(value, 'utf8') > MAX_TOKEN_BYTES + 16
  ) {
    throw createAuthenticationRequiredError();
  }

  const match = /^Bearer ([^\s]+)$/.exec(value);
  const token = match?.[1];

  if (!token || Buffer.byteLength(token, 'utf8') > MAX_TOKEN_BYTES) {
    throw createAuthenticationRequiredError();
  }

  return token;
}

function requireBoundedClaim(value: unknown, maximumLength: number): string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > maximumLength
  ) {
    throw createAuthenticationRequiredError();
  }

  return value;
}

export function createOidcVerifier(
  environment: AccessRuntimeEnvironment,
  options: OidcVerifierOptions = {},
): OidcVerifier {
  const keyResolver =
    options.keyResolver ??
    createRemoteJWKSet(new URL(environment.OIDC_JWKS_URI), {
      timeoutDuration: 5_000,
      cooldownDuration: 30_000,
      cacheMaxAge: 10 * 60_000,
    });
  const now = options.now ?? (() => new Date());

  return {
    async verifyAuthorizationHeader(value) {
      try {
        const token = extractBearerToken(value);
        const currentTime = Math.floor(now().getTime() / 1000);
        const { payload, protectedHeader } = await jwtVerify(
          token,
          keyResolver,
          {
            algorithms: environment.OIDC_ALLOWED_ALGORITHMS,
            issuer: environment.OIDC_ISSUER,
            audience: environment.OIDC_AUDIENCE,
            clockTolerance: environment.OIDC_CLOCK_TOLERANCE_SECONDS,
            currentDate: new Date(currentTime * 1000),
            requiredClaims: [
              'iss',
              'aud',
              'sub',
              'sid',
              'iat',
              'exp',
              'auth_time',
              'acr',
            ],
          },
        );

        if (
          typeof protectedHeader.kid !== 'string' ||
          protectedHeader.kid.length === 0 ||
          protectedHeader.kid.length > 255 ||
          payload.iss !== environment.OIDC_ISSUER ||
          payload.aud !== environment.OIDC_AUDIENCE ||
          typeof payload.iat !== 'number' ||
          typeof payload.exp !== 'number' ||
          !Number.isInteger(payload.iat) ||
          !Number.isInteger(payload.exp) ||
          payload.iat >
            currentTime + environment.OIDC_CLOCK_TOLERANCE_SECONDS ||
          payload.exp - payload.iat > MAX_TOKEN_AGE_SECONDS ||
          payload.exp - payload.iat <= 0 ||
          typeof payload.auth_time !== 'number' ||
          !Number.isInteger(payload.auth_time) ||
          payload.auth_time >
            currentTime + environment.OIDC_CLOCK_TOLERANCE_SECONDS ||
          currentTime - payload.auth_time > MAX_AUTHENTICATION_AGE_SECONDS ||
          typeof payload.acr !== 'string' ||
          !environment.OIDC_REQUIRED_ACR_VALUES.includes(payload.acr)
        ) {
          throw createAuthenticationRequiredError();
        }

        if (
          payload.nbf !== undefined &&
          (typeof payload.nbf !== 'number' || !Number.isInteger(payload.nbf))
        ) {
          throw createAuthenticationRequiredError();
        }

        const subject = requireBoundedClaim(payload.sub, MAX_SUBJECT_LENGTH);
        const sessionId = requireBoundedClaim(
          payload.sid,
          MAX_SESSION_ID_LENGTH,
        );

        return Object.freeze({
          issuer: environment.OIDC_ISSUER,
          subject,
          sessionHash: createHash('sha256')
            .update(sessionId, 'utf8')
            .digest('hex'),
          authenticatedAt: new Date(payload.auth_time * 1000),
        });
      } catch {
        throw createAuthenticationRequiredError();
      }
    },
  };
}
