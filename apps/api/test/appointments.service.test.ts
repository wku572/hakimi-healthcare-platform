import { describe, expect, it, vi } from 'vitest';
import { createAppointmentService } from '../src/appointments/service.js';

function createRepositoryMock() {
  return {
    withTransaction: vi.fn(),
    createAppointment: vi.fn(),
    findAppointmentById: vi.fn(),
    findAppointmentScheduleStateById: vi.fn(),
    listAppointments: vi.fn(),
    updateAppointment: vi.fn(),
    cancelAppointment: vi.fn(),
    getFacilityStatus: vi.fn(),
    getPractitionerStatus: vi.fn(),
    getPatientStatus: vi.fn(),
    getActivePractitionerAssignment: vi.fn(),
    getPatientRegistration: vi.fn(),
    findConflictingAppointment: vi.fn(),
  };
}

const appointmentId = '11111111-1111-4111-8111-111111111111';
const patientId = '22222222-2222-4222-8222-222222222222';
const practitionerId = '33333333-3333-4333-8333-333333333333';
const facilityId = '44444444-4444-4444-8444-444444444444';

const appointment = {
  id: appointmentId,
  patientId,
  practitionerId,
  facilityId,
  scheduledStart: '2026-08-07T06:00:00.000Z',
  scheduledEnd: '2026-08-07T06:30:00.000Z',
  status: 'SCHEDULED' as const,
  cancellationReason: null,
  cancelledAt: null,
  createdAt: '2026-08-06T00:00:00.000Z',
  updatedAt: '2026-08-06T00:00:00.000Z',
  patient: {
    id: patientId,
    firstName: 'Mekdes',
    middleName: null,
    lastName: 'Tadesse',
    dateOfBirth: '1995-01-01',
    administrativeSex: 'female' as const,
    isActive: true,
    medicalRecordNumber: 'MRN-001',
  },
  practitioner: {
    id: practitionerId,
    code: 'PRAC-001',
    firstName: 'Abebe',
    middleName: null,
    lastName: 'Kebede',
    profession: 'general practitioner',
    isActive: true,
  },
  facility: {
    id: facilityId,
    code: 'FAC-001',
    name: 'Sunrise Clinic',
    facilityType: 'clinic' as const,
    region: 'Addis Ababa',
    city: 'Addis Ababa',
    isActive: true,
  },
};

const appointmentScheduleState = {
  id: appointmentId,
  practitioner_id: practitionerId,
  status: 'SCHEDULED' as const,
  schedule_version: 1,
  scheduled_start: '2026-08-08T06:00:00.000Z',
  scheduled_end: '2026-08-08T06:30:00.000Z',
};

describe('appointment service', () => {
  it('normalizes create payloads before calling the repository', async () => {
    const repository = createRepositoryMock();
    const tx = { query: vi.fn() };
    repository.withTransaction.mockImplementation(async (work) => work(tx));
    repository.getFacilityStatus.mockResolvedValue({
      id: facilityId,
      is_active: true,
    });
    repository.getPractitionerStatus.mockResolvedValue({
      id: practitionerId,
      is_active: true,
    });
    repository.getActivePractitionerAssignment.mockResolvedValue({
      id: '55555555-5555-4555-8555-555555555555',
    });
    repository.getPatientStatus.mockResolvedValue({
      id: patientId,
      is_active: true,
    });
    repository.getPatientRegistration.mockResolvedValue({
      id: '66666666-6666-4666-8666-666666666666',
    });
    repository.findConflictingAppointment.mockResolvedValue(null);
    repository.createAppointment.mockResolvedValue(appointment);

    const service = createAppointmentService(repository);

    await service.createAppointment({
      patientId,
      practitionerId,
      facilityId,
      scheduledStart: '2026-08-07T09:00:00+03:00',
      scheduledEnd: '2026-08-07T09:30:00+03:00',
    });

    expect(repository.getFacilityStatus).toHaveBeenCalledWith(facilityId, tx);
    expect(repository.getPractitionerStatus).toHaveBeenCalledWith(
      practitionerId,
      tx,
    );
    expect(repository.getPatientStatus).toHaveBeenCalledWith(patientId, tx);
    expect(repository.getActivePractitionerAssignment).toHaveBeenCalledWith(
      practitionerId,
      facilityId,
      tx,
    );
    expect(repository.getPatientRegistration).toHaveBeenCalledWith(
      patientId,
      facilityId,
      tx,
    );
    expect(repository.findConflictingAppointment).toHaveBeenCalledWith(
      practitionerId,
      '2026-08-07T06:00:00.000Z',
      '2026-08-07T06:30:00.000Z',
      undefined,
      tx,
    );
    expect(repository.createAppointment).toHaveBeenCalledWith(
      {
        patientId,
        practitionerId,
        facilityId,
        scheduledStart: '2026-08-07T06:00:00.000Z',
        scheduledEnd: '2026-08-07T06:30:00.000Z',
      },
      tx,
    );
  });

  it('throws lookup and conflict errors during create', async () => {
    const repository = createRepositoryMock();
    const tx = { query: vi.fn() };
    repository.withTransaction.mockImplementation(async (work) => work(tx));
    repository.getFacilityStatus.mockResolvedValueOnce(null);
    repository.getFacilityStatus.mockResolvedValueOnce({
      id: facilityId,
      is_active: false,
    });
    repository.getPractitionerStatus.mockResolvedValue({
      id: practitionerId,
      is_active: true,
    });
    repository.getActivePractitionerAssignment.mockResolvedValue({
      id: '55555555-5555-4555-8555-555555555555',
    });
    repository.getPatientStatus.mockResolvedValue({
      id: patientId,
      is_active: false,
    });
    repository.getPatientRegistration.mockResolvedValue(null);
    repository.findConflictingAppointment.mockResolvedValue(appointment);

    const service = createAppointmentService(repository);

    await expect(
      service.createAppointment({
        patientId,
        practitionerId,
        facilityId,
        scheduledStart: '2026-08-07T09:00:00+03:00',
        scheduledEnd: '2026-08-07T09:30:00+03:00',
      }),
    ).rejects.toMatchObject({
      code: 'FACILITY_NOT_FOUND',
      statusCode: 404,
    });

    await expect(
      service.createAppointment({
        patientId,
        practitionerId,
        facilityId,
        scheduledStart: '2026-08-07T09:00:00+03:00',
        scheduledEnd: '2026-08-07T09:30:00+03:00',
      }),
    ).rejects.toMatchObject({
      code: 'FACILITY_INACTIVE',
      statusCode: 409,
    });
  });

  it('throws registration and conflict errors during create', async () => {
    const repository = createRepositoryMock();
    const tx = { query: vi.fn() };
    repository.withTransaction.mockImplementation(async (work) => work(tx));
    repository.getFacilityStatus.mockResolvedValue({
      id: facilityId,
      is_active: true,
    });
    repository.getPractitionerStatus.mockResolvedValue({
      id: practitionerId,
      is_active: true,
    });
    repository.getActivePractitionerAssignment.mockResolvedValue({
      id: '55555555-5555-4555-8555-555555555555',
    });
    repository.getPatientStatus.mockResolvedValue({
      id: patientId,
      is_active: true,
    });
    repository.getPatientRegistration.mockResolvedValueOnce(null);
    repository.getPatientRegistration.mockResolvedValueOnce({
      id: '66666666-6666-4666-8666-666666666666',
    });
    repository.findConflictingAppointment.mockResolvedValue(appointment);

    const service = createAppointmentService(repository);

    await expect(
      service.createAppointment({
        patientId,
        practitionerId,
        facilityId,
        scheduledStart: '2026-08-07T09:00:00+03:00',
        scheduledEnd: '2026-08-07T09:30:00+03:00',
      }),
    ).rejects.toMatchObject({
      code: 'PATIENT_REGISTRATION_NOT_FOUND',
      statusCode: 404,
    });

    await expect(
      service.createAppointment({
        patientId,
        practitionerId,
        facilityId,
        scheduledStart: '2026-08-07T09:00:00+03:00',
        scheduledEnd: '2026-08-07T09:30:00+03:00',
      }),
    ).rejects.toMatchObject({
      code: 'APPOINTMENT_CONFLICT',
      statusCode: 409,
    });
  });

  it('normalizes updates and enforces valid status transitions', async () => {
    const repository = createRepositoryMock();
    const tx = { query: vi.fn() };
    repository.withTransaction.mockImplementation(async (work) => work(tx));
    repository.findAppointmentScheduleStateById.mockResolvedValue(
      appointmentScheduleState,
    );
    repository.findAppointmentById.mockResolvedValue(appointment);
    repository.findConflictingAppointment.mockResolvedValue(null);
    repository.updateAppointment.mockResolvedValue({
      ...appointment,
      status: 'CONFIRMED',
      scheduledStart: '2026-08-07T05:45:00.000Z',
      scheduledEnd: '2026-08-07T06:15:00.000Z',
      updatedAt: '2026-08-06T00:01:00.000Z',
    });

    const service = createAppointmentService(repository);

    await service.updateAppointment(appointmentId, {
      scheduledStart: '2026-08-07T08:45:00+03:00',
      scheduledEnd: '2026-08-07T09:15:00+03:00',
      status: 'CONFIRMED',
    });

    expect(repository.findAppointmentScheduleStateById).toHaveBeenCalledWith(
      appointmentId,
      tx,
    );
    expect(repository.findConflictingAppointment).toHaveBeenCalledWith(
      practitionerId,
      '2026-08-07T05:45:00.000Z',
      '2026-08-07T06:15:00.000Z',
      appointmentId,
      tx,
    );
    expect(repository.updateAppointment).toHaveBeenCalledWith(
      appointmentId,
      {
        scheduledStart: '2026-08-07T05:45:00.000Z',
        scheduledEnd: '2026-08-07T06:15:00.000Z',
        status: 'CONFIRMED',
      },
      tx,
    );
  });

  it('creates, supersedes, and cancels reminders during lifecycle transitions', async () => {
    const repository = createRepositoryMock();
    const tx = { query: vi.fn() };
    const reminderCommands = {
      createAppointmentReminder: vi.fn().mockResolvedValue(null),
      cancelActiveAppointmentReminders: vi.fn().mockResolvedValue(1),
      supersedeAppointmentReminders: vi.fn().mockResolvedValue(1),
    };

    repository.withTransaction.mockImplementation(async (work) => work(tx));
    repository.findAppointmentScheduleStateById.mockResolvedValue({
      ...appointmentScheduleState,
      status: 'SCHEDULED',
    });
    repository.findConflictingAppointment.mockResolvedValue(null);
    repository.updateAppointment.mockResolvedValue({
      ...appointment,
      status: 'CONFIRMED',
      scheduledStart: '2026-08-08T05:45:00.000Z',
      scheduledEnd: '2026-08-08T06:15:00.000Z',
      updatedAt: '2026-08-06T00:01:00.000Z',
    });

    const service = createAppointmentService(repository, reminderCommands);

    await service.updateAppointment(appointmentId, {
      status: 'CONFIRMED',
    });

    expect(reminderCommands.createAppointmentReminder).toHaveBeenCalledWith(
      {
        appointmentId,
        reminderKind: 'APPOINTMENT_24H',
        scheduleVersion: 1,
        idempotencyKey: `${appointmentId}:APPOINTMENT_24H:1`,
        availableAt: '2026-08-07T06:00:00.000Z',
      },
      tx,
    );

    repository.findAppointmentScheduleStateById.mockResolvedValue({
      ...appointmentScheduleState,
      status: 'CONFIRMED',
      schedule_version: 1,
    });
    repository.updateAppointment.mockResolvedValue({
      ...appointment,
      status: 'CONFIRMED',
      scheduledStart: '2026-08-08T05:45:00.000Z',
      scheduledEnd: '2026-08-08T06:15:00.000Z',
      updatedAt: '2026-08-06T00:02:00.000Z',
    });

    await service.updateAppointment(appointmentId, {
      scheduledStart: '2026-08-08T08:45:00+03:00',
      scheduledEnd: '2026-08-08T09:15:00+03:00',
    });

    expect(reminderCommands.supersedeAppointmentReminders).toHaveBeenCalledWith(
      appointmentId,
      2,
      tx,
    );
    expect(reminderCommands.createAppointmentReminder).toHaveBeenLastCalledWith(
      {
        appointmentId,
        reminderKind: 'APPOINTMENT_24H',
        scheduleVersion: 2,
        idempotencyKey: `${appointmentId}:APPOINTMENT_24H:2`,
        availableAt: '2026-08-07T05:45:00.000Z',
      },
      tx,
    );

    repository.findAppointmentById.mockResolvedValue(appointment);
    repository.cancelAppointment.mockResolvedValue({
      ...appointment,
      status: 'CANCELLED',
      cancellationReason: 'Patient requested a later time',
      cancelledAt: '2026-08-06T00:03:00.000Z',
      updatedAt: '2026-08-06T00:03:00.000Z',
    });

    await service.cancelAppointment(appointmentId, {
      cancellationReason: 'Patient requested a later time',
    });

    expect(
      reminderCommands.cancelActiveAppointmentReminders,
    ).toHaveBeenCalledWith(appointmentId, tx);
  });

  it('skips creating a reminder when confirmation happens too late for the reminder window', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-07T12:00:00.000Z'));
    try {
      const repository = createRepositoryMock();
      const tx = { query: vi.fn() };
      const reminderCommands = {
        createAppointmentReminder: vi.fn().mockResolvedValue(null),
        cancelActiveAppointmentReminders: vi.fn().mockResolvedValue(0),
        supersedeAppointmentReminders: vi.fn().mockResolvedValue(0),
      };

      repository.withTransaction.mockImplementation(async (work) => work(tx));
      repository.findAppointmentScheduleStateById.mockResolvedValue({
        id: appointmentId,
        practitioner_id: practitionerId,
        status: 'SCHEDULED',
        schedule_version: 1,
        scheduled_start: '2026-08-07T15:00:00.000Z',
        scheduled_end: '2026-08-07T15:30:00.000Z',
      });
      repository.findConflictingAppointment.mockResolvedValue(null);
      repository.updateAppointment.mockResolvedValue({
        ...appointment,
        status: 'CONFIRMED',
        scheduledStart: '2026-08-07T15:00:00.000Z',
        scheduledEnd: '2026-08-07T15:30:00.000Z',
        updatedAt: '2026-08-07T12:00:00.000Z',
      });

      const service = createAppointmentService(repository, reminderCommands);

      await service.updateAppointment(appointmentId, {
        status: 'CONFIRMED',
      });

      expect(reminderCommands.createAppointmentReminder).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects invalid appointment transitions and preserves cancelled history', async () => {
    const repository = createRepositoryMock();
    const tx = { query: vi.fn() };
    repository.withTransaction.mockImplementation(async (work) => work(tx));
    repository.findAppointmentScheduleStateById.mockResolvedValue(
      appointmentScheduleState,
    );
    repository.findAppointmentById
      .mockResolvedValueOnce(appointment)
      .mockResolvedValueOnce({
        ...appointment,
        status: 'CANCELLED',
        cancellationReason: 'Patient requested a later time',
        cancelledAt: '2026-08-06T00:01:00.000Z',
      })
      .mockResolvedValueOnce({
        ...appointment,
        status: 'COMPLETED',
      });
    repository.cancelAppointment.mockResolvedValue({
      ...appointment,
      status: 'CANCELLED',
      cancellationReason: 'Patient requested a later time',
      cancelledAt: '2026-08-06T00:01:00.000Z',
      updatedAt: '2026-08-06T00:01:00.000Z',
    });

    const service = createAppointmentService(repository);

    await expect(
      service.updateAppointment(appointmentId, {
        status: 'COMPLETED',
      }),
    ).rejects.toMatchObject({
      code: 'APPOINTMENT_STATE_CONFLICT',
      statusCode: 409,
    });

    repository.findAppointmentById.mockReset();
    repository.cancelAppointment.mockReset();
    repository.findAppointmentById.mockResolvedValueOnce(appointment);
    repository.cancelAppointment.mockResolvedValue({
      ...appointment,
      status: 'CANCELLED',
      cancellationReason: 'Patient requested a later time',
      cancelledAt: '2026-08-06T00:01:00.000Z',
      updatedAt: '2026-08-06T00:01:00.000Z',
    });

    const cancelled = await service.cancelAppointment(appointmentId, {
      cancellationReason: 'Patient requested a later time',
    });

    expect(cancelled.status).toBe('CANCELLED');
    expect(repository.cancelAppointment).toHaveBeenCalledWith(
      appointmentId,
      {
        cancellationReason: 'Patient requested a later time',
      },
      tx,
    );

    repository.findAppointmentById.mockReset();
    repository.findAppointmentById.mockResolvedValueOnce({
      ...appointment,
      status: 'CANCELLED',
      cancellationReason: 'Patient requested a later time',
      cancelledAt: '2026-08-06T00:01:00.000Z',
    });

    const repeatCancellation = await service.cancelAppointment(appointmentId, {
      cancellationReason: 'Patient requested a later time',
    });

    expect(repeatCancellation.status).toBe('CANCELLED');
    expect(repository.cancelAppointment).toHaveBeenCalledTimes(1);
  });

  it('lists appointments through the repository and returns the response shape', async () => {
    const repository = createRepositoryMock();
    repository.listAppointments.mockResolvedValue({
      rows: [appointment],
      pagination: {
        page: 1,
        pageSize: 20,
        totalItems: 1,
        totalPages: 1,
      },
    });

    const service = createAppointmentService(repository);
    const response = await service.listAppointments({
      page: 1,
      pageSize: 20,
    });

    expect(response).toEqual({
      data: [appointment],
      pagination: {
        page: 1,
        pageSize: 20,
        totalItems: 1,
        totalPages: 1,
      },
    });
  });
});
