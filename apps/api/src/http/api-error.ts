import type {
  ApiErrorCode,
  ApiErrorDetail,
  ApiErrorResponse,
} from '@hakimi/shared';

export class ApiError extends Error {
  public readonly statusCode: number;

  public readonly code: ApiErrorCode;

  public readonly details: ApiErrorDetail[] | undefined;

  constructor(
    statusCode: number,
    code: ApiErrorCode,
    message: string,
    details?: ApiErrorDetail[],
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function createValidationError(details: ApiErrorDetail[]) {
  return new ApiError(
    400,
    'VALIDATION_ERROR',
    'Request validation failed',
    details,
  );
}

export function createInvalidJsonError() {
  return new ApiError(400, 'INVALID_JSON', 'Invalid JSON request body');
}

export function createAuthenticationRequiredError() {
  return new ApiError(
    401,
    'AUTHENTICATION_REQUIRED',
    'Authentication required',
  );
}

export function createForbiddenError() {
  return new ApiError(403, 'FORBIDDEN', 'Forbidden');
}

export function createNotFoundError(message = 'Facility not found') {
  return new ApiError(404, 'FACILITY_NOT_FOUND', message);
}

export function createFacilityNotFoundError(message = 'Facility not found') {
  return createNotFoundError(message);
}

export function createPractitionerNotFoundError(
  message = 'Practitioner not found',
) {
  return new ApiError(404, 'PRACTITIONER_NOT_FOUND', message);
}

export function createAssignmentNotFoundError(
  message = 'Assignment not found',
) {
  return new ApiError(404, 'ASSIGNMENT_NOT_FOUND', message);
}

export function createCodeConflictError() {
  return new ApiError(
    409,
    'FACILITY_CODE_CONFLICT',
    'Facility code already exists',
  );
}

export function createLicenseConflictError() {
  return new ApiError(
    409,
    'FACILITY_LICENSE_CONFLICT',
    'License number already exists',
  );
}

export function createFacilityInactiveError(message = 'Facility is inactive') {
  return new ApiError(409, 'FACILITY_INACTIVE', message);
}

export function createPractitionerCodeConflictError() {
  return new ApiError(
    409,
    'PRACTITIONER_CODE_CONFLICT',
    'Practitioner code already exists',
  );
}

export function createPractitionerLicenseConflictError() {
  return new ApiError(
    409,
    'PRACTITIONER_LICENSE_CONFLICT',
    'Practitioner license number already exists',
  );
}

export function createInactivePractitionerError(
  message = 'Practitioner is inactive',
) {
  return new ApiError(409, 'INACTIVE_PRACTITIONER', message);
}

export function createInactiveFacilityError(message = 'Facility is inactive') {
  return new ApiError(409, 'INACTIVE_FACILITY', message);
}

export function createAssignmentConflictError(
  message = 'Assignment already exists',
) {
  return new ApiError(409, 'ASSIGNMENT_CONFLICT', message);
}

export function createPatientNotFoundError(message = 'Patient not found') {
  return new ApiError(404, 'PATIENT_NOT_FOUND', message);
}

export function createInactivePatientError(message = 'Patient is inactive') {
  return new ApiError(409, 'INACTIVE_PATIENT', message);
}

export function createPatientRegistrationNotFoundError(
  message = 'Patient is not registered at this facility',
) {
  return new ApiError(404, 'PATIENT_REGISTRATION_NOT_FOUND', message);
}

export function createPatientRegistrationConflictError(
  message = 'Patient registration already exists',
) {
  return new ApiError(409, 'PATIENT_REGISTRATION_CONFLICT', message);
}

export function createAppointmentNotFoundError(
  message = 'Appointment not found',
) {
  return new ApiError(404, 'APPOINTMENT_NOT_FOUND', message);
}

export function createAppointmentConflictError(
  message = 'Appointment conflicts with an existing appointment',
) {
  return new ApiError(409, 'APPOINTMENT_CONFLICT', message);
}

export function createAppointmentStateConflictError(
  message = 'Appointment cannot be modified in its current state',
) {
  return new ApiError(409, 'APPOINTMENT_STATE_CONFLICT', message);
}

export function createInternalError() {
  return new ApiError(500, 'INTERNAL_ERROR', 'Internal server error');
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function toApiErrorResponse(error: ApiError): ApiErrorResponse {
  const payload: ApiErrorResponse = {
    error: {
      code: error.code,
      message: error.message,
    },
  };

  if (error.details && error.details.length > 0) {
    payload.error.details = error.details;
  }

  return payload;
}
