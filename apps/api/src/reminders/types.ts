import type { AppointmentStatus } from '@hakimi/shared';

export const reminderKinds = ['APPOINTMENT_24H'] as const;

export type ReminderKind = (typeof reminderKinds)[number];

export const reminderStatuses = [
  'PENDING',
  'PROCESSING',
  'DELIVERED',
  'CANCELLED',
  'SUPERSEDED',
  'DEAD_LETTER',
] as const;

export type ReminderStatus = (typeof reminderStatuses)[number];

export type AppointmentReminder = {
  id: string;
  appointmentId: string;
  reminderKind: ReminderKind;
  scheduleVersion: number;
  idempotencyKey: string;
  availableAt: string;
  status: ReminderStatus;
  attemptCount: number;
  maxAttempts: number;
  lockedAt: string | null;
  lockedUntil: string | null;
  lockedBy: string | null;
  leaseToken: string | null;
  lastErrorCategory: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  supersededAt: string | null;
  deadLetteredAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AppointmentReminderProcessingContext = AppointmentReminder & {
  appointmentScheduleVersion: number;
  appointmentStatus: AppointmentStatus;
  appointmentScheduledStart: string;
  appointmentScheduledEnd: string;
  appointmentIsStarted: boolean;
};
