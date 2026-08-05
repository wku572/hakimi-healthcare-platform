import type { ApiErrorDetail } from '@hakimi/shared';
import { z, type ZodIssue, type ZodType } from 'zod';
import { createValidationError } from './api-error.js';

const FIELD_LABELS: Record<string, string> = {
  body: 'Request body',
  code: 'Code',
  name: 'Name',
  facilityType: 'Facility type',
  licenseNumber: 'License number',
  phone: 'Phone',
  email: 'Email',
  region: 'Region',
  city: 'City',
  addressLine: 'Address line',
  isActive: 'Active status',
  id: 'Facility ID',
  page: 'Page',
  pageSize: 'Page size',
  search: 'Search',
  practitionerId: 'Practitioner ID',
  assignmentId: 'Assignment ID',
  firstName: 'First name',
  middleName: 'Middle name',
  lastName: 'Last name',
  profession: 'Profession',
  bio: 'Bio',
  roleTitle: 'Role title',
  department: 'Department',
  isPrimary: 'Primary assignment',
  facilityId: 'Facility ID',
};

function labelFor(path: ReadonlyArray<string | number | symbol>) {
  const key = path.length > 0 ? String(path[0]) : 'body';
  return FIELD_LABELS[key] ?? key;
}

function invalidTypeDetail(path: ReadonlyArray<string | number | symbol>) {
  const field = labelFor(path);

  return {
    field,
    message: `${field} is required`,
  };
}

function issueToDetails(issue: ZodIssue): ApiErrorDetail[] {
  const path = issue.path;

  switch (issue.code) {
    case 'invalid_type':
      return [invalidTypeDetail(path)];
    case 'unrecognized_keys': {
      const keys = Array.isArray(issue.keys) ? issue.keys : [];

      if (keys.length === 0) {
        return [
          {
            field: labelFor(path),
            message: 'Unknown property provided',
          },
        ];
      }

      return keys.map((key) => ({
        field: 'body',
        message: `Unknown property: ${key}`,
      }));
    }
    default:
      return [
        {
          field: labelFor(path),
          message: issue.message,
        },
      ];
  }
}

function collectDetails(issues: ZodIssue[]) {
  return issues.flatMap((issue) => issueToDetails(issue));
}

export function parseWithSchema<T>(schema: ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);

  if (result.success) {
    return result.data;
  }

  throw createValidationError(collectDetails(result.error.issues));
}

export function optionalNullableString(maxLength: number) {
  return z.preprocess((value) => {
    if (typeof value !== 'string') {
      return value;
    }

    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  }, z.string().max(maxLength).nullable().optional());
}

export function requiredTrimmedString(
  minimumLength: number,
  maximumLength: number,
  label: string,
) {
  return z
    .string()
    .trim()
    .min(minimumLength, `${label} must be at least ${minimumLength} characters`)
    .max(maximumLength, `${label} must be at most ${maximumLength} characters`);
}
