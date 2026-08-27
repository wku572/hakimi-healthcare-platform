import { createForbiddenError } from '../http/api-error.js';
import type {
  AuthorizationCandidate,
  DomainAuthorizationScope,
  WorkforceRole,
} from './types.js';

export const protectedOperations = [
  'createHealthcareFacility',
  'listHealthcareFacilities',
  'getHealthcareFacilityById',
  'updateHealthcareFacility',
  'deactivateHealthcareFacility',
  'createPractitioner',
  'listPractitioners',
  'getPractitionerById',
  'updatePractitioner',
  'deactivatePractitioner',
  'createPractitionerAssignment',
  'listPractitionerAssignments',
  'updatePractitionerAssignment',
  'deactivatePractitionerAssignment',
  'createPatient',
  'listPatients',
  'getPatientById',
  'updatePatient',
  'deactivatePatient',
  'createAppointment',
  'listAppointments',
  'getAppointmentById',
  'updateAppointment',
  'cancelAppointment',
] as const;

export type ProtectedOperation = (typeof protectedOperations)[number];

type OperationPolicy = Readonly<{
  roles: readonly WorkforceRole[];
  coarseRoles?: readonly WorkforceRole[];
  fields?: Partial<Readonly<Record<WorkforceRole, readonly string[]>>>;
}>;

const operationPolicy = {
  createHealthcareFacility: { roles: ['PLATFORM_ADMIN'] },
  listHealthcareFacilities: {
    roles: ['PLATFORM_ADMIN', 'FACILITY_ADMIN', 'SCHEDULER', 'PRACTITIONER'],
  },
  getHealthcareFacilityById: {
    roles: ['PLATFORM_ADMIN', 'FACILITY_ADMIN', 'SCHEDULER', 'PRACTITIONER'],
  },
  updateHealthcareFacility: {
    roles: ['PLATFORM_ADMIN', 'FACILITY_ADMIN'],
    fields: {
      PLATFORM_ADMIN: [
        'code',
        'name',
        'facilityType',
        'licenseNumber',
        'phone',
        'email',
        'region',
        'city',
        'addressLine',
        'isActive',
      ],
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
  deactivateHealthcareFacility: { roles: ['PLATFORM_ADMIN'] },
  createPractitioner: { roles: ['PLATFORM_ADMIN'] },
  listPractitioners: {
    roles: ['PLATFORM_ADMIN', 'FACILITY_ADMIN', 'SCHEDULER', 'PRACTITIONER'],
  },
  getPractitionerById: {
    roles: ['PLATFORM_ADMIN', 'FACILITY_ADMIN', 'SCHEDULER', 'PRACTITIONER'],
  },
  updatePractitioner: {
    roles: ['PLATFORM_ADMIN'],
    coarseRoles: ['PLATFORM_ADMIN', 'PRACTITIONER'],
    fields: {
      PLATFORM_ADMIN: [
        'code',
        'firstName',
        'middleName',
        'lastName',
        'profession',
        'licenseNumber',
        'phone',
        'email',
        'bio',
        'isActive',
      ],
    },
  },
  deactivatePractitioner: { roles: ['PLATFORM_ADMIN'] },
  createPractitionerAssignment: {
    roles: ['PLATFORM_ADMIN', 'FACILITY_ADMIN'],
  },
  listPractitionerAssignments: {
    roles: ['PLATFORM_ADMIN', 'FACILITY_ADMIN', 'SCHEDULER', 'PRACTITIONER'],
  },
  updatePractitionerAssignment: {
    roles: ['PLATFORM_ADMIN', 'FACILITY_ADMIN'],
    fields: {
      PLATFORM_ADMIN: ['roleTitle', 'department', 'isPrimary', 'isActive'],
      FACILITY_ADMIN: ['roleTitle', 'department', 'isPrimary', 'isActive'],
    },
  },
  deactivatePractitionerAssignment: {
    roles: ['PLATFORM_ADMIN', 'FACILITY_ADMIN'],
  },
  createPatient: { roles: ['FACILITY_ADMIN', 'SCHEDULER'] },
  listPatients: { roles: ['FACILITY_ADMIN', 'SCHEDULER'] },
  getPatientById: { roles: ['FACILITY_ADMIN', 'SCHEDULER'] },
  updatePatient: {
    roles: ['FACILITY_ADMIN', 'SCHEDULER'],
    coarseRoles: ['FACILITY_ADMIN', 'SCHEDULER', 'PRACTITIONER'],
    fields: {
      FACILITY_ADMIN: [
        'firstName',
        'middleName',
        'lastName',
        'dateOfBirth',
        'administrativeSex',
        'phone',
        'email',
        'addressLine',
        'city',
        'region',
      ],
      SCHEDULER: [
        'firstName',
        'middleName',
        'lastName',
        'dateOfBirth',
        'administrativeSex',
        'phone',
        'email',
        'addressLine',
        'city',
        'region',
      ],
    },
  },
  deactivatePatient: {
    roles: [],
    coarseRoles: ['FACILITY_ADMIN', 'SCHEDULER'],
  },
  createAppointment: { roles: ['FACILITY_ADMIN', 'SCHEDULER'] },
  listAppointments: {
    roles: ['FACILITY_ADMIN', 'SCHEDULER', 'PRACTITIONER'],
  },
  getAppointmentById: {
    roles: ['FACILITY_ADMIN', 'SCHEDULER', 'PRACTITIONER'],
  },
  updateAppointment: {
    roles: ['FACILITY_ADMIN', 'SCHEDULER'],
    coarseRoles: ['FACILITY_ADMIN', 'SCHEDULER', 'PRACTITIONER'],
    fields: {
      FACILITY_ADMIN: ['scheduledStart', 'scheduledEnd'],
      SCHEDULER: ['scheduledStart', 'scheduledEnd'],
    },
  },
  cancelAppointment: {
    roles: ['FACILITY_ADMIN', 'SCHEDULER', 'PRACTITIONER'],
    fields: {
      FACILITY_ADMIN: ['cancellationReason'],
      SCHEDULER: ['cancellationReason'],
      PRACTITIONER: ['cancellationReason'],
    },
  },
} as const satisfies Record<ProtectedOperation, OperationPolicy>;

const routeOperations = new Map<string, ProtectedOperation>([
  ['POST /api/v1/facilities', 'createHealthcareFacility'],
  ['GET /api/v1/facilities', 'listHealthcareFacilities'],
  ['GET /api/v1/facilities/:id', 'getHealthcareFacilityById'],
  ['PATCH /api/v1/facilities/:id', 'updateHealthcareFacility'],
  ['DELETE /api/v1/facilities/:id', 'deactivateHealthcareFacility'],
  ['POST /api/v1/practitioners', 'createPractitioner'],
  ['GET /api/v1/practitioners', 'listPractitioners'],
  ['GET /api/v1/practitioners/:practitionerId', 'getPractitionerById'],
  ['PATCH /api/v1/practitioners/:practitionerId', 'updatePractitioner'],
  ['DELETE /api/v1/practitioners/:practitionerId', 'deactivatePractitioner'],
  [
    'POST /api/v1/practitioners/:practitionerId/facilities',
    'createPractitionerAssignment',
  ],
  [
    'GET /api/v1/practitioners/:practitionerId/facilities',
    'listPractitionerAssignments',
  ],
  [
    'PATCH /api/v1/practitioners/:practitionerId/facilities/:assignmentId',
    'updatePractitionerAssignment',
  ],
  [
    'DELETE /api/v1/practitioners/:practitionerId/facilities/:assignmentId',
    'deactivatePractitionerAssignment',
  ],
  ['POST /api/v1/patients', 'createPatient'],
  ['GET /api/v1/patients', 'listPatients'],
  ['GET /api/v1/patients/:patientId', 'getPatientById'],
  ['PATCH /api/v1/patients/:patientId', 'updatePatient'],
  ['DELETE /api/v1/patients/:patientId', 'deactivatePatient'],
  ['POST /api/v1/appointments', 'createAppointment'],
  ['GET /api/v1/appointments', 'listAppointments'],
  ['GET /api/v1/appointments/:appointmentId', 'getAppointmentById'],
  ['PATCH /api/v1/appointments/:appointmentId', 'updateAppointment'],
  ['POST /api/v1/appointments/:appointmentId/cancel', 'cancelAppointment'],
]);

export function findProtectedOperation(method: string, route: string) {
  return routeOperations.get(`${method} ${route}`);
}

export function getCandidateRoles(operation: ProtectedOperation) {
  const policy: OperationPolicy = operationPolicy[operation];
  return policy.coarseRoles ?? policy.roles;
}

export function getPermittedRoles(operation: ProtectedOperation) {
  const policy: OperationPolicy = operationPolicy[operation];
  return policy.roles;
}

export function hasAnyRole(
  candidate: AuthorizationCandidate,
  roles: readonly WorkforceRole[],
) {
  return candidate.roles.some((assignment) => roles.includes(assignment.role));
}

export function assertCoarseAuthorization(
  candidate: AuthorizationCandidate,
  operation: ProtectedOperation,
) {
  if (!hasAnyRole(candidate, getCandidateRoles(operation))) {
    throw createForbiddenError();
  }
}

export function assertFieldAuthorization(
  candidate: AuthorizationCandidate,
  operation: ProtectedOperation,
  input: Readonly<object> | undefined,
) {
  if (!input) {
    return;
  }

  const fields = Object.keys(input);
  const policy: OperationPolicy = operationPolicy[operation];
  const permitted = policy.roles.some((role) => {
    if (!candidate.roles.some((assignment) => assignment.role === role)) {
      return false;
    }

    const allowedFields = policy.fields?.[role];
    return allowedFields
      ? fields.every((field) => allowedFields.includes(field))
      : true;
  });

  if (!permitted) {
    throw createForbiddenError();
  }
}

export function toDomainAuthorizationScope(
  candidate: AuthorizationCandidate,
): DomainAuthorizationScope {
  return Object.freeze({
    actorId: candidate.actorId,
    isPlatformAdmin: candidate.roles.some(
      (assignment) => assignment.role === 'PLATFORM_ADMIN',
    ),
    isPractitioner: candidate.roles.some(
      (assignment) => assignment.role === 'PRACTITIONER',
    ),
    facilityIds: Object.freeze([...candidate.facilityScopes]),
    practitionerId: candidate.practitionerId,
  });
}
