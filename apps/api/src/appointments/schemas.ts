import type {
  CancelAppointmentInput,
  CreateAppointmentInput,
  AppointmentListQuery,
  UpdateAppointmentInput,
} from '@hakimi/shared';
import { z } from 'zod';
import { parseWithSchema, requiredTrimmedString } from '../http/validation.js';

const appointmentStatuses = [
  'SCHEDULED',
  'CONFIRMED',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
] as const;

const isoDateTimePattern =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : value;
}

function isoDateTimeSchema(label: string) {
  return z.preprocess(
    normalizeText,
    z
      .string()
      .refine(
        (value) =>
          isoDateTimePattern.test(value) && !Number.isNaN(Date.parse(value)),
        `${label} must be a valid ISO 8601 date-time with a timezone offset`,
      ),
  );
}

function appointmentStatusSchema() {
  return z.preprocess((value) => {
    if (typeof value !== 'string') {
      return value;
    }

    return value.trim().toUpperCase();
  }, z.enum(appointmentStatuses));
}

export const createAppointmentSchema = z
  .object({
    patientId: z.string().uuid('Patient ID must be a valid UUID'),
    practitionerId: z.string().uuid('Practitioner ID must be a valid UUID'),
    facilityId: z.string().uuid('Facility ID must be a valid UUID'),
    scheduledStart: isoDateTimeSchema('Scheduled start'),
    scheduledEnd: isoDateTimeSchema('Scheduled end'),
  })
  .strict()
  .superRefine((value, ctx) => {
    const scheduledStart = Date.parse(value.scheduledStart);
    const scheduledEnd = Date.parse(value.scheduledEnd);

    if (scheduledStart >= scheduledEnd) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['scheduledEnd'],
        message: 'Scheduled end must be later than scheduled start',
      });
    }
  });

export const updateAppointmentSchema = z
  .object({
    scheduledStart: isoDateTimeSchema('Scheduled start').optional(),
    scheduledEnd: isoDateTimeSchema('Scheduled end').optional(),
    status: appointmentStatusSchema().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Patch body must not be empty',
    path: ['body'],
  })
  .superRefine((value, ctx) => {
    if (value.scheduledStart && value.scheduledEnd) {
      const scheduledStart = Date.parse(value.scheduledStart);
      const scheduledEnd = Date.parse(value.scheduledEnd);

      if (scheduledStart >= scheduledEnd) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['scheduledEnd'],
          message: 'Scheduled end must be later than scheduled start',
        });
      }
    }
  });

export const cancelAppointmentSchema = z
  .object({
    cancellationReason: requiredTrimmedString(1, 1000, 'Cancellation reason'),
  })
  .strict();

export const appointmentIdParamSchema = z
  .object({
    appointmentId: z.string().uuid('Appointment ID must be a valid UUID'),
  })
  .strict();

export const listAppointmentsQuerySchema = z
  .object({
    page: z.coerce
      .number()
      .int('Page must be an integer')
      .positive('Page must be positive')
      .default(1),
    pageSize: z.coerce
      .number()
      .int('Page size must be an integer')
      .min(1, 'Page size must be at least 1')
      .max(100, 'Page size must be at most 100')
      .default(20),
    facilityId: z.string().uuid('Facility ID must be a valid UUID').optional(),
    practitionerId: z
      .string()
      .uuid('Practitioner ID must be a valid UUID')
      .optional(),
    patientId: z.string().uuid('Patient ID must be a valid UUID').optional(),
    status: appointmentStatusSchema().optional(),
    from: isoDateTimeSchema('From').optional(),
    to: isoDateTimeSchema('To').optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      value.from &&
      value.to &&
      Date.parse(value.from) >= Date.parse(value.to)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['to'],
        message: 'To must be later than From',
      });
    }
  });

export function parseCreateAppointmentInput(
  input: unknown,
): CreateAppointmentInput {
  return parseWithSchema(createAppointmentSchema, input);
}

export function parseUpdateAppointmentInput(
  input: unknown,
): UpdateAppointmentInput {
  return parseWithSchema(updateAppointmentSchema, input);
}

export function parseCancelAppointmentInput(
  input: unknown,
): CancelAppointmentInput {
  return parseWithSchema(cancelAppointmentSchema, input);
}

export function parseAppointmentIdParam(input: unknown) {
  return parseWithSchema(appointmentIdParamSchema, input);
}

export function parseListAppointmentsQuery(
  input: unknown,
): AppointmentListQuery {
  return parseWithSchema(listAppointmentsQuerySchema, input);
}
