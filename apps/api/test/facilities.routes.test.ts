import request from 'supertest';
import { describe, expect, it, type Mocked, vi } from 'vitest';
import {
  createCodeConflictError,
  createLicenseConflictError,
  createNotFoundError,
} from '../src/http/api-error.js';
import { createApp } from '../src/app.js';
import { createFacilitiesRouter } from '../src/facilities/router.js';
import type { HealthcareFacilityService } from '../src/facilities/service.js';

function createFacilityServiceMock(): Mocked<HealthcareFacilityService> {
  return {
    createFacility: vi.fn<HealthcareFacilityService['createFacility']>(),
    listFacilities: vi.fn<HealthcareFacilityService['listFacilities']>(),
    getFacilityById: vi.fn<HealthcareFacilityService['getFacilityById']>(),
    updateFacility: vi.fn<HealthcareFacilityService['updateFacility']>(),
    deleteFacility: vi.fn<HealthcareFacilityService['deleteFacility']>(),
  };
}

function createTestApp(service = createFacilityServiceMock()) {
  return {
    app: createApp({
      facilitiesRouter: createFacilitiesRouter(service),
    }),
    service,
  };
}

const facilityId = '11111111-1111-4111-8111-111111111111';

const facility = {
  id: facilityId,
  code: 'ALPHA-001',
  name: 'Alpha Clinic',
  facilityType: 'clinic' as const,
  licenseNumber: null,
  phone: '+251911111111',
  email: 'alpha@example.org',
  region: 'Addis Ababa',
  city: 'Addis Ababa',
  addressLine: null,
  isActive: true,
  createdAt: '2026-08-05T00:00:00.000Z',
  updatedAt: '2026-08-05T00:00:00.000Z',
};

const updatedFacility = {
  ...facility,
  name: 'Alpha Clinic Updated',
  updatedAt: '2026-08-05T00:01:00.000Z',
};

const listResponse = {
  data: [facility],
  pagination: {
    page: 1,
    pageSize: 20,
    totalItems: 1,
    totalPages: 1,
  },
};

describe('facility routes', () => {
  it('creates a facility and returns 201 with Location', async () => {
    const { app, service } = createTestApp();
    service.createFacility.mockResolvedValue(facility);

    const response = await request(app).post('/api/v1/facilities').send({
      code: '  alpha-001  ',
      name: '  Alpha Clinic  ',
      facilityType: 'clinic',
      licenseNumber: null,
      phone: '  +251911111111  ',
      email: '  Alpha@Example.ORG  ',
      region: '  Addis Ababa  ',
      city: '  Addis Ababa  ',
      addressLine: '  ',
      isActive: true,
    });

    expect(response.status).toBe(201);
    expect(response.headers.location).toBe(`/api/v1/facilities/${facilityId}`);
    expect(response.body).toEqual(facility);
    expect(service.createFacility).toHaveBeenCalledWith({
      code: 'alpha-001',
      name: 'Alpha Clinic',
      facilityType: 'clinic',
      licenseNumber: null,
      phone: '+251911111111',
      email: 'Alpha@Example.ORG',
      region: 'Addis Ababa',
      city: 'Addis Ababa',
      addressLine: null,
      isActive: true,
    });
  });

  it('rejects invalid create payloads with a stable validation error', async () => {
    const { app, service } = createTestApp();

    const response = await request(app).post('/api/v1/facilities').send({
      code: 'ALPHA-001',
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: expect.arrayContaining([
          expect.objectContaining({
            field: 'Name',
          }),
        ]),
      },
    });
    expect(service.createFacility).not.toHaveBeenCalled();
  });

  it('rejects unknown create properties', async () => {
    const { app, service } = createTestApp();

    const response = await request(app).post('/api/v1/facilities').send({
      code: 'ALPHA-001',
      name: 'Alpha Clinic',
      facilityType: 'clinic',
      region: 'Addis Ababa',
      city: 'Addis Ababa',
      extraField: 'not-allowed',
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details[0].message).toMatch(/Unknown property/i);
    expect(service.createFacility).not.toHaveBeenCalled();
  });

  it('returns 409 when the code already exists', async () => {
    const { app, service } = createTestApp();
    service.createFacility.mockRejectedValue(createCodeConflictError());

    const response = await request(app).post('/api/v1/facilities').send({
      code: 'ALPHA-001',
      name: 'Alpha Clinic',
      facilityType: 'clinic',
      region: 'Addis Ababa',
      city: 'Addis Ababa',
    });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      error: {
        code: 'FACILITY_CODE_CONFLICT',
        message: 'Facility code already exists',
      },
    });
  });

  it('returns 409 when the license number already exists', async () => {
    const { app, service } = createTestApp();
    service.createFacility.mockRejectedValue(createLicenseConflictError());

    const response = await request(app).post('/api/v1/facilities').send({
      code: 'ALPHA-001',
      name: 'Alpha Clinic',
      facilityType: 'clinic',
      licenseNumber: 'LN-001',
      region: 'Addis Ababa',
      city: 'Addis Ababa',
    });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      error: {
        code: 'FACILITY_LICENSE_CONFLICT',
        message: 'License number already exists',
      },
    });
  });

  it('lists facilities with default pagination metadata', async () => {
    const { app, service } = createTestApp();
    service.listFacilities.mockResolvedValue(listResponse);

    const response = await request(app).get('/api/v1/facilities');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(listResponse);
    expect(service.listFacilities).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
    });
  });

  it('rejects repeated list query values', async () => {
    const { app, service } = createTestApp();

    const response = await request(app)
      .get('/api/v1/facilities?page=1&page=2')
      .send();

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(service.listFacilities).not.toHaveBeenCalled();
  });

  it('returns a facility by id', async () => {
    const { app, service } = createTestApp();
    service.getFacilityById.mockResolvedValue(facility);

    const response = await request(app).get(`/api/v1/facilities/${facilityId}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(facility);
    expect(service.getFacilityById).toHaveBeenCalledWith(facilityId);
  });

  it('rejects invalid facility ids before calling the service', async () => {
    const { app, service } = createTestApp();

    const response = await request(app).get('/api/v1/facilities/not-a-uuid');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(service.getFacilityById).not.toHaveBeenCalled();
  });

  it('returns 404 when a facility does not exist', async () => {
    const { app, service } = createTestApp();
    service.getFacilityById.mockRejectedValue(createNotFoundError());

    const response = await request(app).get(`/api/v1/facilities/${facilityId}`);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: {
        code: 'FACILITY_NOT_FOUND',
        message: 'Facility not found',
      },
    });
  });

  it('patches a facility and returns the updated payload', async () => {
    const { app, service } = createTestApp();
    service.updateFacility.mockResolvedValue(updatedFacility);

    const response = await request(app)
      .patch(`/api/v1/facilities/${facilityId}`)
      .send({
        name: '  Alpha Clinic Updated  ',
        isActive: false,
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(updatedFacility);
    expect(service.updateFacility).toHaveBeenCalledWith(facilityId, {
      name: 'Alpha Clinic Updated',
      isActive: false,
    });
  });

  it('rejects an empty PATCH body', async () => {
    const { app, service } = createTestApp();

    const response = await request(app)
      .patch(`/api/v1/facilities/${facilityId}`)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(service.updateFacility).not.toHaveBeenCalled();
  });

  it('rejects protected PATCH fields', async () => {
    const { app, service } = createTestApp();

    const response = await request(app)
      .patch(`/api/v1/facilities/${facilityId}`)
      .send({
        id: facilityId,
        name: 'Alpha Clinic Updated',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details[0].message).toMatch(/Unknown property/i);
    expect(service.updateFacility).not.toHaveBeenCalled();
  });

  it('returns 409 when a PATCH conflicts on code', async () => {
    const { app, service } = createTestApp();
    service.updateFacility.mockRejectedValue(createCodeConflictError());

    const response = await request(app)
      .patch(`/api/v1/facilities/${facilityId}`)
      .send({
        code: 'ALPHA-001',
      });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('FACILITY_CODE_CONFLICT');
  });

  it('soft deletes a facility and keeps repeated deletes idempotent', async () => {
    const { app, service } = createTestApp();
    service.deleteFacility.mockResolvedValue(undefined);

    const firstResponse = await request(app).delete(
      `/api/v1/facilities/${facilityId}`,
    );
    const secondResponse = await request(app).delete(
      `/api/v1/facilities/${facilityId}`,
    );

    expect(firstResponse.status).toBe(204);
    expect(firstResponse.text).toBe('');
    expect(secondResponse.status).toBe(204);
    expect(secondResponse.text).toBe('');
    expect(service.deleteFacility).toHaveBeenCalledTimes(2);
  });

  it('returns a stable invalid JSON error envelope', async () => {
    const { app } = createTestApp();

    const response = await request(app)
      .post('/api/v1/facilities')
      .set('Content-Type', 'application/json')
      .send('{"code":');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: 'INVALID_JSON',
        message: 'Invalid JSON request body',
      },
    });
  });

  it('sanitizes unexpected server errors', async () => {
    const { app, service } = createTestApp();
    service.getFacilityById.mockRejectedValue(new Error('database exploded'));

    const response = await request(app).get(`/api/v1/facilities/${facilityId}`);

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
      },
    });
  });
});
