import type { Response } from 'express';
import {
  createAppointmentNotFoundError,
  createAssignmentNotFoundError,
  createAuthenticationRequiredError,
  createFacilityNotFoundError,
  createForbiddenError,
  createPatientNotFoundError,
  createPractitionerNotFoundError,
} from '../http/api-error.js';
import {
  OBSERVABILITY_EVENT_CODES,
  noopObservabilityLogger,
  type ObservabilityLogger,
} from '../observability/logger.js';
import {
  getPermittedRoles,
  hasAnyRole,
  assertFieldAuthorization,
  toDomainAuthorizationScope,
  type ProtectedOperation,
} from './policy.js';
import type { AccessRepository } from './repository.js';
import type {
  AuthorizationCandidate,
  AuthorizationContext,
  AuthorizationTarget,
  DomainAuthorizationScope,
  VerifiedOidcIdentity,
} from './types.js';

export type AuthorizationResult = Readonly<{
  context: AuthorizationContext;
  scope: DomainAuthorizationScope;
}>;

export type AccessService = Readonly<{
  resolveCandidate(
    identity: VerifiedOidcIdentity,
  ): Promise<AuthorizationCandidate>;
  authorize(
    candidate: AuthorizationCandidate,
    operation: ProtectedOperation,
    input?: Readonly<object> | undefined,
    target?: AuthorizationTarget | undefined,
  ): Promise<AuthorizationResult>;
  revokeForFacility(facilityId: string): Promise<void>;
  revokeForPractitioner(practitionerId: string): Promise<void>;
  revokeForAssignment(assignmentId: string): Promise<void>;
}>;

export type RouteAuthorizer = Readonly<{
  authorize(
    response: Response,
    operation: ProtectedOperation,
    input?: Readonly<object> | undefined,
    target?: AuthorizationTarget | undefined,
  ): Promise<AuthorizationResult>;
  revokeForFacility(facilityId: string): Promise<void>;
  revokeForPractitioner(practitionerId: string): Promise<void>;
  revokeForAssignment(assignmentId: string): Promise<void>;
}>;

export const denyRouteAuthorizer: RouteAuthorizer = {
  async authorize() {
    throw createAuthenticationRequiredError();
  },
  async revokeForFacility() {},
  async revokeForPractitioner() {},
  async revokeForAssignment() {},
};

function throwPrivacyPreservingNotFound(operation: ProtectedOperation): never {
  if (
    operation === 'createPatient' ||
    operation === 'createAppointment' ||
    operation === 'createPractitionerAssignment'
  ) {
    throw createFacilityNotFoundError();
  }

  if (operation.includes('Facility')) {
    throw createFacilityNotFoundError();
  }

  if (operation.includes('Assignment')) {
    throw createAssignmentNotFoundError();
  }

  if (operation.includes('Practitioner')) {
    throw createPractitionerNotFoundError();
  }

  if (operation.includes('Patient')) {
    throw createPatientNotFoundError();
  }

  throw createAppointmentNotFoundError();
}

export function createAccessService(
  repository: AccessRepository,
  logger: ObservabilityLogger = noopObservabilityLogger,
): AccessService {
  async function runRevocation(work: () => Promise<number>) {
    try {
      await work();
    } catch (error) {
      logger.error(OBSERVABILITY_EVENT_CODES.accessRevocationFailed);
      throw error;
    }
  }

  return {
    async resolveCandidate(identity) {
      const candidate = await repository.findAuthorizationCandidate(identity);

      if (!candidate) {
        throw createAuthenticationRequiredError();
      }

      return candidate;
    },

    async authorize(candidate, operation, input, target = {}) {
      assertFieldAuthorization(candidate, operation, input);

      if (
        !(await repository.isTargetAuthorized(operation, candidate, target))
      ) {
        throwPrivacyPreservingNotFound(operation);
      }

      const permittedRoles = getPermittedRoles(operation);
      if (!hasAnyRole(candidate, permittedRoles)) {
        throw createForbiddenError();
      }

      const sessionResult = await repository.touchSession(
        candidate,
        operation,
        target,
        permittedRoles,
      );

      if (sessionResult.status === 'TARGET_NOT_AUTHORIZED') {
        throwPrivacyPreservingNotFound(operation);
      }

      if (sessionResult.status === 'SESSION_NOT_ACTIVE') {
        throw createAuthenticationRequiredError();
      }

      const currentCandidate = sessionResult.candidate;

      return Object.freeze({
        context: Object.freeze({
          actorId: currentCandidate.actorId,
          practitionerId: currentCandidate.practitionerId,
          sessionId: sessionResult.sessionId,
          roles: currentCandidate.roles,
          facilityScopes: currentCandidate.facilityScopes,
        }),
        scope: toDomainAuthorizationScope(currentCandidate),
      });
    },

    async revokeForFacility(facilityId) {
      await runRevocation(() =>
        repository.revokeSessionsForFacility(
          facilityId,
          'FACILITY_SCOPE_CHANGED',
        ),
      );
    },

    async revokeForPractitioner(practitionerId) {
      await runRevocation(() =>
        repository.revokeSessionsForPractitioner(
          practitionerId,
          'PRACTITIONER_STATE_CHANGED',
        ),
      );
    },

    async revokeForAssignment(assignmentId) {
      await runRevocation(() =>
        repository.revokeSessionsForAssignment(
          assignmentId,
          'PRACTITIONER_ASSIGNMENT_CHANGED',
        ),
      );
    },
  };
}

export function createRouteAuthorizer(service: AccessService): RouteAuthorizer {
  return {
    async authorize(response, operation, input, target) {
      const candidate: unknown = response.locals.authorizationCandidate;
      const authenticatedOperation: unknown =
        response.locals.protectedOperation;

      if (
        typeof candidate !== 'object' ||
        candidate === null ||
        authenticatedOperation !== operation
      ) {
        throw createAuthenticationRequiredError();
      }

      return service.authorize(
        candidate as AuthorizationCandidate,
        operation,
        input,
        target,
      );
    },
    revokeForFacility: service.revokeForFacility,
    revokeForPractitioner: service.revokeForPractitioner,
    revokeForAssignment: service.revokeForAssignment,
  };
}
