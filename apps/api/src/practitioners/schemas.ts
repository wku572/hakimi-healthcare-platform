import {
  type CreatePractitionerAssignmentInput,
  type CreatePractitionerInput,
  type PractitionerListQuery,
  type UpdatePractitionerAssignmentInput,
  type UpdatePractitionerInput,
} from '@hakimi/shared';
import { z } from 'zod';
import {
  optionalNullableString,
  parseWithSchema,
  requiredTrimmedString,
} from '../http/validation.js';

const optionalNullableEmailSchema = z.preprocess((value) => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed.toLowerCase();
}, z.string().email('Email must be a valid email address').max(254).nullable().optional());

export const createPractitionerSchema = z
  .object({
    code: requiredTrimmedString(2, 50, 'Code'),
    firstName: requiredTrimmedString(2, 100, 'First name'),
    middleName: optionalNullableString(100),
    lastName: requiredTrimmedString(2, 100, 'Last name'),
    profession: requiredTrimmedString(2, 100, 'Profession'),
    licenseNumber: requiredTrimmedString(2, 100, 'License number'),
    phone: optionalNullableString(30),
    email: optionalNullableEmailSchema,
    bio: optionalNullableString(2000),
    isActive: z.boolean().optional().default(true),
  })
  .strict();

export const updatePractitionerSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(2, 'Code must be at least 2 characters')
      .max(50, 'Code must be at most 50 characters')
      .optional(),
    firstName: z
      .string()
      .trim()
      .min(2, 'First name must be at least 2 characters')
      .max(100, 'First name must be at most 100 characters')
      .optional(),
    middleName: optionalNullableString(100),
    lastName: z
      .string()
      .trim()
      .min(2, 'Last name must be at least 2 characters')
      .max(100, 'Last name must be at most 100 characters')
      .optional(),
    profession: z
      .string()
      .trim()
      .min(2, 'Profession must be at least 2 characters')
      .max(100, 'Profession must be at most 100 characters')
      .optional(),
    licenseNumber: z
      .string()
      .trim()
      .min(2, 'License number must be at least 2 characters')
      .max(100, 'License number must be at most 100 characters')
      .optional(),
    phone: optionalNullableString(30),
    email: optionalNullableEmailSchema,
    bio: optionalNullableString(2000),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Patch body must not be empty',
    path: ['body'],
  });

export const practitionerIdParamSchema = z
  .object({
    practitionerId: z.string().uuid('Practitioner ID must be a valid UUID'),
  })
  .strict();

export const assignmentIdParamSchema = z
  .object({
    assignmentId: z.string().uuid('Assignment ID must be a valid UUID'),
  })
  .strict();

export const listPractitionersQuerySchema = z
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
    profession: z
      .string()
      .trim()
      .min(1, 'Profession must not be empty')
      .max(100, 'Profession must be at most 100 characters')
      .optional(),
    isActive: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .optional(),
    facilityId: z.string().uuid('Facility ID must be a valid UUID').optional(),
    search: z
      .string()
      .trim()
      .min(2, 'Search must be at least 2 characters')
      .max(100, 'Search must be at most 100 characters')
      .optional(),
  })
  .strict();

export const createPractitionerAssignmentSchema = z
  .object({
    facilityId: z.string().uuid('Facility ID must be a valid UUID'),
    roleTitle: requiredTrimmedString(2, 100, 'Role title'),
    department: optionalNullableString(100),
    isPrimary: z.boolean().optional().default(false),
    isActive: z.boolean().optional().default(true),
  })
  .strict()
  .refine((value) => !(value.isPrimary && value.isActive === false), {
    message: 'Primary assignments must be active',
    path: ['isPrimary'],
  });

export const updatePractitionerAssignmentSchema = z
  .object({
    roleTitle: z
      .string()
      .trim()
      .min(2, 'Role title must be at least 2 characters')
      .max(100, 'Role title must be at most 100 characters')
      .optional(),
    department: optionalNullableString(100),
    isPrimary: z.boolean().optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Patch body must not be empty',
    path: ['body'],
  })
  .refine((value) => !(value.isPrimary && value.isActive === false), {
    message: 'Primary assignments must be active',
    path: ['isPrimary'],
  });

export function parseCreatePractitionerInput(
  input: unknown,
): CreatePractitionerInput {
  return parseWithSchema(createPractitionerSchema, input);
}

export function parseUpdatePractitionerInput(
  input: unknown,
): UpdatePractitionerInput {
  return parseWithSchema(updatePractitionerSchema, input);
}

export function parsePractitionerIdParam(input: unknown) {
  return parseWithSchema(practitionerIdParamSchema, input);
}

export function parseAssignmentIdParam(input: unknown) {
  return parseWithSchema(assignmentIdParamSchema, input);
}

export function parseListPractitionersQuery(
  input: unknown,
): PractitionerListQuery {
  return parseWithSchema(listPractitionersQuerySchema, input);
}

export function parseCreatePractitionerAssignmentInput(
  input: unknown,
): CreatePractitionerAssignmentInput {
  return parseWithSchema(createPractitionerAssignmentSchema, input);
}

export function parseUpdatePractitionerAssignmentInput(
  input: unknown,
): UpdatePractitionerAssignmentInput {
  return parseWithSchema(updatePractitionerAssignmentSchema, input);
}
