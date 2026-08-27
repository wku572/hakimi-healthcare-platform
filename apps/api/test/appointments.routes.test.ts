import request from 'supertest';
import { describe, expect, it, type Mocked, vi } from 'vitest';
import {
  createAppointmentConflictError,
  createAppointmentNotFoundError,
  createAppointmentStateConflictError,
} from '../src/http/api-error.js';
import { createApp } from '../src/app.js';
import { createAppointmentsRouter } from '../src/appointments/router.js';
import {
  allowAllAccessMiddleware,
  allowAllRouteAuthorizer,
  allowAllScope,
} from './helpers/access.js';
import type { AppointmentService } from '../src/appointments/service.js';

function createAppointmentServiceMock(): Mocked<AppointmentService> {
  return {
    createAppointment: vi.fn<AppointmentService['createAppointment']>(),
    listAppointments: vi.fn<AppointmentService['listAppointments']>(),
    getAppointmentById: vi.fn<AppointmentService['getAppointmentById']>(),
    updateAppointment: vi.fn<AppointmentService['updateAppointment']>(),
    cancelAppointment: vi.fn<AppointmentService['cancelAppointment']>(),
  };
}

function createTestApp(service = createAppointmentServiceMock()) {
  return {
    app: createApp({
      appointmentsRouter: createAppointmentsRouter(
        service,
        allowAllRouteAuthorizer,
      ),
      accessAuthenticationMiddleware: allowAllAccessMiddleware,
    }),
    service,
  };
}

const appointmentId = '11111111-1111-4111-8111-111111111111';

const appointment = {
  id: appointmentId,
  patientId: '22222222-2222-4222-8222-222222222222',
  practitionerId: '33333333-3333-4333-8333-333333333333',
  facilityId: '44444444-4444-4444-8444-444444444444',
  scheduledStart: '2026-08-07T06:00:00.000Z',
  scheduledEnd: '2026-08-07T06:30:00.000Z',
  status: 'SCHEDULED' as const,
  cancellationReason: null,
  cancelledAt: null,
  createdAt: '2026-08-06T00:00:00.000Z',
  updatedAt: '2026-08-06T00:00:00.000Z',
  patient: {
    id: '22222222-2222-4222-8222-222222222222',
    firstName: 'Mekdes',
    middleName: null,
    lastName: 'Tadesse',
    dateOfBirth: '1995-01-01',
    administrativeSex: 'female' as const,
    isActive: true,
    medicalRecordNumber: 'MRN-001',
  },
  practitioner: {
    id: '33333333-3333-4333-8333-333333333333',
    code: 'PRAC-001',
    firstName: 'Abebe',
    middleName: null,
    lastName: 'Kebede',
    profession: 'general practitioner',
    isActive: true,
  },
  facility: {
    id: '44444444-4444-4444-8444-444444444444',
    code: 'FAC-001',
    name: 'Sunrise Clinic',
    facilityType: 'clinic' as const,
    region: 'Addis Ababa',
    city: 'Addis Ababa',
    isActive: true,
  },
};

const appointmentListResponse = {
  data: [appointment],
  pagination: {
    page: 1,
    pageSize: 20,
    totalItems: 1,
    totalPages: 1,
  },
};

describe('appointment routes', () => {
  it('creates an appointment and returns 201 with Location', async () => {
    const { app, service } = createTestApp();
    service.createAppointment.mockResolvedValue(appointment);

    const response = await request(app).post('/api/v1/appointments').send({
      patientId: appointment.patientId,
      practitionerId: appointment.practitionerId,
      facilityId: appointment.facilityId,
      scheduledStart: ' 2026-08-07T09:00:00+03:00 ',
      scheduledEnd: ' 2026-08-07T09:30:00+03:00 ',
    });

    expect(response.status).toBe(201);
    expect(response.headers.location).toBe(
      `/api/v1/appointments/${appointmentId}`,
    );
    expect(response.body).toEqual(appointment);
    expect(service.createAppointment).toHaveBeenCalledWith({
      patientId: appointment.patientId,
      practitionerId: appointment.practitionerId,
      facilityId: appointment.facilityId,
      scheduledStart: '2026-08-07T09:00:00+03:00',
      scheduledEnd: '2026-08-07T09:30:00+03:00',
    });
  });

  it('rejects invalid create payloads with a stable validation error', async () => {
    const { app, service } = createTestApp();

    const response = await request(app).post('/api/v1/appointments').send({
      patientId: appointment.patientId,
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(service.createAppointment).not.toHaveBeenCalled();
  });

  it('rejects unknown create properties', async () => {
    const { app, service } = createTestApp();

    const response = await request(app).post('/api/v1/appointments').send({
      patientId: appointment.patientId,
      practitionerId: appointment.practitionerId,
      facilityId: appointment.facilityId,
      scheduledStart: '2026-08-07T09:00:00+03:00',
      scheduledEnd: '2026-08-07T09:30:00+03:00',
      extraField: 'not-allowed',
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(service.createAppointment).not.toHaveBeenCalled();
  });

  it('passes list filters through to the service', async () => {
    const { app, service } = createTestApp();
    service.listAppointments.mockResolvedValue(appointmentListResponse);

    const response = await request(app).get('/api/v1/appointments').query({
      facilityId: appointment.facilityId,
      practitionerId: appointment.practitionerId,
      patientId: appointment.patientId,
      status: 'confirmed',
      from: '2026-08-07T09:00:00+03:00',
      to: '2026-08-07T10:00:00+03:00',
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(appointmentListResponse);
    expect(service.listAppointments).toHaveBeenCalledWith(
      {
        page: 1,
        pageSize: 20,
        facilityId: appointment.facilityId,
        practitionerId: appointment.practitionerId,
        patientId: appointment.patientId,
        status: 'CONFIRMED',
        from: '2026-08-07T09:00:00+03:00',
        to: '2026-08-07T10:00:00+03:00',
      },
      allowAllScope,
    );
  });

  it('returns an appointment by id', async () => {
    const { app, service } = createTestApp();
    service.getAppointmentById.mockResolvedValue(appointment);

    const response = await request(app).get(
      `/api/v1/appointments/${appointmentId}`,
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual(appointment);
    expect(service.getAppointmentById).toHaveBeenCalledWith(appointmentId);
  });

  it('rejects invalid appointment ids before calling the service', async () => {
    const { app, service } = createTestApp();

    const response = await request(app).get('/api/v1/appointments/not-a-uuid');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(service.getAppointmentById).not.toHaveBeenCalled();
  });

  it('returns 404 when an appointment does not exist', async () => {
    const { app, service } = createTestApp();
    service.getAppointmentById.mockRejectedValue(
      createAppointmentNotFoundError(),
    );

    const response = await request(app).get(
      `/api/v1/appointments/${appointmentId}`,
    );

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('APPOINTMENT_NOT_FOUND');
  });

  it('patches an appointment and returns the updated payload', async () => {
    const { app, service } = createTestApp();
    service.updateAppointment.mockResolvedValue({
      ...appointment,
      status: 'CONFIRMED',
      updatedAt: '2026-08-06T00:01:00.000Z',
    });

    const response = await request(app)
      .patch(`/api/v1/appointments/${appointmentId}`)
      .send({
        scheduledStart: ' 2026-08-07T10:00:00+03:00 ',
        status: 'confirmed',
      });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('CONFIRMED');
    expect(service.updateAppointment).toHaveBeenCalledWith(appointmentId, {
      scheduledStart: '2026-08-07T10:00:00+03:00',
      status: 'CONFIRMED',
    });
  });

  it('rejects an empty PATCH body', async () => {
    const { app, service } = createTestApp();

    const response = await request(app)
      .patch(`/api/v1/appointments/${appointmentId}`)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(service.updateAppointment).not.toHaveBeenCalled();
  });

  it('rejects immutable PATCH fields', async () => {
    const { app, service } = createTestApp();

    const response = await request(app)
      .patch(`/api/v1/appointments/${appointmentId}`)
      .send({
        patientId: appointment.patientId,
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(service.updateAppointment).not.toHaveBeenCalled();
  });

  it('returns appointment conflict and state conflict errors', async () => {
    const { app, service } = createTestApp();
    service.updateAppointment
      .mockRejectedValueOnce(createAppointmentConflictError())
      .mockRejectedValueOnce(createAppointmentStateConflictError());

    const conflictResponse = await request(app)
      .patch(`/api/v1/appointments/${appointmentId}`)
      .send({
        scheduledStart: '2026-08-07T10:00:00+03:00',
        scheduledEnd: '2026-08-07T10:30:00+03:00',
      });
    const stateConflictResponse = await request(app)
      .patch(`/api/v1/appointments/${appointmentId}`)
      .send({
        status: 'completed',
      });

    expect(conflictResponse.status).toBe(409);
    expect(conflictResponse.body.error.code).toBe('APPOINTMENT_CONFLICT');
    expect(stateConflictResponse.status).toBe(409);
    expect(stateConflictResponse.body.error.code).toBe(
      'APPOINTMENT_STATE_CONFLICT',
    );
  });

  it('cancels an appointment with a required cancellation reason', async () => {
    const { app, service } = createTestApp();
    service.cancelAppointment.mockResolvedValue({
      ...appointment,
      status: 'CANCELLED',
      cancellationReason: 'Patient requested a later time',
      cancelledAt: '2026-08-06T00:01:00.000Z',
      updatedAt: '2026-08-06T00:01:00.000Z',
    });

    const response = await request(app)
      .post(`/api/v1/appointments/${appointmentId}/cancel`)
      .send({
        cancellationReason: '  Patient requested a later time  ',
      });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('CANCELLED');
    expect(service.cancelAppointment).toHaveBeenCalledWith(appointmentId, {
      cancellationReason: 'Patient requested a later time',
    });
  });

  it('returns 404 when cancelling a missing appointment', async () => {
    const { app, service } = createTestApp();
    service.cancelAppointment.mockRejectedValue(
      createAppointmentNotFoundError(),
    );

    const response = await request(app)
      .post(`/api/v1/appointments/${appointmentId}/cancel`)
      .send({
        cancellationReason: 'Patient requested a later time',
      });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('APPOINTMENT_NOT_FOUND');
  });

  it('returns 409 when cancelling an invalid appointment state', async () => {
    const { app, service } = createTestApp();
    service.cancelAppointment.mockRejectedValue(
      createAppointmentStateConflictError(),
    );

    const response = await request(app)
      .post(`/api/v1/appointments/${appointmentId}/cancel`)
      .send({
        cancellationReason: 'Patient requested a later time',
      });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('APPOINTMENT_STATE_CONFLICT');
  });
});
