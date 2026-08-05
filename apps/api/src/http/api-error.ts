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

export function createNotFoundError(message = 'Facility not found') {
  return new ApiError(404, 'FACILITY_NOT_FOUND', message);
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
