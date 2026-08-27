import { generateKeyPair, SignJWT } from 'jose';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { createAccessAuthenticationMiddleware } from '../src/access/middleware.js';
import { createOidcVerifier } from '../src/access/oidc-verifier.js';
import {
  assertFieldAuthorization,
  findProtectedOperation,
  getPermittedRoles,
  protectedOperations,
} from '../src/access/policy.js';
import {
  createAccessService,
  type AccessService,
} from '../src/access/service.js';
import {
  workforceRoles,
  type AuthorizationCandidate,
  type VerifiedOidcIdentity,
} from '../src/access/types.js';
import { createApp } from '../src/app.js';
import {
  cancelAppointmentSchema,
  updateAppointmentSchema,
} from '../src/appointments/schemas.js';
import type { AccessRuntimeEnvironment } from '../src/env.js';
import { updateHealthcareFacilitySchema } from '../src/facilities/schemas.js';
import { createForbiddenError } from '../src/http/api-error.js';
import type { ObservabilityLogger } from '../src/observability/logger.js';
import { updatePatientSchema } from '../src/patients/schemas.js';
import {
  updatePractitionerAssignmentSchema,
  updatePractitionerSchema,
} from '../src/practitioners/schemas.js';

const NOW_SECONDS = 1_800_000_000;
const ACTOR_ID = '00000000-0000-4000-8000-000000000091';
const FACILITY_ID = '00000000-0000-4000-8000-000000000092';
const PRACTITIONER_ID = '00000000-0000-4000-8000-000000000093';

const accessEnvironment: AccessRuntimeEnvironment = {
  PORT: 3001,
  NODE_ENV: 'test',
  POSTGRES_DB: 'hakimi_test',
  POSTGRES_USER: 'hakimi_test',
  POSTGRES_PASSWORD: 'synthetic-only',
  DATABASE_URL: 'postgresql://hakimi_test:synthetic-only@localhost/hakimi_test',
  LOG_LEVEL: 'info',
  OIDC_ISSUER: 'https://identity.example.test/workforce',
  OIDC_AUDIENCE: 'hakimi-api',
  OIDC_JWKS_URI: 'http://127.0.0.1:9999/jwks',
  OIDC_ALLOWED_ALGORITHMS: ['RS256'],
  OIDC_REQUIRED_ACR_VALUES: ['workforce-mfa'],
  OIDC_CLOCK_TOLERANCE_SECONDS: 5,
};

const identity: VerifiedOidcIdentity = Object.freeze({
  issuer: accessEnvironment.OIDC_ISSUER,
  subject: 'synthetic-workforce-subject',
  sessionHash: 'a'.repeat(64),
  authenticatedAt: new Date((NOW_SECONDS - 60) * 1000),
});

function candidate(
  role:
    | 'PLATFORM_ADMIN'
    | 'FACILITY_ADMIN'
    | 'SCHEDULER'
    | 'PRACTITIONER' = 'FACILITY_ADMIN',
): AuthorizationCandidate {
  return Object.freeze({
    actorId: ACTOR_ID,
    practitionerId: role === 'PRACTITIONER' ? PRACTITIONER_ID : null,
    sessionHash: identity.sessionHash,
    authenticatedAt: identity.authenticatedAt,
    authorizationTime: new Date(NOW_SECONDS * 1000),
    roles: Object.freeze([
      Object.freeze({
        role,
        facilityId:
          role === 'FACILITY_ADMIN' || role === 'SCHEDULER'
            ? FACILITY_ID
            : null,
      }),
    ]),
    facilityScopes: Object.freeze([FACILITY_ID]),
  });
}

function loggerMock(): ObservabilityLogger {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

describe('OIDC resource-server verification', () => {
  let privateKey: Awaited<ReturnType<typeof generateKeyPair>>['privateKey'];
  let publicKey: Awaited<ReturnType<typeof generateKeyPair>>['publicKey'];

  beforeAll(async () => {
    ({ privateKey, publicKey } = await generateKeyPair('RS256'));
  });

  async function token(overrides: Record<string, unknown> = {}) {
    return new SignJWT({
      sid: 'synthetic-session',
      auth_time: NOW_SECONDS - 60,
      acr: 'workforce-mfa',
      ...overrides,
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'synthetic-key' })
      .setIssuer(accessEnvironment.OIDC_ISSUER)
      .setAudience(accessEnvironment.OIDC_AUDIENCE)
      .setSubject('synthetic-workforce-subject')
      .setIssuedAt(NOW_SECONDS - 60)
      .setExpirationTime(NOW_SECONDS + 300)
      .sign(privateKey);
  }

  it('accepts only a signed, bounded workforce MFA identity', async () => {
    const verifier = createOidcVerifier(accessEnvironment, {
      keyResolver: async () => publicKey,
      now: () => new Date(NOW_SECONDS * 1000),
    });

    await expect(
      verifier.verifyAuthorizationHeader(`Bearer ${await token()}`),
    ).resolves.toEqual({
      issuer: accessEnvironment.OIDC_ISSUER,
      subject: 'synthetic-workforce-subject',
      sessionHash: expect.stringMatching(/^[0-9a-f]{64}$/),
      authenticatedAt: new Date((NOW_SECONDS - 60) * 1000),
    });
  });

  it('returns only the generic authentication error for malformed and weak tokens', async () => {
    const verifier = createOidcVerifier(accessEnvironment, {
      keyResolver: async () => publicKey,
      now: () => new Date(NOW_SECONDS * 1000),
    });

    for (const authorization of [
      undefined,
      'Bearer not-a-jwt',
      `Bearer ${await token({ acr: 'password-only' })}`,
      `Bearer ${await token({ sid: ['ambiguous'] })}`,
    ]) {
      await expect(
        verifier.verifyAuthorizationHeader(authorization),
      ).rejects.toMatchObject({
        statusCode: 401,
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required',
      });
    }
  });
});

describe('closed operation and field policy', () => {
  it('maps every protected route to one of the 24 non-health operations', () => {
    expect(new Set(protectedOperations).size).toBe(24);
    expect(findProtectedOperation('GET', '/api/v1/facilities')).toBe(
      'listHealthcareFacilities',
    );
    expect(
      findProtectedOperation('DELETE', '/api/v1/patients/:patientId'),
    ).toBe('deactivatePatient');
    expect(findProtectedOperation('GET', '/api/v1/unknown')).toBeUndefined();
  });

  it('reconciles 25 approved paths, one blocked operation, and zero patient grants', () => {
    const approvedProtectedOperations = protectedOperations.filter(
      (operation) => getPermittedRoles(operation).length > 0,
    );
    const blockedOperations = protectedOperations.filter(
      (operation) => getPermittedRoles(operation).length === 0,
    );

    expect(approvedProtectedOperations).toHaveLength(23);
    expect(blockedOperations).toEqual(['deactivatePatient']);
    expect(approvedProtectedOperations.length + 2).toBe(25);
    expect(workforceRoles).not.toContain('PATIENT');
    for (const operation of protectedOperations) {
      expect(getPermittedRoles(operation)).not.toContain('PATIENT');
    }
  });

  it('denies a mixed allowed and denied mutation without partial authorization', () => {
    expect(() =>
      assertFieldAuthorization(
        candidate('FACILITY_ADMIN'),
        'updateHealthcareFacility',
        {
          name: 'Synthetic Clinic',
          code: 'DENIED',
        },
      ),
    ).toThrowError(createForbiddenError());

    expect(() =>
      assertFieldAuthorization(
        candidate('FACILITY_ADMIN'),
        'updateHealthcareFacility',
        {
          name: 'Synthetic Clinic',
          phone: '+12025550123',
        },
      ),
    ).not.toThrow();
  });

  it('matches every accepted field in all six shared mutation schemas to the closed role allowlist', () => {
    const cases = [
      {
        operation: 'updateHealthcareFacility' as const,
        fields: Object.keys(updateHealthcareFacilitySchema.shape),
        allowed: {
          PLATFORM_ADMIN: Object.keys(updateHealthcareFacilitySchema.shape),
          FACILITY_ADMIN: [
            'name',
            'phone',
            'email',
            'region',
            'city',
            'addressLine',
          ],
        },
      },
      {
        operation: 'updatePractitioner' as const,
        fields: Object.keys(updatePractitionerSchema.shape),
        allowed: {
          PLATFORM_ADMIN: Object.keys(updatePractitionerSchema.shape),
        },
      },
      {
        operation: 'updatePractitionerAssignment' as const,
        fields: Object.keys(updatePractitionerAssignmentSchema.shape),
        allowed: {
          PLATFORM_ADMIN: Object.keys(updatePractitionerAssignmentSchema.shape),
          FACILITY_ADMIN: Object.keys(updatePractitionerAssignmentSchema.shape),
        },
      },
      {
        operation: 'updatePatient' as const,
        fields: Object.keys(updatePatientSchema.shape),
        allowed: {
          FACILITY_ADMIN: Object.keys(updatePatientSchema.shape).filter(
            (field) => field !== 'isActive',
          ),
          SCHEDULER: Object.keys(updatePatientSchema.shape).filter(
            (field) => field !== 'isActive',
          ),
        },
      },
      {
        operation: 'updateAppointment' as const,
        fields: Object.keys(updateAppointmentSchema.shape),
        allowed: {
          FACILITY_ADMIN: ['scheduledStart', 'scheduledEnd'],
          SCHEDULER: ['scheduledStart', 'scheduledEnd'],
        },
      },
      {
        operation: 'cancelAppointment' as const,
        fields: Object.keys(cancelAppointmentSchema.shape),
        allowed: {
          FACILITY_ADMIN: ['cancellationReason'],
          SCHEDULER: ['cancellationReason'],
          PRACTITIONER: ['cancellationReason'],
        },
      },
    ];
    const roles = [
      'PLATFORM_ADMIN',
      'FACILITY_ADMIN',
      'SCHEDULER',
      'PRACTITIONER',
    ] as const;

    for (const policyCase of cases) {
      for (const role of roles) {
        const allowed =
          (
            policyCase.allowed as Partial<
              Record<(typeof roles)[number], string[]>
            >
          )[role] ?? [];

        for (const field of policyCase.fields) {
          const decision = () =>
            assertFieldAuthorization(candidate(role), policyCase.operation, {
              [field]: 'synthetic-value',
            });

          if (allowed.includes(field)) {
            expect(decision).not.toThrow();
          } else {
            expect(decision).toThrowError(createForbiddenError());
          }
        }
      }
    }
  });

  it('documents one workforce scheme for 24 protected operations and two public health operations', () => {
    const specification = readFileSync(
      fileURLToPath(new URL('../openapi.yaml', import.meta.url)),
      'utf8',
    );
    const operationCount = specification.match(/operationId:/g)?.length ?? 0;
    const publicHealthCount =
      specification.match(/security: \[\]/g)?.length ?? 0;
    const authenticationResponseCount =
      specification.match(
        /\$ref: '#\/components\/responses\/AuthenticationRequired'/g,
      )?.length ?? 0;
    const forbiddenResponseCount =
      specification.match(/\$ref: '#\/components\/responses\/Forbidden'/g)
        ?.length ?? 0;

    expect(operationCount).toBe(26);
    expect(publicHealthCount).toBe(2);
    expect(authenticationResponseCount).toBe(24);
    expect(forbiddenResponseCount).toBe(24);
    expect(specification).toContain('workforceBearer:');
    expect(specification).toContain('AUTHENTICATION_REQUIRED');
    expect(specification).toContain('FORBIDDEN');
  });
});

describe('authorization decision and session boundary', () => {
  function repository(overrides: Record<string, unknown> = {}) {
    return {
      findAuthorizationCandidate: vi.fn().mockResolvedValue(candidate()),
      isTargetAuthorized: vi.fn().mockResolvedValue(true),
      touchSession: vi.fn().mockResolvedValue({
        status: 'AUTHORIZED',
        sessionId: '00000000-0000-4000-8000-000000000094',
        candidate: candidate(),
      }),
      revokeSessionsForFacility: vi.fn().mockResolvedValue(0),
      revokeSessionsForPractitioner: vi.fn().mockResolvedValue(0),
      revokeSessionsForAssignment: vi.fn().mockResolvedValue(0),
      ...overrides,
    };
  }

  it('updates activity only after field, target, and role authorization succeeds', async () => {
    const accessRepository = repository();
    const service = createAccessService(accessRepository);

    await service.authorize(
      candidate(),
      'updateHealthcareFacility',
      {
        name: 'Synthetic Clinic',
      },
      { facilityId: FACILITY_ID },
    );

    expect(accessRepository.isTargetAuthorized).toHaveBeenCalledOnce();
    expect(accessRepository.touchSession).toHaveBeenCalledWith(
      expect.anything(),
      'updateHealthcareFacility',
      { facilityId: FACILITY_ID },
      ['PLATFORM_ADMIN', 'FACILITY_ADMIN'],
    );
  });

  it('does not update activity after an out-of-scope or blocked decision', async () => {
    const outOfScopeRepository = repository({
      isTargetAuthorized: vi.fn().mockResolvedValue(false),
    });
    const outOfScopeService = createAccessService(outOfScopeRepository);

    await expect(
      outOfScopeService.authorize(candidate(), 'getPatientById', undefined, {
        patientId: '00000000-0000-4000-8000-000000000095',
      }),
    ).rejects.toMatchObject({ code: 'PATIENT_NOT_FOUND', statusCode: 404 });
    expect(outOfScopeRepository.touchSession).not.toHaveBeenCalled();

    const blockedRepository = repository();
    const blockedService = createAccessService(blockedRepository);
    await expect(
      blockedService.authorize(candidate(), 'deactivatePatient', undefined, {
        patientId: '00000000-0000-4000-8000-000000000095',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN', statusCode: 403 });
    expect(blockedRepository.touchSession).not.toHaveBeenCalled();
  });

  it('fails with the operation privacy boundary when the exact target grant is reduced before session touch', async () => {
    const accessRepository = repository({
      touchSession: vi.fn().mockResolvedValue({
        status: 'TARGET_NOT_AUTHORIZED',
      }),
    });
    const service = createAccessService(accessRepository);

    await expect(
      service.authorize(
        candidate('FACILITY_ADMIN'),
        'getHealthcareFacilityById',
        undefined,
        { facilityId: FACILITY_ID },
      ),
    ).rejects.toMatchObject({ code: 'FACILITY_NOT_FOUND', statusCode: 404 });
  });

  it('returns the generic authentication boundary when final session state is inactive', async () => {
    const accessRepository = repository({
      touchSession: vi.fn().mockResolvedValue({
        status: 'SESSION_NOT_ACTIVE',
      }),
    });
    const service = createAccessService(accessRepository);

    await expect(
      service.authorize(candidate(), 'listHealthcareFacilities'),
    ).rejects.toMatchObject({
      code: 'AUTHENTICATION_REQUIRED',
      statusCode: 401,
    });
  });

  it('emits only the stable opaque event when post-commit revocation fails', async () => {
    const rawError = 'session row actor 00000000 contains database-secret';
    const accessRepository = repository({
      revokeSessionsForFacility: vi.fn().mockRejectedValue(new Error(rawError)),
    });
    const logger = loggerMock();
    const service = createAccessService(accessRepository, logger);

    await expect(service.revokeForFacility(FACILITY_ID)).rejects.toThrow(
      rawError,
    );
    expect(logger.error).toHaveBeenCalledWith('ACCESS_REVOCATION_FAILED');
    expect(JSON.stringify(vi.mocked(logger.error).mock.calls)).not.toContain(
      rawError,
    );
    expect(JSON.stringify(vi.mocked(logger.error).mock.calls)).not.toContain(
      FACILITY_ID,
    );
  });
});

describe('HTTP access boundary privacy', () => {
  it('challenges protected requests before body validation while health remains public', async () => {
    const app = createApp({ readinessCheck: async () => true });

    const protectedResponse = await request(app)
      .post('/api/v1/patients')
      .set('Content-Type', 'application/json')
      .send('{ invalid json');
    expect(protectedResponse.status).toBe(401);
    expect(protectedResponse.headers['www-authenticate']).toBe('Bearer');
    expect(protectedResponse.body).toEqual({
      error: {
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required',
      },
    });

    await expect(request(app).get('/health/live')).resolves.toMatchObject({
      status: 200,
      body: { status: 'ok' },
    });
  });

  it('returns generic 401 and 403 envelopes with no supplied identity data', async () => {
    const logger = loggerMock();
    const verifier = {
      verifyAuthorizationHeader: vi.fn().mockResolvedValue(identity),
    };
    const service = {
      resolveCandidate: vi.fn().mockRejectedValue(createForbiddenError()),
    } as unknown as AccessService;
    const app = createApp({
      logger,
      accessAuthenticationMiddleware: createAccessAuthenticationMiddleware(
        verifier,
        service,
        logger,
      ),
    });

    const response = await request(app)
      .get('/api/v1/facilities')
      .set('Authorization', 'Bearer synthetic-secret-token');

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: { code: 'FORBIDDEN', message: 'Forbidden' },
    });
    expect(response.headers['x-request-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(JSON.stringify(vi.mocked(logger.warn).mock.calls)).not.toContain(
      'synthetic-secret-token',
    );
    expect(JSON.stringify(vi.mocked(logger.warn).mock.calls)).not.toContain(
      identity.subject,
    );
  });

  it('blocks practitioner patient-record access before any patient route executes', async () => {
    const logger = loggerMock();
    const verifier = {
      verifyAuthorizationHeader: vi.fn().mockResolvedValue(identity),
    };
    const service = {
      resolveCandidate: vi.fn().mockResolvedValue(candidate('PRACTITIONER')),
    } as unknown as AccessService;
    const app = createApp({
      logger,
      accessAuthenticationMiddleware: createAccessAuthenticationMiddleware(
        verifier,
        service,
        logger,
      ),
    });

    const response = await request(app).get('/api/v1/patients');

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: { code: 'FORBIDDEN', message: 'Forbidden' },
    });
  });

  it('preserves the generic 500 boundary for unexpected access failures', async () => {
    const logger = loggerMock();
    const rawDatabaseMessage =
      'relation workforce_actors contains secret-subject';
    const verifier = {
      verifyAuthorizationHeader: vi.fn().mockResolvedValue(identity),
    };
    const service = {
      resolveCandidate: vi
        .fn()
        .mockRejectedValue(new Error(rawDatabaseMessage)),
    } as unknown as AccessService;
    const app = createApp({
      logger,
      accessAuthenticationMiddleware: createAccessAuthenticationMiddleware(
        verifier,
        service,
        logger,
      ),
    });

    const response = await request(app).get('/api/v1/facilities');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
    expect(JSON.stringify(response.body)).not.toContain(rawDatabaseMessage);
    const loggedCalls = [
      ...vi.mocked(logger.info).mock.calls,
      ...vi.mocked(logger.warn).mock.calls,
      ...vi.mocked(logger.error).mock.calls,
    ];
    expect(JSON.stringify(loggedCalls)).not.toContain(rawDatabaseMessage);
  });
});
