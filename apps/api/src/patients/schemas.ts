import {
  administrativeSexes,
  type CreatePatientInput,
  type PatientListQuery,
  type UpdatePatientInput,
} from '@hakimi/shared';
import { z } from 'zod';
import {
  optionalNullableString,
  parseWithSchema,
  requiredTrimmedString,
} from '../http/validation.js';

function currentEthiopianDateIso() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Addis_Ababa',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(new Date());
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    throw new Error('Unable to determine the current date.');
  }

  return `${year}-${month}-${day}`;
}

function isValidDateOnly(value: string) {
  const parsed = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

function optionalNullableDateOfBirthSchema() {
  return z.preprocess(
    (value) => {
      if (typeof value !== 'string') {
        return value;
      }

      const trimmed = value.trim();
      return trimmed === '' ? null : trimmed;
    },
    z
      .string()
      .refine(
        isValidDateOnly,
        'Date of birth must be a valid date in YYYY-MM-DD format',
      )
      .refine((value) => value <= currentEthiopianDateIso(), {
        message: 'Date of birth cannot be in the future',
      })
      .nullable()
      .optional(),
  );
}

const administrativeSexSchema = z.preprocess(
  (value) => {
    if (typeof value !== 'string') {
      return value;
    }

    return value.trim().toLowerCase();
  },
  z.enum(administrativeSexes, {
    message:
      'Administrative sex must be one of female, male, other, or unknown',
  }),
);

const optionalNullableEmailSchema = z.preprocess((value) => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed.toLowerCase();
}, z.string().email('Email must be a valid email address').max(254).nullable().optional());

export const createPatientSchema = z
  .object({
    facilityId: z.string().uuid('Facility ID must be a valid UUID'),
    medicalRecordNumber: requiredTrimmedString(1, 50, 'Medical record number'),
    firstName: requiredTrimmedString(1, 100, 'First name'),
    middleName: optionalNullableString(100),
    lastName: optionalNullableString(100),
    dateOfBirth: optionalNullableDateOfBirthSchema(),
    administrativeSex: administrativeSexSchema,
    phone: optionalNullableString(30),
    email: optionalNullableEmailSchema,
    addressLine: optionalNullableString(200),
    city: optionalNullableString(100),
    region: optionalNullableString(100),
  })
  .strict();

export const updatePatientSchema = z
  .object({
    firstName: z
      .string()
      .trim()
      .min(1, 'First name must be at least 1 character')
      .max(100, 'First name must be at most 100 characters')
      .optional(),
    middleName: optionalNullableString(100),
    lastName: optionalNullableString(100),
    dateOfBirth: optionalNullableDateOfBirthSchema(),
    administrativeSex: administrativeSexSchema.optional(),
    phone: optionalNullableString(30),
    email: optionalNullableEmailSchema,
    addressLine: optionalNullableString(200),
    city: optionalNullableString(100),
    region: optionalNullableString(100),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Patch body must not be empty',
    path: ['body'],
  });

export const patientIdParamSchema = z
  .object({
    patientId: z.string().uuid('Patient ID must be a valid UUID'),
  })
  .strict();

export const listPatientsQuerySchema = z
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
    search: z
      .string()
      .trim()
      .min(2, 'Search must be at least 2 characters')
      .max(100, 'Search must be at most 100 characters')
      .optional(),
    facilityId: z.string().uuid('Facility ID must be a valid UUID').optional(),
    medicalRecordNumber: z
      .string()
      .trim()
      .min(1, 'Medical record number must not be empty')
      .max(50, 'Medical record number must be at most 50 characters')
      .optional(),
    administrativeSex: administrativeSexSchema.optional(),
    isActive: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .optional(),
  })
  .strict();

export function parseCreatePatientInput(input: unknown): CreatePatientInput {
  return parseWithSchema(createPatientSchema, input);
}

export function parseUpdatePatientInput(input: unknown): UpdatePatientInput {
  return parseWithSchema(updatePatientSchema, input);
}

export function parsePatientIdParam(input: unknown) {
  return parseWithSchema(patientIdParamSchema, input);
}

export function parseListPatientsQuery(input: unknown): PatientListQuery {
  return parseWithSchema(listPatientsQuerySchema, input);
}
