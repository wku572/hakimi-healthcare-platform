import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import {
  createAssignmentConflictError,
  createAssignmentNotFoundError,
  createInactiveFacilityError,
  createInactivePractitionerError,
  createPractitionerCodeConflictError,
  createPractitionerLicenseConflictError,
  createPractitionerNotFoundError,
} from '../src/http/api-error.js';
import { createApp } from '../src/app.js';
import { createPractitionersRouter } from '../src/practitioners/router.js';
import type { PractitionerService } from '../src/practitioners/service.js';

function createPractitionerServiceMock(): PractitionerService & {
  createPractitioner: ReturnType<typeof vi.fn>;
  listPractitioners: ReturnType<typeof vi.fn>;
  getPractitionerById: ReturnType<typeof vi.fn>;
  updatePractitioner: ReturnType<typeof vi.fn>;
  deletePractitioner: ReturnType<typeof vi.fn>;
  createAssignment: ReturnType<typeof vi.fn>;
  listAssignments: ReturnType<typeof vi.fn>;
  updateAssignment: ReturnType<typeof vi.fn>;
  deleteAssignment: ReturnType<typeof vi.fn>;
} {
  return {
    createPractitioner: vi.fn(),
    listPractitioners: vi.fn(),
    getPractitionerById: vi.fn(),
    updatePractitioner: vi.fn(),
    deletePractitioner: vi.fn(),
    createAssignment: vi.fn(),
    listAssignments: vi.fn(),
    updateAssignment: vi.fn(),
    deleteAssignment: vi.fn(),
  };
}

function createTestApp(service = createPractitionerServiceMock()) {
  return {
    app: createApp({
      practitionersRouter: createPractitionersRouter(service),
    }),
    service,
  };
}

const practitionerId = '11111111-1111-4111-8111-111111111111';
const assignmentId = '22222222-2222-4222-8222-222222222222';

const practitioner = {
  id: practitionerId,
  code: 'PRAC-001',
  firstName: 'Mekdes',
  middleName: null,
  lastName: 'Tadesse',
  profession: 'general practitioner',
  licenseNumber: 'MED-001',
  phone: '+251911111111',
  email: 'mekdes@example.org',
  bio: null,
  isActive: true,
  createdAt: '2026-08-05T00:00:00.000Z',
  updatedAt: '2026-08-05T00:00:00.000Z',
};

const updatedPractitioner = {
  ...practitioner,
  firstName: 'Mekdes Updated',
  updatedAt: '2026-08-05T00:01:00.000Z',
};

const assignment = {
  id: assignmentId,
  practitionerId,
  facilityId: '33333333-3333-4333-8333-333333333333',
  roleTitle: 'Physician',
  department: null,
  isPrimary: true,
  isActive: true,
  createdAt: '2026-08-05T00:00:00.000Z',
  updatedAt: '2026-08-05T00:00:00.000Z',
  facility: {
    id: '33333333-3333-4333-8333-333333333333',
    code: 'FAC-001',
    name: 'Sunrise Clinic',
    facilityType: 'clinic' as const,
    region: 'Addis Ababa',
    city: 'Addis Ababa',
    isActive: true,
  },
};

const listResponse = {
  data: [practitioner],
  pagination: {
    page: 1,
    pageSize: 20,
    totalItems: 1,
    totalPages: 1,
  },
};

const assignmentListResponse = {
  data: [assignment],
};

describe('practitioner routes', () => {
  it('creates a practitioner and returns 201 with Location', async () => {
    const { app, service } = createTestApp();
    service.createPractitioner.mockResolvedValue(practitioner);

    const response = await request(app).post('/api/v1/practitioners').send({
      code: '  prac-001  ',
      firstName: '  Mekdes  ',
      middleName: '  ',
      lastName: '  Tadesse  ',
      profession: '  general practitioner  ',
      licenseNumber: '  MED-001  ',
      phone: '  +251911111111  ',
      email: '  MEKDES@EXAMPLE.ORG  ',
      bio: '  ',
      isActive: true,
    });

    expect(response.status).toBe(201);
    expect(response.headers.location).toBe(
      `/api/v1/practitioners/${practitionerId}`,
    );
    expect(response.body).toEqual(practitioner);
    expect(service.createPractitioner).toHaveBeenCalledWith({
      code: 'prac-001',
      firstName: 'Mekdes',
      middleName: null,
      lastName: 'Tadesse',
      profession: 'general practitioner',
      licenseNumber: 'MED-001',
      phone: '+251911111111',
      email: 'mekdes@example.org',
      bio: null,
      isActive: true,
    });
  });

  it('rejects invalid create payloads with a stable validation error', async () => {
    const { app, service } = createTestApp();

    const response = await request(app).post('/api/v1/practitioners').send({
      code: 'PRAC-001',
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'First name',
        }),
      ]),
    );
    expect(service.createPractitioner).not.toHaveBeenCalled();
  });

  it('rejects unknown create properties', async () => {
    const { app, service } = createTestApp();

    const response = await request(app).post('/api/v1/practitioners').send({
      code: 'PRAC-001',
      firstName: 'Mekdes',
      lastName: 'Tadesse',
      profession: 'general practitioner',
      licenseNumber: 'MED-001',
      extraField: 'not-allowed',
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(service.createPractitioner).not.toHaveBeenCalled();
  });

  it('returns 409 when the code already exists', async () => {
    const { app, service } = createTestApp();
    service.createPractitioner.mockRejectedValue(
      createPractitionerCodeConflictError(),
    );

    const response = await request(app).post('/api/v1/practitioners').send({
      code: 'PRAC-001',
      firstName: 'Mekdes',
      lastName: 'Tadesse',
      profession: 'general practitioner',
      licenseNumber: 'MED-001',
    });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('PRACTITIONER_CODE_CONFLICT');
  });

  it('returns 409 when the license number already exists', async () => {
    const { app, service } = createTestApp();
    service.createPractitioner.mockRejectedValue(
      createPractitionerLicenseConflictError(),
    );

    const response = await request(app).post('/api/v1/practitioners').send({
      code: 'PRAC-001',
      firstName: 'Mekdes',
      lastName: 'Tadesse',
      profession: 'general practitioner',
      licenseNumber: 'MED-001',
    });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('PRACTITIONER_LICENSE_CONFLICT');
  });

  it('lists practitioners with default pagination metadata', async () => {
    const { app, service } = createTestApp();
    service.listPractitioners.mockResolvedValue(listResponse);

    const response = await request(app).get('/api/v1/practitioners');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(listResponse);
    expect(service.listPractitioners).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
    });
  });

  it('rejects repeated list query values', async () => {
    const { app, service } = createTestApp();

    const response = await request(app)
      .get('/api/v1/practitioners?page=1&page=2')
      .send();

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(service.listPractitioners).not.toHaveBeenCalled();
  });

  it('returns a practitioner by id', async () => {
    const { app, service } = createTestApp();
    service.getPractitionerById.mockResolvedValue(practitioner);

    const response = await request(app).get(
      `/api/v1/practitioners/${practitionerId}`,
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual(practitioner);
    expect(service.getPractitionerById).toHaveBeenCalledWith(practitionerId);
  });

  it('rejects invalid practitioner ids before calling the service', async () => {
    const { app, service } = createTestApp();

    const response = await request(app).get('/api/v1/practitioners/not-a-uuid');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(service.getPractitionerById).not.toHaveBeenCalled();
  });

  it('returns 404 when a practitioner does not exist', async () => {
    const { app, service } = createTestApp();
    service.getPractitionerById.mockRejectedValue(
      createPractitionerNotFoundError(),
    );

    const response = await request(app).get(
      `/api/v1/practitioners/${practitionerId}`,
    );

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('PRACTITIONER_NOT_FOUND');
  });

  it('patches a practitioner and returns the updated payload', async () => {
    const { app, service } = createTestApp();
    service.updatePractitioner.mockResolvedValue(updatedPractitioner);

    const response = await request(app)
      .patch(`/api/v1/practitioners/${practitionerId}`)
      .send({
        firstName: '  Mekdes Updated  ',
        email: '  MEKDES.UPDATED@EXAMPLE.ORG  ',
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(updatedPractitioner);
    expect(service.updatePractitioner).toHaveBeenCalledWith(practitionerId, {
      firstName: 'Mekdes Updated',
      email: 'mekdes.updated@example.org',
    });
  });

  it('rejects an empty PATCH body', async () => {
    const { app, service } = createTestApp();

    const response = await request(app)
      .patch(`/api/v1/practitioners/${practitionerId}`)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(service.updatePractitioner).not.toHaveBeenCalled();
  });

  it('rejects protected PATCH fields', async () => {
    const { app, service } = createTestApp();

    const response = await request(app)
      .patch(`/api/v1/practitioners/${practitionerId}`)
      .send({
        id: practitionerId,
        firstName: 'Mekdes Updated',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(service.updatePractitioner).not.toHaveBeenCalled();
  });

  it('returns 409 when a PATCH conflicts on code', async () => {
    const { app, service } = createTestApp();
    service.updatePractitioner.mockRejectedValue(
      createPractitionerCodeConflictError(),
    );

    const response = await request(app)
      .patch(`/api/v1/practitioners/${practitionerId}`)
      .send({
        code: 'PRAC-001',
      });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('PRACTITIONER_CODE_CONFLICT');
  });

  it('soft deletes a practitioner and keeps repeated deletes idempotent', async () => {
    const { app, service } = createTestApp();
    service.deletePractitioner.mockResolvedValue(undefined);

    const firstResponse = await request(app).delete(
      `/api/v1/practitioners/${practitionerId}`,
    );
    const secondResponse = await request(app).delete(
      `/api/v1/practitioners/${practitionerId}`,
    );

    expect(firstResponse.status).toBe(204);
    expect(firstResponse.text).toBe('');
    expect(secondResponse.status).toBe(204);
    expect(secondResponse.text).toBe('');
    expect(service.deletePractitioner).toHaveBeenCalledTimes(2);
  });

  it('creates a practitioner assignment and returns 201 with Location', async () => {
    const { app, service } = createTestApp();
    service.createAssignment.mockResolvedValue(assignment);

    const response = await request(app)
      .post(`/api/v1/practitioners/${practitionerId}/facilities`)
      .send({
        facilityId: assignment.facilityId,
        roleTitle: '  Physician  ',
        department: '  ',
        isPrimary: true,
        isActive: true,
      });

    expect(response.status).toBe(201);
    expect(response.headers.location).toBe(
      `/api/v1/practitioners/${practitionerId}/facilities/${assignmentId}`,
    );
    expect(response.body).toEqual(assignment);
    expect(service.createAssignment).toHaveBeenCalledWith(practitionerId, {
      facilityId: assignment.facilityId,
      roleTitle: 'Physician',
      department: null,
      isPrimary: true,
      isActive: true,
    });
  });

  it('rejects inactive primary assignment creation', async () => {
    const { app, service } = createTestApp();

    const response = await request(app)
      .post(`/api/v1/practitioners/${practitionerId}/facilities`)
      .send({
        facilityId: assignment.facilityId,
        roleTitle: 'Physician',
        isPrimary: true,
        isActive: false,
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(service.createAssignment).not.toHaveBeenCalled();
  });

  it('returns 409 when assignment creation conflicts', async () => {
    const { app, service } = createTestApp();
    service.createAssignment.mockRejectedValue(createAssignmentConflictError());

    const response = await request(app)
      .post(`/api/v1/practitioners/${practitionerId}/facilities`)
      .send({
        facilityId: assignment.facilityId,
        roleTitle: 'Physician',
      });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('ASSIGNMENT_CONFLICT');
  });

  it('returns inactive practitioner and facility assignment errors', async () => {
    const { app, service } = createTestApp();
    service.createAssignment
      .mockRejectedValueOnce(createInactivePractitionerError())
      .mockRejectedValueOnce(createInactiveFacilityError());

    const practitionerResponse = await request(app)
      .post(`/api/v1/practitioners/${practitionerId}/facilities`)
      .send({
        facilityId: assignment.facilityId,
        roleTitle: 'Physician',
      });

    const facilityResponse = await request(app)
      .post(`/api/v1/practitioners/${practitionerId}/facilities`)
      .send({
        facilityId: assignment.facilityId,
        roleTitle: 'Physician',
      });

    expect(practitionerResponse.status).toBe(409);
    expect(practitionerResponse.body.error.code).toBe('INACTIVE_PRACTITIONER');
    expect(facilityResponse.status).toBe(409);
    expect(facilityResponse.body.error.code).toBe('INACTIVE_FACILITY');
  });

  it('lists practitioner assignments', async () => {
    const { app, service } = createTestApp();
    service.listAssignments.mockResolvedValue(assignmentListResponse);

    const response = await request(app).get(
      `/api/v1/practitioners/${practitionerId}/facilities`,
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual(assignmentListResponse);
    expect(service.listAssignments).toHaveBeenCalledWith(practitionerId);
  });

  it('returns 404 when assignment ownership does not match', async () => {
    const { app, service } = createTestApp();
    service.updateAssignment.mockRejectedValue(createAssignmentNotFoundError());

    const response = await request(app)
      .patch(
        `/api/v1/practitioners/${practitionerId}/facilities/${assignmentId}`,
      )
      .send({
        roleTitle: 'Physician Lead',
      });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('ASSIGNMENT_NOT_FOUND');
  });

  it('patches a practitioner assignment', async () => {
    const { app, service } = createTestApp();
    service.updateAssignment.mockResolvedValue({
      ...assignment,
      roleTitle: 'Chief Physician',
      updatedAt: '2026-08-05T00:01:00.000Z',
    });

    const response = await request(app)
      .patch(
        `/api/v1/practitioners/${practitionerId}/facilities/${assignmentId}`,
      )
      .send({
        roleTitle: '  Chief Physician  ',
      });

    expect(response.status).toBe(200);
    expect(response.body.roleTitle).toBe('Chief Physician');
    expect(service.updateAssignment).toHaveBeenCalledWith(
      practitionerId,
      assignmentId,
      {
        roleTitle: 'Chief Physician',
      },
    );
  });

  it('rejects inactive primary assignment updates', async () => {
    const { app, service } = createTestApp();

    const response = await request(app)
      .patch(
        `/api/v1/practitioners/${practitionerId}/facilities/${assignmentId}`,
      )
      .send({
        isPrimary: true,
        isActive: false,
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(service.updateAssignment).not.toHaveBeenCalled();
  });

  it('rejects invalid practitioner and assignment ids', async () => {
    const { app, service } = createTestApp();

    const practitionerResponse = await request(app).get(
      '/api/v1/practitioners/not-a-uuid/facilities',
    );
    const assignmentResponse = await request(app)
      .patch(`/api/v1/practitioners/${practitionerId}/facilities/not-a-uuid`)
      .send({
        roleTitle: 'Chief Physician',
      });

    expect(practitionerResponse.status).toBe(400);
    expect(assignmentResponse.status).toBe(400);
    expect(service.listAssignments).not.toHaveBeenCalled();
    expect(service.updateAssignment).not.toHaveBeenCalled();
  });

  it('soft deletes an assignment and keeps repeated deletes idempotent', async () => {
    const { app, service } = createTestApp();
    service.deleteAssignment.mockResolvedValue(undefined);

    const firstResponse = await request(app).delete(
      `/api/v1/practitioners/${practitionerId}/facilities/${assignmentId}`,
    );
    const secondResponse = await request(app).delete(
      `/api/v1/practitioners/${practitionerId}/facilities/${assignmentId}`,
    );

    expect(firstResponse.status).toBe(204);
    expect(secondResponse.status).toBe(204);
    expect(service.deleteAssignment).toHaveBeenCalledTimes(2);
  });

  it('returns a stable invalid JSON error envelope', async () => {
    const { app } = createTestApp();

    const response = await request(app)
      .post('/api/v1/practitioners')
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
    service.getPractitionerById.mockRejectedValue(
      new Error('database exploded'),
    );

    const response = await request(app).get(
      `/api/v1/practitioners/${practitionerId}`,
    );

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
      },
    });
  });
});
