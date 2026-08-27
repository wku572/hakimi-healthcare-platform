import type { ErrorRequestHandler } from 'express';
import type { ApiErrorResponse } from '@hakimi/shared';
import {
  createInternalError,
  createInvalidJsonError,
  isApiError,
  toApiErrorResponse,
} from './api-error.js';
import { getRequestId } from './request-observability.js';
import {
  OBSERVABILITY_EVENT_CODES,
  noopObservabilityLogger,
  type ObservabilityLogger,
} from '../observability/logger.js';

function isMalformedJsonError(error: unknown) {
  return (
    error instanceof SyntaxError &&
    'body' in error &&
    typeof (error as { status?: number }).status === 'number' &&
    (error as { status?: number }).status === 400
  );
}

export function createApiErrorHandler(
  logger: ObservabilityLogger,
): ErrorRequestHandler {
  return (error: unknown, _request, response, next) => {
    void _request;
    void next;
    const requestId = getRequestId(response);

    if (isMalformedJsonError(error)) {
      const invalidJsonError = createInvalidJsonError();
      const payload: ApiErrorResponse = toApiErrorResponse(invalidJsonError);
      logger.warn(OBSERVABILITY_EVENT_CODES.httpApiError, {
        ...(requestId ? { requestId } : {}),
        errorCode: invalidJsonError.code,
        statusCode: invalidJsonError.statusCode,
      });
      response.status(400).json(payload);
      return;
    }

    if (isApiError(error)) {
      const payload: ApiErrorResponse = toApiErrorResponse(error);
      logger.warn(OBSERVABILITY_EVENT_CODES.httpApiError, {
        ...(requestId ? { requestId } : {}),
        errorCode: error.code,
        statusCode: error.statusCode,
      });
      if (error.statusCode === 401) {
        response.setHeader('WWW-Authenticate', 'Bearer');
      }
      response.status(error.statusCode).json(payload);
      return;
    }

    void error;
    logger.error(OBSERVABILITY_EVENT_CODES.httpUnexpectedError, {
      ...(requestId ? { requestId } : {}),
      errorCode: 'INTERNAL_ERROR',
      statusCode: 500,
    });
    const payload: ApiErrorResponse = toApiErrorResponse(createInternalError());
    response.status(500).json(payload);
  };
}

export const apiErrorHandler = createApiErrorHandler(noopObservabilityLogger);
