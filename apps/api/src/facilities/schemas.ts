import {
  facilityTypes,
  isFacilityType,
  type CreateHealthcareFacilityInput,
  type HealthcareFacilityListQuery,
  type UpdateHealthcareFacilityInput,
} from '@hakimi/shared';
import { z } from 'zod';
import {
  optionalNullableString,
  parseWithSchema,
  requiredTrimmedString,
} from '../http/validation.js';

const facilityTypeSchema = z.custom<(typeof facilityTypes)[number]>(
  (value): value is (typeof facilityTypes)[number] =>
    typeof value === 'string' && isFacilityType(value),
  {
    message:
      'Facility type must be one of hospital, clinic, health_center, diagnostic_center, or pharmacy',
  },
);

const emailSchema = z.preprocess((value) => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}, z.string().email('Email must be a valid email address').max(254).nullable().optional());

export const createHealthcareFacilitySchema = z
  .object({
    code: requiredTrimmedString(2, 50, 'Code'),
    name: requiredTrimmedString(2, 200, 'Name'),
    facilityType: facilityTypeSchema,
    licenseNumber: optionalNullableString(100),
    phone: optionalNullableString(30),
    email: emailSchema,
    region: requiredTrimmedString(2, 100, 'Region'),
    city: requiredTrimmedString(2, 100, 'City'),
    addressLine: optionalNullableString(300),
    isActive: z.boolean().optional().default(true),
  })
  .strict();

export const updateHealthcareFacilitySchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(2, 'Code must be at least 2 characters')
      .max(50, 'Code must be at most 50 characters')
      .optional(),
    name: z
      .string()
      .trim()
      .min(2, 'Name must be at least 2 characters')
      .max(200, 'Name must be at most 200 characters')
      .optional(),
    facilityType: facilityTypeSchema.optional(),
    licenseNumber: optionalNullableString(100),
    phone: optionalNullableString(30),
    email: emailSchema,
    region: z
      .string()
      .trim()
      .min(2, 'Region must be at least 2 characters')
      .max(100, 'Region must be at most 100 characters')
      .optional(),
    city: z
      .string()
      .trim()
      .min(2, 'City must be at least 2 characters')
      .max(100, 'City must be at most 100 characters')
      .optional(),
    addressLine: optionalNullableString(300),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Patch body must not be empty',
    path: ['body'],
  });

export const facilityIdParamSchema = z
  .object({
    id: z.string().uuid('Facility ID must be a valid UUID'),
  })
  .strict();

export const listHealthcareFacilitiesQuerySchema = z
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
    facilityType: facilityTypeSchema.optional(),
    region: z
      .string()
      .trim()
      .min(1, 'Region must not be empty')
      .max(100, 'Region must be at most 100 characters')
      .optional(),
    city: z
      .string()
      .trim()
      .min(1, 'City must not be empty')
      .max(100, 'City must be at most 100 characters')
      .optional(),
    isActive: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .optional(),
    search: z
      .string()
      .trim()
      .min(2, 'Search must be at least 2 characters')
      .max(100, 'Search must be at most 100 characters')
      .optional(),
  })
  .strict();

export function parseCreateHealthcareFacilityInput(
  input: unknown,
): CreateHealthcareFacilityInput {
  return parseWithSchema(createHealthcareFacilitySchema, input);
}

export function parseUpdateHealthcareFacilityInput(
  input: unknown,
): UpdateHealthcareFacilityInput {
  return parseWithSchema(updateHealthcareFacilitySchema, input);
}

export function parseHealthcareFacilityListQuery(
  input: unknown,
): HealthcareFacilityListQuery {
  return parseWithSchema(listHealthcareFacilitiesQuerySchema, input);
}

export function parseFacilityIdParam(input: unknown) {
  return parseWithSchema(facilityIdParamSchema, input);
}
