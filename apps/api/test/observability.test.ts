import { EventEmitter } from 'node:events';
import type { Request, Response } from 'express';
import { Router } from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import {
  createPatientNotFoundError,
  createValidationError,
} from '../src/http/api-error.js';
import {
  createStructuredLogger,
  OBSERVABILITY_EVENT_CODES,
  type SafeLogFields,
} from '../src/observability/logger.js';
import {
  createRequestObservabilityMiddleware,
  isValidRequestId,
  normalizeRouteTemplate,
} from '../src/http/request-observability.js';
import { allowAllAccessMiddleware } from './helpers/access.js';

const validRequestId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function createRecordingLogger(level: 'info' | 'warn' | 'error' = 'info') {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const logger = createStructuredLogger({
    service: 'hakimi-api',
    level,
    sink: {
      stdout(line) {
        stdout.push(line);
      },
      stderr(line) {
        stderr.push(line);
      },
    },
    now: () => new Date('2026-08-20T08:00:00.000Z'),
  });

  return { logger, stdout, stderr };
}

function parseLines(lines: string[]) {
  return lines.map((line) => JSON.parse(line) as Record<string, unknown>);
}

describe('request observability', () => {
  it('propagates a valid request ID and logs a normalized route', async () => {
    const recording = createRecordingLogger();
    const app = createApp({ logger: recording.logger });

    const response = await request(app)
      .get('/health/live?email=patient@example.org')
      .set('X-Request-ID', validRequestId);

    expect(response.status).toBe(200);
    expect(response.headers['x-request-id']).toBe(validRequestId);

    const entries = parseLines(recording.stdout);
    expect(entries).toContainEqual({
      timestamp: '2026-08-20T08:00:00.000Z',
      severity: 'INFO',
      service: 'hakimi-api',
      eventCode: 'HTTP_REQUEST_COMPLETED',
      requestId: validRequestId,
      method: 'GET',
      route: '/health/live',
      statusCode: 200,
      durationMs: expect.any(Number),
    });
    expect([...recording.stdout, ...recording.stderr].join(' ')).not.toContain(
      'patient@example.org',
    );
  });

  it('replaces invalid, uppercase, and oversized request IDs', async () => {
    const invalidValues = [
      'patient@example.org',
      validRequestId.toUpperCase(),
      'a'.repeat(200),
    ];

    for (const invalidValue of invalidValues) {
      const recording = createRecordingLogger();
      const app = createApp({ logger: recording.logger });
      const response = await request(app)
        .get('/health/live')
        .set('X-Request-ID', invalidValue);
      const replacement = response.headers['x-request-id'];

      expect(isValidRequestId(replacement)).toBe(true);
      expect(replacement).not.toBe(invalidValue);
      expect(
        [...recording.stdout, ...recording.stderr].join(' '),
      ).not.toContain(invalidValue);
    }
  });

  it('returns request IDs for validation, known, unexpected, and 404 errors', async () => {
    const recording = createRecordingLogger();
    const router = Router();
    router.post('/', (_request, response) => response.status(204).send());
    router.patch('/:patientId', (_request, _response, next) => {
      next(
        createValidationError([
          { field: 'First name', message: 'First name is required' },
        ]),
      );
    });
    router.get('/:patientId', (incomingRequest, _response, next) => {
      if (incomingRequest.params.patientId === 'known') {
        next(createPatientNotFoundError());
        return;
      }

      next(new Error('patient@example.org database exploded'));
    });
    const app = createApp({
      logger: recording.logger,
      patientsRouter: router,
      accessAuthenticationMiddleware: allowAllAccessMiddleware,
    });

    const malformed = await request(app)
      .post('/api/v1/patients')
      .set('Content-Type', 'application/json')
      .send('{');
    const known = await request(app).get('/api/v1/patients/known');
    const validation = await request(app).patch('/api/v1/patients/invalid');
    const unexpected = await request(app).get('/api/v1/patients/unexpected');
    const missing = await request(app).get(
      '/not-found/patient@example.org?phone=%2B251911000000',
    );

    for (const response of [
      malformed,
      known,
      validation,
      unexpected,
      missing,
    ]) {
      expect(isValidRequestId(response.headers['x-request-id'])).toBe(true);
    }

    expect(malformed.status).toBe(400);
    expect(malformed.body).toEqual({
      error: { code: 'INVALID_JSON', message: 'Invalid JSON request body' },
    });
    expect(known.status).toBe(404);
    expect(known.body).toEqual({
      error: { code: 'PATIENT_NOT_FOUND', message: 'Patient not found' },
    });
    expect(validation.status).toBe(400);
    expect(validation.body).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: [{ field: 'First name', message: 'First name is required' }],
      },
    });
    expect(unexpected.status).toBe(500);
    expect(unexpected.body).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
    expect(missing.status).toBe(404);

    const allLogs = [...recording.stdout, ...recording.stderr].join(' ');
    expect(allLogs).not.toContain('patient@example.org');
    expect(allLogs).not.toContain('+251911000000');
    expect(allLogs).not.toContain('database exploded');
    expect(allLogs).not.toContain('stack');

    const entries = parseLines(recording.stderr);
    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventCode: OBSERVABILITY_EVENT_CODES.httpApiError,
          errorCode: 'INVALID_JSON',
          statusCode: 400,
        }),
        expect.objectContaining({
          eventCode: OBSERVABILITY_EVENT_CODES.httpApiError,
          errorCode: 'PATIENT_NOT_FOUND',
          statusCode: 404,
        }),
        expect.objectContaining({
          eventCode: OBSERVABILITY_EVENT_CODES.httpApiError,
          errorCode: 'VALIDATION_ERROR',
          statusCode: 400,
        }),
        expect.objectContaining({
          eventCode: OBSERVABILITY_EVENT_CODES.httpUnexpectedError,
          errorCode: 'INTERNAL_ERROR',
          statusCode: 500,
        }),
        expect.objectContaining({
          eventCode: OBSERVABILITY_EVENT_CODES.httpRequestCompleted,
          route: 'UNMATCHED',
          statusCode: 404,
        }),
      ]),
    );
  });

  it('drops unknown fields and unsafe values at the logger boundary', () => {
    const recording = createRecordingLogger();
    const unsafeFields = {
      requestId: 'patient@example.org',
      route: '/api/v1/patients/12345',
      statusCode: 500,
      body: { email: 'patient@example.org' },
      rawError: 'database exploded',
      authorization: 'Bearer secret',
    } as unknown as SafeLogFields;

    recording.logger.error(
      OBSERVABILITY_EVENT_CODES.httpUnexpectedError,
      unsafeFields,
    );

    expect(parseLines(recording.stderr)).toEqual([
      {
        timestamp: '2026-08-20T08:00:00.000Z',
        severity: 'ERROR',
        service: 'hakimi-api',
        eventCode: 'HTTP_UNEXPECTED_ERROR',
        statusCode: 500,
      },
    ]);
  });

  it('emits severity and never emits the legacy level field', () => {
    const recording = createRecordingLogger();

    recording.logger.info(OBSERVABILITY_EVENT_CODES.apiStarted, { port: 3001 });

    const [entry] = parseLines(recording.stdout);
    expect(entry).toMatchObject({ severity: 'INFO' });
    expect(entry).not.toHaveProperty('level');
  });

  it('suppresses events below the configured log level', () => {
    const recording = createRecordingLogger('warn');

    recording.logger.info(OBSERVABILITY_EVENT_CODES.apiStarted, { port: 3001 });
    recording.logger.warn(OBSERVABILITY_EVENT_CODES.readinessCheckFailed);
    recording.logger.error(
      OBSERVABILITY_EVENT_CODES.postgresConnectivityFailed,
    );

    expect(recording.stdout).toEqual([]);
    expect(
      parseLines(recording.stderr).map((entry) => entry.eventCode),
    ).toEqual(['READINESS_CHECK_FAILED', 'POSTGRES_CONNECTIVITY_FAILED']);
  });

  it('logs an aborted request once without a completion event', () => {
    const recording = createRecordingLogger();
    const middleware = createRequestObservabilityMiddleware(recording.logger);
    const response = Object.assign(new EventEmitter(), {
      locals: {},
      setHeader: vi.fn(),
      statusCode: 200,
    }) as unknown as Response;
    const next = vi.fn();

    middleware(
      {
        headers: { 'x-request-id': validRequestId },
        method: 'GET',
        path: '/health/live',
      } as unknown as Request,
      response,
      next,
    );
    response.emit('close');
    response.emit('close');

    expect(next).toHaveBeenCalledTimes(1);
    expect(parseLines(recording.stderr)).toEqual([
      expect.objectContaining({
        severity: 'WARN',
        eventCode: 'HTTP_REQUEST_ABORTED',
        requestId: validRequestId,
        method: 'GET',
        route: '/health/live',
        durationMs: expect.any(Number),
      }),
    ]);
    expect(recording.stdout).toEqual([]);
  });

  it('normalizes every dynamic segment and hides unmatched paths', () => {
    expect(
      normalizeRouteTemplate(
        'PATCH',
        '/api/v1/practitioners/doctor@example.org/facilities/secret-value',
      ),
    ).toBe('/api/v1/practitioners/:practitionerId/facilities/:assignmentId');
    expect(normalizeRouteTemplate('GET', '/unknown/patient@example.org')).toBe(
      'UNMATCHED',
    );
  });
});
