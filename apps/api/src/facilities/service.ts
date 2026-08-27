import type {
  CreateHealthcareFacilityInput,
  HealthcareFacility,
  HealthcareFacilityListQuery,
  HealthcareFacilityListResponse,
  UpdateHealthcareFacilityInput,
} from '@hakimi/shared';
import type { DomainAuthorizationScope } from '../access/types.js';
import { createNotFoundError } from '../http/api-error.js';
import type { HealthcareFacilityRepository } from './repository.js';

export type HealthcareFacilityService = {
  createFacility(
    input: CreateHealthcareFacilityInput,
  ): Promise<HealthcareFacility>;
  listFacilities(
    query: HealthcareFacilityListQuery,
    scope?: DomainAuthorizationScope,
  ): Promise<HealthcareFacilityListResponse>;
  getFacilityById(id: string): Promise<HealthcareFacility>;
  updateFacility(
    id: string,
    input: UpdateHealthcareFacilityInput,
  ): Promise<HealthcareFacility>;
  deleteFacility(id: string): Promise<void>;
};

function normalizeText(value: string) {
  return value.trim();
}

function normalizeNullableText(value: string | null | undefined) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const normalized = value.trim();
  return normalized === '' ? null : normalized;
}

function normalizeNullableEmail(value: string | null | undefined) {
  const normalized = normalizeNullableText(value);

  return typeof normalized === 'string' ? normalized.toLowerCase() : normalized;
}

function normalizeCreateInput(
  input: CreateHealthcareFacilityInput,
): CreateHealthcareFacilityInput {
  return {
    code: normalizeText(input.code).toUpperCase(),
    name: normalizeText(input.name),
    facilityType: input.facilityType,
    licenseNumber: normalizeNullableText(input.licenseNumber),
    phone: normalizeNullableText(input.phone),
    email: normalizeNullableEmail(input.email),
    region: normalizeText(input.region),
    city: normalizeText(input.city),
    addressLine: normalizeNullableText(input.addressLine),
    isActive: input.isActive ?? true,
  };
}

function normalizeUpdateInput(
  input: UpdateHealthcareFacilityInput,
): UpdateHealthcareFacilityInput {
  const normalized: UpdateHealthcareFacilityInput = {};

  if (input.code !== undefined) {
    normalized.code = normalizeText(input.code).toUpperCase();
  }

  if (input.name !== undefined) {
    normalized.name = normalizeText(input.name);
  }

  if (input.facilityType !== undefined) {
    normalized.facilityType = input.facilityType;
  }

  if (input.licenseNumber !== undefined) {
    normalized.licenseNumber = normalizeNullableText(input.licenseNumber);
  }

  if (input.phone !== undefined) {
    normalized.phone = normalizeNullableText(input.phone);
  }

  if (input.email !== undefined) {
    normalized.email = normalizeNullableEmail(input.email);
  }

  if (input.region !== undefined) {
    normalized.region = normalizeText(input.region);
  }

  if (input.city !== undefined) {
    normalized.city = normalizeText(input.city);
  }

  if (input.addressLine !== undefined) {
    normalized.addressLine = normalizeNullableText(input.addressLine);
  }

  if (input.isActive !== undefined) {
    normalized.isActive = input.isActive;
  }

  return normalized;
}

export function createHealthcareFacilityService(
  repository: HealthcareFacilityRepository,
): HealthcareFacilityService {
  return {
    async createFacility(input) {
      return repository.create(normalizeCreateInput(input));
    },
    async listFacilities(query, scope) {
      return repository.list(query, scope);
    },
    async getFacilityById(id) {
      const facility = await repository.findById(id);

      if (!facility) {
        throw createNotFoundError();
      }

      return facility;
    },
    async updateFacility(id, input) {
      const facility = await repository.update(id, normalizeUpdateInput(input));

      if (!facility) {
        throw createNotFoundError();
      }

      return facility;
    },
    async deleteFacility(id) {
      const deleted = await repository.deactivate(id);

      if (!deleted) {
        throw createNotFoundError();
      }
    },
  };
}
