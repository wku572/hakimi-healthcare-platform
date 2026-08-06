import type {
  Appointment,
  AppointmentListQuery,
  AppointmentListResponse,
  CancelAppointmentInput,
  CreateAppointmentInput,
  UpdateAppointmentInput,
} from '@hakimi/shared';
import {
  createAppointmentConflictError,
  createAppointmentNotFoundError,
  createAssignmentNotFoundError,
  createAppointmentStateConflictError,
  createFacilityInactiveError,
  createFacilityNotFoundError,
  createInactivePatientError,
  createInactivePractitionerError,
  createPatientNotFoundError,
  createPatientRegistrationNotFoundError,
  createPractitionerNotFoundError,
  createValidationError,
} from '../http/api-error.js';
import type { AppointmentRepository } from './repository.js';
import type { ReminderRepository } from '../reminders/repository.js';
import type { CreateAppointmentReminderInput } from '../reminders/repository.js';

export type AppointmentService = {
  createAppointment(input: CreateAppointmentInput): Promise<Appointment>;
  listAppointments(
    query: AppointmentListQuery,
  ): Promise<AppointmentListResponse>;
  getAppointmentById(id: string): Promise<Appointment>;
  updateAppointment(
    id: string,
    input: UpdateAppointmentInput,
  ): Promise<Appointment>;
  cancelAppointment(
    id: string,
    input: CancelAppointmentInput,
  ): Promise<Appointment>;
};

type AppointmentReminderCommands = Pick<
  ReminderRepository,
  | 'createAppointmentReminder'
  | 'cancelActiveAppointmentReminders'
  | 'supersedeAppointmentReminders'
>;

const noopReminderCommands: AppointmentReminderCommands = {
  async createAppointmentReminder() {
    return null;
  },
  async cancelActiveAppointmentReminders() {
    return 0;
  },
  async supersedeAppointmentReminders() {
    return 0;
  },
};

function normalizeText(value: string) {
  return value.trim();
}

function normalizeDateTime(value: string) {
  return new Date(value).toISOString();
}

function normalizeCreateInput(
  input: CreateAppointmentInput,
): CreateAppointmentInput {
  return {
    patientId: input.patientId,
    practitionerId: input.practitionerId,
    facilityId: input.facilityId,
    scheduledStart: normalizeDateTime(normalizeText(input.scheduledStart)),
    scheduledEnd: normalizeDateTime(normalizeText(input.scheduledEnd)),
  };
}

function normalizeUpdateInput(
  input: UpdateAppointmentInput,
): UpdateAppointmentInput {
  const normalized: UpdateAppointmentInput = {};

  if (input.scheduledStart !== undefined) {
    normalized.scheduledStart = normalizeDateTime(
      normalizeText(input.scheduledStart),
    );
  }

  if (input.scheduledEnd !== undefined) {
    normalized.scheduledEnd = normalizeDateTime(
      normalizeText(input.scheduledEnd),
    );
  }

  if (input.status !== undefined) {
    normalized.status = input.status
      .trim()
      .toUpperCase() as UpdateAppointmentInput['status'];
  }

  return normalized;
}

function normalizeCancelInput(
  input: CancelAppointmentInput,
): CancelAppointmentInput {
  return {
    cancellationReason: normalizeText(input.cancellationReason),
  };
}

function ensureAppointmentWindow(start: string, end: string) {
  if (new Date(start).getTime() >= new Date(end).getTime()) {
    throw createValidationError([
      {
        field: 'Scheduled end',
        message: 'Scheduled end must be later than scheduled start',
      },
    ]);
  }
}

function ensureScheduledStartIsNotInThePast(start: string) {
  if (new Date(start).getTime() < Date.now()) {
    throw createValidationError([
      {
        field: 'Scheduled start',
        message: 'Scheduled start cannot be in the past',
      },
    ]);
  }
}

function ensureFacilityStatus(
  facility: { id: string; is_active: boolean } | null,
): asserts facility is { id: string; is_active: boolean } {
  if (!facility) {
    throw createFacilityNotFoundError();
  }

  if (!facility.is_active) {
    throw createFacilityInactiveError();
  }
}

function ensurePractitionerStatus(
  practitioner: { id: string; is_active: boolean } | null,
): asserts practitioner is { id: string; is_active: boolean } {
  if (!practitioner) {
    throw createPractitionerNotFoundError();
  }

  if (!practitioner.is_active) {
    throw createInactivePractitionerError();
  }
}

function ensurePatientStatus(
  patient: { id: string; is_active: boolean } | null,
): asserts patient is { id: string; is_active: boolean } {
  if (!patient) {
    throw createPatientNotFoundError();
  }

  if (!patient.is_active) {
    throw createInactivePatientError();
  }
}

function ensureUpdateTransition(
  currentStatus: string,
  requestedStatus?: string,
) {
  if (
    currentStatus === 'CANCELLED' ||
    currentStatus === 'COMPLETED' ||
    currentStatus === 'NO_SHOW'
  ) {
    throw createAppointmentStateConflictError();
  }

  if (!requestedStatus || requestedStatus === currentStatus) {
    return;
  }

  if (requestedStatus === 'CANCELLED') {
    throw createAppointmentStateConflictError();
  }

  if (currentStatus === 'SCHEDULED') {
    if (requestedStatus !== 'CONFIRMED') {
      throw createAppointmentStateConflictError();
    }
    return;
  }

  if (currentStatus === 'CONFIRMED') {
    if (requestedStatus !== 'COMPLETED' && requestedStatus !== 'NO_SHOW') {
      throw createAppointmentStateConflictError();
    }
    return;
  }

  throw createAppointmentStateConflictError();
}

export function createAppointmentService(
  repository: AppointmentRepository,
  reminderCommands: AppointmentReminderCommands = noopReminderCommands,
): AppointmentService {
  return {
    async createAppointment(input) {
      const normalized = normalizeCreateInput(input);
      ensureAppointmentWindow(
        normalized.scheduledStart,
        normalized.scheduledEnd,
      );
      ensureScheduledStartIsNotInThePast(normalized.scheduledStart);

      return repository.withTransaction(async (tx) => {
        const facility = await repository.getFacilityStatus(
          normalized.facilityId,
          tx,
        );
        ensureFacilityStatus(facility);

        const practitioner = await repository.getPractitionerStatus(
          normalized.practitionerId,
          tx,
        );
        ensurePractitionerStatus(practitioner);

        const assignment = await repository.getActivePractitionerAssignment(
          normalized.practitionerId,
          normalized.facilityId,
          tx,
        );

        if (!assignment) {
          throw createAssignmentNotFoundError(
            'Practitioner is not assigned to this facility',
          );
        }

        const patient = await repository.getPatientStatus(
          normalized.patientId,
          tx,
        );
        ensurePatientStatus(patient);

        const registration = await repository.getPatientRegistration(
          normalized.patientId,
          normalized.facilityId,
          tx,
        );

        if (!registration) {
          throw createPatientRegistrationNotFoundError();
        }

        const conflict = await repository.findConflictingAppointment(
          normalized.practitionerId,
          normalized.scheduledStart,
          normalized.scheduledEnd,
          undefined,
          tx,
        );

        if (conflict) {
          throw createAppointmentConflictError();
        }

        return repository.createAppointment(normalized, tx);
      });
    },

    async listAppointments(query) {
      const result = await repository.listAppointments(query);

      return {
        data: result.rows,
        pagination: result.pagination,
      };
    },

    async getAppointmentById(id) {
      const appointment = await repository.findAppointmentById(id);

      if (!appointment) {
        throw createAppointmentNotFoundError();
      }

      return appointment;
    },

    async updateAppointment(id, input) {
      const normalized = normalizeUpdateInput(input);

      return repository.withTransaction(async (tx) => {
        const existing = await repository.findAppointmentScheduleStateById(
          id,
          tx,
        );

        if (!existing) {
          throw createAppointmentNotFoundError();
        }

        ensureUpdateTransition(existing.status, normalized.status);

        const existingScheduledStart = new Date(
          existing.scheduled_start,
        ).toISOString();
        const existingScheduledEnd = new Date(
          existing.scheduled_end,
        ).toISOString();
        const nextScheduledStart =
          normalized.scheduledStart ?? existingScheduledStart;
        const nextScheduledEnd =
          normalized.scheduledEnd ?? existingScheduledEnd;
        const nextStatus = normalized.status ?? existing.status;
        const hasTimeChanges =
          normalized.scheduledStart !== undefined ||
          normalized.scheduledEnd !== undefined;
        const hasStatusChanges =
          normalized.status !== undefined &&
          normalized.status !== existing.status;

        if (
          !hasTimeChanges &&
          !hasStatusChanges &&
          nextScheduledStart === existingScheduledStart &&
          nextScheduledEnd === existingScheduledEnd
        ) {
          const appointment = await repository.findAppointmentById(id, tx);

          if (!appointment) {
            throw createAppointmentNotFoundError();
          }

          return appointment;
        }

        if (
          hasTimeChanges &&
          (normalized.status === 'COMPLETED' || normalized.status === 'NO_SHOW')
        ) {
          throw createAppointmentStateConflictError();
        }

        if (hasTimeChanges) {
          ensureAppointmentWindow(nextScheduledStart, nextScheduledEnd);
          ensureScheduledStartIsNotInThePast(nextScheduledStart);
        }

        if (nextStatus === 'SCHEDULED' || nextStatus === 'CONFIRMED') {
          const conflict = await repository.findConflictingAppointment(
            existing.practitioner_id,
            nextScheduledStart,
            nextScheduledEnd,
            existing.id,
            tx,
          );

          if (conflict) {
            throw createAppointmentConflictError();
          }
        }

        const updated = await repository.updateAppointment(id, normalized, tx);

        if (!updated) {
          throw createAppointmentNotFoundError();
        }

        const nextScheduleVersion =
          existing.schedule_version + (hasTimeChanges ? 1 : 0);

        if (hasTimeChanges) {
          await reminderCommands.supersedeAppointmentReminders(
            id,
            nextScheduleVersion,
            tx,
          );
        }

        if (nextStatus === 'CONFIRMED') {
          const availableAt = new Date(
            Date.parse(nextScheduledStart) - 24 * 60 * 60 * 1000,
          ).toISOString();

          if (Date.parse(availableAt) > Date.now()) {
            const reminderInput: CreateAppointmentReminderInput = {
              appointmentId: id,
              reminderKind: 'APPOINTMENT_24H',
              scheduleVersion: nextScheduleVersion,
              idempotencyKey: `${id}:APPOINTMENT_24H:${nextScheduleVersion}`,
              availableAt,
            };

            await reminderCommands.createAppointmentReminder(reminderInput, tx);
          }
        }

        if (nextStatus === 'COMPLETED' || nextStatus === 'NO_SHOW') {
          await reminderCommands.cancelActiveAppointmentReminders(id, tx);
        }

        return updated;
      });
    },

    async cancelAppointment(id, input) {
      const normalized = normalizeCancelInput(input);

      return repository.withTransaction(async (tx) => {
        const existing = await repository.findAppointmentById(id, tx);

        if (!existing) {
          throw createAppointmentNotFoundError();
        }

        if (existing.status === 'CANCELLED') {
          return existing;
        }

        if (existing.status === 'COMPLETED' || existing.status === 'NO_SHOW') {
          throw createAppointmentStateConflictError();
        }

        const cancelled = await repository.cancelAppointment(
          id,
          normalized,
          tx,
        );

        if (!cancelled) {
          throw createAppointmentNotFoundError();
        }

        await reminderCommands.cancelActiveAppointmentReminders(id, tx);

        return cancelled;
      });
    },
  };
}
