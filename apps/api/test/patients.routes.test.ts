import request from 'supertest';
import { describe, expect, it, type Mocked, vi } from 'vitest';
import {
  createFacilityInactiveError,
  createFacilityNotFoundError,
  createPatientNotFoundError,
  createPatientRegistrationConflictError,
} from '../src/http/api-error.js';
import { createApp } from '../src/app.js';
import { createPatientsRouter } from '../src/patients/router.js';
import {
  allowAllAccessMiddleware,
  allowAllRouteAuthorizer,
  allowAllScope,
} from './helpers/access.js';
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
      patientsRouter: createPatientsRouter(service, allowAllRouteAuthorizer),
      accessAuthenticationMiddleware: allowAllAccessMiddleware,
    }),
    service,
  };
}

const patientId = '11111111-1111-4111-8111-111111111111';
const facilityId = '22222222-2222-4222-8222-222222222222';
const registrationId = '33333333-3333-4333-8333-333333333333';

const patient = {
  id: patientId,
  firstName: 'Mekdes',
  middleName: 'A.',
  lastName: 'Tadesse',
  dateOfBirth: '1995-01-01',
  administrativeSex: 'female' as const,
  phone: '+251911111111',
  email: 'mekdes@example.org',
  addressLine: 'Bole Road',
  city: 'Addis Ababa',
  region: 'Addis Ababa',
  isActive: true,
  createdAt: '2026-08-05T00:00:00.000Z',
  updatedAt: '2026-08-05T00:00:00.000Z',
  registrations: [
    {
      id: registrationId,
      patientId,
      facilityId,
      medicalRecordNumber: 'MRN-001',
      createdAt: '2026-08-05T00:00:00.000Z',
      updatedAt: '2026-08-05T00:00:00.000Z',
      facility: {
        id: facilityId,
        code: 'FAC-001',
        name: 'Sunrise Clinic',
        facilityType: 'clinic' as const,
        region: 'Addis Ababa',
        city: 'Addis Ababa',
        isActive: true,
      },
    },
  ],
};

const updatedPatient = {
  ...patient,
  firstName: 'Mekdes Updated',
  updatedAt: '2026-08-05T00:01:00.000Z',
};

const listResponse = {
  data: [patient],
  pagination: {
    page: 1,
    pageSize: 20,
    totalItems: 1,
    totalPages: 1,
  },
};

function futureDateIso() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().slice(0, 10);
}

describe('patient routes', () => {
  it('creates a patient and returns 201 with Location', async () => {
    const { app, service } = createTestApp();
    service.createPatient.mockResolvedValue(patient);

    const response = await request(app).post('/api/v1/patients').send({
      facilityId,
      medicalRecordNumber: '  MRN-001  ',
      firstName: '  Mekdes  ',
      middleName: '  A.  ',
      lastName: '  Tadesse  ',
      dateOfBirth: ' 1995-01-01 ',
      administrativeSex: ' FEMALE ',
      phone: '  +251911111111  ',
      email: '  MEKDES@EXAMPLE.ORG  ',
      addressLine: '  Bole Road  ',
      city: '  Addis Ababa  ',
      region: '  Addis Ababa  ',
    });

    expect(response.status).toBe(201);
    expect(response.headers.location).toBe(`/api/v1/patients/${patientId}`);
    expect(response.body).toEqual(patient);
    expect(service.createPatient).toHaveBeenCalledWith({
      facilityId,
      medicalRecordNumber: 'MRN-001',
      firstName: 'Mekdes',
      middleName: 'A.',
      lastName: 'Tadesse',
      dateOfBirth: '1995-01-01',
      administrativeSex: 'female',
      phone: '+251911111111',
      email: 'mekdes@example.org',
      addressLine: 'Bole Road',
      city: 'Addis Ababa',
      region: 'Addis Ababa',
    });
  });

  it('rejects invalid create payloads with a stable validation error', async () => {
    const { app, service } = createTestApp();

    const response = await request(app).post('/api/v1/patients').send({
      firstName: 'Mekdes',
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(service.createPatient).not.toHaveBeenCalled();
  });

  it('rejects future date of birth on create', async () => {
    const { app, service } = createTestApp();

    const response = await request(app).post('/api/v1/patients').send({
      facilityId,
      medicalRecordNumber: 'MRN-001',
      firstName: 'Mekdes',
      administrativeSex: 'female',
      dateOfBirth: futureDateIso(),
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(service.createPatient).not.toHaveBeenCalled();
  });

  it('rejects unknown create properties', async () => {
    const { app, service } = createTestApp();

    const response = await request(app).post('/api/v1/patients').send({
      facilityId,
      medicalRecordNumber: 'MRN-001',
      firstName: 'Mekdes',
      administrativeSex: 'female',
      extraField: 'not-allowed',
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(service.createPatient).not.toHaveBeenCalled();
  });

  it('returns patient-specific conflict and facility errors', async () => {
    const { app, service } = createTestApp();
    service.createPatient
      .mockRejectedValueOnce(createPatientRegistrationConflictError())
      .mockRejectedValueOnce(createFacilityNotFoundError())
      .mockRejectedValueOnce(createFacilityInactiveError());

    const conflictResponse = await request(app).post('/api/v1/patients').send({
      facilityId,
      medicalRecordNumber: 'MRN-001',
      firstName: 'Mekdes',
      administrativeSex: 'female',
    });
    const notFoundResponse = await request(app).post('/api/v1/patients').send({
      facilityId,
      medicalRecordNumber: 'MRN-002',
      firstName: 'Mekdes',
      administrativeSex: 'female',
    });
    const inactiveResponse = await request(app).post('/api/v1/patients').send({
      facilityId,
      medicalRecordNumber: 'MRN-003',
      firstName: 'Mekdes',
      administrativeSex: 'female',
    });

    expect(conflictResponse.status).toBe(409);
    expect(conflictResponse.body.error.code).toBe(
      'PATIENT_REGISTRATION_CONFLICT',
    );
    expect(notFoundResponse.status).toBe(404);
    expect(notFoundResponse.body.error.code).toBe('FACILITY_NOT_FOUND');
    expect(inactiveResponse.status).toBe(409);
    expect(inactiveResponse.body.error.code).toBe('FACILITY_INACTIVE');
  });

  it('lists patients with default pagination metadata', async () => {
    const { app, service } = createTestApp();
    service.listPatients.mockResolvedValue(listResponse);

    const response = await request(app).get('/api/v1/patients');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(listResponse);
    expect(service.listPatients).toHaveBeenCalledWith(
      { page: 1, pageSize: 20 },
      allowAllScope,
    );
  });

  it('passes patient list filters through to the service', async () => {
    const { app, service } = createTestApp();
    service.listPatients.mockResolvedValue(listResponse);

    const response = await request(app).get('/api/v1/patients').query({
      facilityId,
      medicalRecordNumber: 'MRN-001',
      administrativeSex: 'female',
      isActive: 'false',
      search: 'mek',
    });

    expect(response.status).toBe(200);
    expect(service.listPatients).toHaveBeenCalledWith(
      {
        page: 1,
        pageSize: 20,
        facilityId,
        medicalRecordNumber: 'MRN-001',
        administrativeSex: 'female',
        isActive: false,
        search: 'mek',
      },
      allowAllScope,
    );
  });

  it('returns a patient by id', async () => {
    const { app, service } = createTestApp();
    service.getPatientById.mockResolvedValue(patient);

    const response = await request(app).get(`/api/v1/patients/${patientId}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(patient);
    expect(service.getPatientById).toHaveBeenCalledWith(
      patientId,
      allowAllScope,
    );
  });

  it('rejects invalid patient ids before calling the service', async () => {
    const { app, service } = createTestApp();

    const response = await request(app).get('/api/v1/patients/not-a-uuid');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(service.getPatientById).not.toHaveBeenCalled();
  });

  it('returns 404 when a patient does not exist', async () => {
    const { app, service } = createTestApp();
    service.getPatientById.mockRejectedValue(createPatientNotFoundError());

    const response = await request(app).get(`/api/v1/patients/${patientId}`);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('PATIENT_NOT_FOUND');
  });

  it('patches a patient and returns the updated payload', async () => {
    const { app, service } = createTestApp();
    service.updatePatient.mockResolvedValue(updatedPatient);

    const response = await request(app)
      .patch(`/api/v1/patients/${patientId}`)
      .send({
        firstName: '  Mekdes Updated  ',
        email: '  MEKDES.UPDATED@EXAMPLE.ORG  ',
        isActive: false,
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(updatedPatient);
    expect(service.updatePatient).toHaveBeenCalledWith(
      patientId,
      {
        firstName: 'Mekdes Updated',
        email: 'mekdes.updated@example.org',
        isActive: false,
      },
      allowAllScope,
    );
  });

  it('rejects an empty PATCH body', async () => {
    const { app, service } = createTestApp();

    const response = await request(app)
      .patch(`/api/v1/patients/${patientId}`)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(service.updatePatient).not.toHaveBeenCalled();
  });

  it('rejects immutable PATCH fields', async () => {
    const { app, service } = createTestApp();

    const response = await request(app)
      .patch(`/api/v1/patients/${patientId}`)
      .send({
        facilityId,
        medicalRecordNumber: 'MRN-999',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(service.updatePatient).not.toHaveBeenCalled();
  });

  it('rejects future date of birth on PATCH', async () => {
    const { app, service } = createTestApp();

    const response = await request(app)
      .patch(`/api/v1/patients/${patientId}`)
      .send({
        dateOfBirth: futureDateIso(),
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(service.updatePatient).not.toHaveBeenCalled();
  });

  it('soft deletes a patient and keeps repeated deletes idempotent', async () => {
    const { app, service } = createTestApp();
    service.deletePatient.mockResolvedValue(undefined);

    const firstResponse = await request(app).delete(
      `/api/v1/patients/${patientId}`,
    );
    const secondResponse = await request(app).delete(
      `/api/v1/patients/${patientId}`,
    );

    expect(firstResponse.status).toBe(204);
    expect(firstResponse.text).toBe('');
    expect(secondResponse.status).toBe(204);
    expect(secondResponse.text).toBe('');
    expect(service.deletePatient).toHaveBeenCalledTimes(2);
  });

  it('returns 404 when deleting a missing patient', async () => {
    const { app, service } = createTestApp();
    service.deletePatient.mockRejectedValue(createPatientNotFoundError());

    const response = await request(app).delete(`/api/v1/patients/${patientId}`);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('PATIENT_NOT_FOUND');
  });
});
