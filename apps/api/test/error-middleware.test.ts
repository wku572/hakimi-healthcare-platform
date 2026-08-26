import request from 'supertest';
import { describe, expect, it, type Mocked, vi } from 'vitest';
import {
  createPatientNotFoundError,
  createPatientRegistrationConflictError,
} from '../src/http/api-error.js';
import { createApp } from '../src/app.js';
import { createPatientsRouter } from '../src/patients/router.js';
import type { PatientService } from '../src/patients/service.js';
import type { ObservabilityLogger } from '../src/observability/logger.js';

function createPatientServiceMock(): Mocked<PatientService> {
  return {
    createPatient: vi.fn<PatientService['createPatient']>(),
    listPatients: vi.fn<PatientService['listPatients']>(),
    getPatientById: vi.fn<PatientService['getPatientById']>(),
    updatePatient: vi.fn<PatientService['updatePatient']>(),
    deletePatient: vi.fn<PatientService['deletePatient']>(),
  };
}

function createLoggerMock(): ObservabilityLogger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

function createTestApp(
  service = createPatientServiceMock(),
  logger = createLoggerMock(),
) {
  return {
    app: createApp({
      patientsRouter: createPatientsRouter(service),
      logger,
    }),
    service,
    logger,
  };
}

describe('api error middleware', () => {
  it('hides ordinary error messages behind a generic 500 response', async () => {
    const { app, service, logger } = createTestApp();
    service.getPatientById.mockRejectedValue(new Error('database exploded'));

    const response = await request(app).get(
      '/api/v1/patients/11111111-1111-4111-8111-111111111111',
    );

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
      },
    });
    expect(logger.error).toHaveBeenCalledWith(
      'HTTP_UNEXPECTED_ERROR',
      expect.objectContaining({
        requestId: expect.any(String),
        errorCode: 'INTERNAL_ERROR',
        statusCode: 500,
      }),
    );
    expect(JSON.stringify(vi.mocked(logger.error).mock.calls)).not.toContain(
      'database exploded',
    );
  });

  it('hides raw PostgreSQL details from unknown patient path errors', async () => {
    const { app, service, logger } = createTestApp();
    service.createPatient.mockRejectedValue({
      code: '23514',
      message:
        'new row for relation "patients" violates check constraint "patients_email_not_blank_check"',
      detail:
        'Failing row contains (alice@example.org, patients_email_not_blank_check).',
      constraint: 'patients_email_not_blank_check',
      table: 'patients',
      column: 'email',
      schema: 'public',
    });

    const response = await request(app).post('/api/v1/patients').send({
      facilityId: '22222222-2222-4222-8222-222222222222',
      medicalRecordNumber: 'MRN-001',
      firstName: 'Alice',
      administrativeSex: 'female',
    });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
      },
    });
    expect(logger.error).toHaveBeenCalledWith(
      'HTTP_UNEXPECTED_ERROR',
      expect.objectContaining({
        errorCode: 'INTERNAL_ERROR',
        statusCode: 500,
      }),
    );
    const logArguments = JSON.stringify(vi.mocked(logger.error).mock.calls);
    expect(logArguments).not.toContain('patients_email_not_blank_check');
    expect(logArguments).not.toContain('alice@example.org');
    expect(logArguments).not.toContain('some other database detail');
  });

  it('keeps known API errors unchanged', async () => {
    const { app, service, logger } = createTestApp();
    service.getPatientById.mockRejectedValue(createPatientNotFoundError());

    const response = await request(app).get(
      '/api/v1/patients/11111111-1111-4111-8111-111111111111',
    );

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: {
        code: 'PATIENT_NOT_FOUND',
        message: 'Patient not found',
      },
    });
    expect(logger.warn).toHaveBeenCalledWith(
      'HTTP_API_ERROR',
      expect.objectContaining({
        errorCode: 'PATIENT_NOT_FOUND',
        statusCode: 404,
      }),
    );
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('keeps the duplicate facility and MRN conflict stable', async () => {
    const { app, service, logger } = createTestApp();
    service.createPatient.mockRejectedValue(
      createPatientRegistrationConflictError(),
    );

    const response = await request(app).post('/api/v1/patients').send({
      facilityId: '22222222-2222-4222-8222-222222222222',
      medicalRecordNumber: 'MRN-001',
      firstName: 'Alice',
      administrativeSex: 'female',
    });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      error: {
        code: 'PATIENT_REGISTRATION_CONFLICT',
        message: 'Patient registration already exists',
      },
    });
    expect(logger.warn).toHaveBeenCalledWith(
      'HTTP_API_ERROR',
      expect.objectContaining({
        errorCode: 'PATIENT_REGISTRATION_CONFLICT',
        statusCode: 409,
      }),
    );
    expect(logger.error).not.toHaveBeenCalled();
  });
});
