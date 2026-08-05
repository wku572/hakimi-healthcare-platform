import type { ErrorRequestHandler } from 'express';
import type { ApiErrorResponse } from '@hakimi/shared';
import {
  createInternalError,
  createInvalidJsonError,
  isApiError,
  toApiErrorResponse,
} from './api-error.js';

function isMalformedJsonError(error: unknown) {
  return (
    error instanceof SyntaxError &&
    'body' in error &&
    typeof (error as { status?: number }).status === 'number' &&
    (error as { status?: number }).status === 400
  );
}

function safeLogUnexpectedError(error: unknown) {
  if (error instanceof Error) {
    console.error('Unexpected API error:', error.message);
    return;
  }

  console.error('Unexpected API error:', String(error));
}

export const apiErrorHandler: ErrorRequestHandler = (
  error: unknown,
  _request,
  response,
  next,
) => {
  void _request;
  void next;

  if (isMalformedJsonError(error)) {
    const payload: ApiErrorResponse = toApiErrorResponse(
      createInvalidJsonError(),
    );
    response.status(400).json(payload);
    return;
  }

  if (isApiError(error)) {
    const payload: ApiErrorResponse = toApiErrorResponse(error);
    response.status(error.statusCode).json(payload);
    return;
  }

  safeLogUnexpectedError(error);
  const payload: ApiErrorResponse = toApiErrorResponse(createInternalError());
  response.status(500).json(payload);
};
