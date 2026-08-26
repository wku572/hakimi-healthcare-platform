import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import type { RequestHandler, Response } from 'express';
import {
  OBSERVABILITY_EVENT_CODES,
  type ObservabilityLogger,
} from '../observability/logger.js';

const REQUEST_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

type RouteDefinition = {
  method: string;
  pattern: RegExp;
  template: string;
};

const ROUTES: RouteDefinition[] = [
  { method: 'GET', pattern: /^\/health\/live\/?$/, template: '/health/live' },
  {
    method: 'GET',
    pattern: /^\/health\/ready\/?$/,
    template: '/health/ready',
  },
  {
    method: 'POST',
    pattern: /^\/api\/v1\/facilities\/?$/,
    template: '/api/v1/facilities',
  },
  {
    method: 'GET',
    pattern: /^\/api\/v1\/facilities\/?$/,
    template: '/api/v1/facilities',
  },
  {
    method: 'GET',
    pattern: /^\/api\/v1\/facilities\/[^/]+\/?$/,
    template: '/api/v1/facilities/:id',
  },
  {
    method: 'PATCH',
    pattern: /^\/api\/v1\/facilities\/[^/]+\/?$/,
    template: '/api/v1/facilities/:id',
  },
  {
    method: 'DELETE',
    pattern: /^\/api\/v1\/facilities\/[^/]+\/?$/,
    template: '/api/v1/facilities/:id',
  },
  {
    method: 'POST',
    pattern: /^\/api\/v1\/practitioners\/?$/,
    template: '/api/v1/practitioners',
  },
  {
    method: 'GET',
    pattern: /^\/api\/v1\/practitioners\/?$/,
    template: '/api/v1/practitioners',
  },
  {
    method: 'GET',
    pattern: /^\/api\/v1\/practitioners\/[^/]+\/?$/,
    template: '/api/v1/practitioners/:practitionerId',
  },
  {
    method: 'PATCH',
    pattern: /^\/api\/v1\/practitioners\/[^/]+\/?$/,
    template: '/api/v1/practitioners/:practitionerId',
  },
  {
    method: 'DELETE',
    pattern: /^\/api\/v1\/practitioners\/[^/]+\/?$/,
    template: '/api/v1/practitioners/:practitionerId',
  },
  {
    method: 'POST',
    pattern: /^\/api\/v1\/practitioners\/[^/]+\/facilities\/?$/,
    template: '/api/v1/practitioners/:practitionerId/facilities',
  },
  {
    method: 'GET',
    pattern: /^\/api\/v1\/practitioners\/[^/]+\/facilities\/?$/,
    template: '/api/v1/practitioners/:practitionerId/facilities',
  },
  {
    method: 'PATCH',
    pattern: /^\/api\/v1\/practitioners\/[^/]+\/facilities\/[^/]+\/?$/,
    template: '/api/v1/practitioners/:practitionerId/facilities/:assignmentId',
  },
  {
    method: 'DELETE',
    pattern: /^\/api\/v1\/practitioners\/[^/]+\/facilities\/[^/]+\/?$/,
    template: '/api/v1/practitioners/:practitionerId/facilities/:assignmentId',
  },
  {
    method: 'POST',
    pattern: /^\/api\/v1\/patients\/?$/,
    template: '/api/v1/patients',
  },
  {
    method: 'GET',
    pattern: /^\/api\/v1\/patients\/?$/,
    template: '/api/v1/patients',
  },
  {
    method: 'GET',
    pattern: /^\/api\/v1\/patients\/[^/]+\/?$/,
    template: '/api/v1/patients/:patientId',
  },
  {
    method: 'PATCH',
    pattern: /^\/api\/v1\/patients\/[^/]+\/?$/,
    template: '/api/v1/patients/:patientId',
  },
  {
    method: 'DELETE',
    pattern: /^\/api\/v1\/patients\/[^/]+\/?$/,
    template: '/api/v1/patients/:patientId',
  },
  {
    method: 'POST',
    pattern: /^\/api\/v1\/appointments\/?$/,
    template: '/api/v1/appointments',
  },
  {
    method: 'GET',
    pattern: /^\/api\/v1\/appointments\/?$/,
    template: '/api/v1/appointments',
  },
  {
    method: 'GET',
    pattern: /^\/api\/v1\/appointments\/[^/]+\/?$/,
    template: '/api/v1/appointments/:appointmentId',
  },
  {
    method: 'PATCH',
    pattern: /^\/api\/v1\/appointments\/[^/]+\/?$/,
    template: '/api/v1/appointments/:appointmentId',
  },
  {
    method: 'POST',
    pattern: /^\/api\/v1\/appointments\/[^/]+\/cancel\/?$/,
    template: '/api/v1/appointments/:appointmentId/cancel',
  },
];

export function isValidRequestId(value: unknown): value is string {
  return typeof value === 'string' && REQUEST_ID_PATTERN.test(value);
}

export function resolveRequestId(value: unknown) {
  return isValidRequestId(value) ? value : randomUUID();
}

export function normalizeRouteTemplate(method: string, path: string) {
  const route = ROUTES.find(
    (candidate) => candidate.method === method && candidate.pattern.test(path),
  );

  return route?.template ?? 'UNMATCHED';
}

export function getRequestId(response: Response) {
  const value: unknown = response.locals.requestId;
  return isValidRequestId(value) ? value : undefined;
}

function logCompletion(
  logger: ObservabilityLogger,
  statusCode: number,
  fields: {
    requestId: string;
    method: string;
    route: string;
    durationMs: number;
  },
) {
  const completeFields = { ...fields, statusCode };

  if (statusCode >= 500) {
    logger.error(
      OBSERVABILITY_EVENT_CODES.httpRequestCompleted,
      completeFields,
    );
    return;
  }

  if (statusCode >= 400) {
    logger.warn(OBSERVABILITY_EVENT_CODES.httpRequestCompleted, completeFields);
    return;
  }

  logger.info(OBSERVABILITY_EVENT_CODES.httpRequestCompleted, completeFields);
}

export function createRequestObservabilityMiddleware(
  logger: ObservabilityLogger,
): RequestHandler {
  return (request, response, next) => {
    const requestId = resolveRequestId(request.headers['x-request-id']);
    const method = /^[A-Z]{3,10}$/.test(request.method)
      ? request.method
      : 'UNKNOWN';
    const route = normalizeRouteTemplate(method, request.path);
    const startedAt = performance.now();
    let completed = false;

    response.locals.requestId = requestId;
    response.setHeader('X-Request-ID', requestId);

    response.once('finish', () => {
      completed = true;
      logCompletion(logger, response.statusCode, {
        requestId,
        method,
        route,
        durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
      });
    });

    response.once('close', () => {
      if (completed) {
        return;
      }

      logger.warn(OBSERVABILITY_EVENT_CODES.httpRequestAborted, {
        requestId,
        method,
        route,
        durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
      });
    });

    next();
  };
}
