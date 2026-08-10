import request from 'supertest';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mocked,
  vi,
} from 'vitest';
import {
  createPatientNotFoundError,
  createPatientRegistrationConflictError,
} from '../src/http/api-error.js';
import { createApp } from '../src/app.js';
import { createPatientsRouter } from '../src/patients/router.js';
import type { PatientService } from '../src/patients/service.js';

function createPatientServiceMock(): Mocked<PatientService> {
  return {
    createPatient: vi.fn<PatientService['createPatient']>(),
    listPatients: vi.fn<PatientService['listPatients']>(),
    getPatientById: vi.fn<PatientService['getPatientById']>(),
    updatePatient: vi.fn<PatientService['updatePatient']>(),
    deletePatient: vi.fn<PatientService['deletePatient']>(),
  };
}

function createTestApp(service = createPatientServiceMock()) {
  return {
    app: createApp({
      patientsRouter: createPatientsRouter(service),
    }),
    service,
  };
}

describe('api error middleware', () => {
  const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {
    return undefined;
  });

  beforeEach(() => {
    consoleErrorSpy.mockClear();
  });

  afterEach(() => {
    expect(consoleErrorSpy.mock.calls.flat().join(' ')).not.toContain(
      'database exploded',
    );
    expect(consoleErrorSpy.mock.calls.flat().join(' ')).not.toContain(
      'patients_email_not_blank_check',
    );
    expect(consoleErrorSpy.mock.calls.flat().join(' ')).not.toContain(
      'alice@example.org',
    );
    expect(consoleErrorSpy.mock.calls.flat().join(' ')).not.toContain(
      'some other database detail',
    );
  });

  it('hides ordinary error messages behind a generic 500 response', async () => {
    const { app, service } = createTestApp();
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
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Unexpected API error [opaque]',
    );
  });

  it('hides raw PostgreSQL details from unknown patient path errors', async () => {
    const { app, service } = createTestApp();
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
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Unexpected API error [opaque]',
    );
  });

  it('keeps known API errors unchanged', async () => {
    const { app, service } = createTestApp();
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
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('keeps the duplicate facility and MRN conflict stable', async () => {
    const { app, service } = createTestApp();
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
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});
