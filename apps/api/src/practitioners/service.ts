import type {
  CreatePractitionerAssignmentInput,
  CreatePractitionerInput,
  Practitioner,
  PractitionerAssignmentListResponse,
  PractitionerFacilityAssignment,
  PractitionerListQuery,
  PractitionerListResponse,
  UpdatePractitionerAssignmentInput,
  UpdatePractitionerInput,
} from '@hakimi/shared';
import {
  createAssignmentNotFoundError,
  createFacilityNotFoundError,
  createInactiveFacilityError,
  createInactivePractitionerError,
  createPractitionerNotFoundError,
} from '../http/api-error.js';
import type { PractitionerRepository } from './repository.js';

export type PractitionerService = {
  createPractitioner(input: CreatePractitionerInput): Promise<Practitioner>;
  listPractitioners(
    query: PractitionerListQuery,
  ): Promise<PractitionerListResponse>;
  getPractitionerById(id: string): Promise<Practitioner>;
  updatePractitioner(
    id: string,
    input: UpdatePractitionerInput,
  ): Promise<Practitioner>;
  deletePractitioner(id: string): Promise<void>;
  createAssignment(
    practitionerId: string,
    input: CreatePractitionerAssignmentInput,
  ): Promise<PractitionerFacilityAssignment>;
  listAssignments(
    practitionerId: string,
  ): Promise<PractitionerAssignmentListResponse>;
  updateAssignment(
    practitionerId: string,
    assignmentId: string,
    input: UpdatePractitionerAssignmentInput,
  ): Promise<PractitionerFacilityAssignment>;
  deleteAssignment(practitionerId: string, assignmentId: string): Promise<void>;
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
  input: CreatePractitionerInput,
): CreatePractitionerInput {
  return {
    code: normalizeText(input.code).toUpperCase(),
    firstName: normalizeText(input.firstName),
    middleName: normalizeNullableText(input.middleName),
    lastName: normalizeText(input.lastName),
    profession: normalizeText(input.profession),
    licenseNumber: normalizeText(input.licenseNumber),
    phone: normalizeNullableText(input.phone),
    email: normalizeNullableEmail(input.email),
    bio: normalizeNullableText(input.bio),
    isActive: input.isActive ?? true,
  };
}

function normalizeUpdateInput(
  input: UpdatePractitionerInput,
): UpdatePractitionerInput {
  const normalized: UpdatePractitionerInput = {};

  if (input.code !== undefined) {
    normalized.code = normalizeText(input.code).toUpperCase();
  }

  if (input.firstName !== undefined) {
    normalized.firstName = normalizeText(input.firstName);
  }

  if (input.middleName !== undefined) {
    normalized.middleName = normalizeNullableText(input.middleName);
  }

  if (input.lastName !== undefined) {
    normalized.lastName = normalizeText(input.lastName);
  }

  if (input.profession !== undefined) {
    normalized.profession = normalizeText(input.profession);
  }

  if (input.licenseNumber !== undefined) {
    normalized.licenseNumber = normalizeText(input.licenseNumber);
  }

  if (input.phone !== undefined) {
    normalized.phone = normalizeNullableText(input.phone);
  }

  if (input.email !== undefined) {
    normalized.email = normalizeNullableEmail(input.email);
  }

  if (input.bio !== undefined) {
    normalized.bio = normalizeNullableText(input.bio);
  }

  if (input.isActive !== undefined) {
    normalized.isActive = input.isActive;
  }

  return normalized;
}

function normalizeAssignmentCreateInput(
  input: CreatePractitionerAssignmentInput,
): CreatePractitionerAssignmentInput {
  return {
    facilityId: input.facilityId,
    roleTitle: normalizeText(input.roleTitle),
    department: normalizeNullableText(input.department),
    isPrimary: input.isPrimary ?? false,
    isActive: input.isActive ?? true,
  };
}

function normalizeAssignmentUpdateInput(
  input: UpdatePractitionerAssignmentInput,
): UpdatePractitionerAssignmentInput {
  const normalized: UpdatePractitionerAssignmentInput = {};

  if (input.roleTitle !== undefined) {
    normalized.roleTitle = normalizeText(input.roleTitle);
  }

  if (input.department !== undefined) {
    normalized.department = normalizeNullableText(input.department);
  }

  if (input.isPrimary !== undefined) {
    normalized.isPrimary = input.isPrimary;
  }

  if (input.isActive !== undefined) {
    normalized.isActive = input.isActive;
  }

  return normalized;
}

async function ensurePractitionerExists(
  repository: PractitionerRepository,
  id: string,
  db?: Parameters<PractitionerRepository['getPractitionerStatus']>[1],
) {
  const practitioner = await repository.getPractitionerStatus(id, db);

  if (!practitioner) {
    throw createPractitionerNotFoundError();
  }

  return practitioner;
}

async function ensureFacilityExists(
  repository: PractitionerRepository,
  id: string,
  db?: Parameters<PractitionerRepository['getFacilityStatus']>[1],
) {
  const facility = await repository.getFacilityStatus(id, db);

  if (!facility) {
    throw createFacilityNotFoundError();
  }

  return facility;
}

function requiresActiveParticipants(
  input: Pick<
    CreatePractitionerAssignmentInput | UpdatePractitionerAssignmentInput,
    'isActive' | 'isPrimary'
  >,
) {
  const isActive = input.isActive ?? true;
  const isPrimary = input.isPrimary ?? false;

  return isActive || isPrimary;
}

export function createPractitionerService(
  repository: PractitionerRepository,
): PractitionerService {
  return {
    async createPractitioner(input) {
      return repository.createPractitioner(normalizeCreateInput(input));
    },

    async listPractitioners(query) {
      return repository.listPractitioners(query);
    },

    async getPractitionerById(id) {
      const practitioner = await repository.findPractitionerById(id);

      if (!practitioner) {
        throw createPractitionerNotFoundError();
      }

      return practitioner;
    },

    async updatePractitioner(id, input) {
      const practitioner = await repository.updatePractitioner(
        id,
        normalizeUpdateInput(input),
      );

      if (!practitioner) {
        throw createPractitionerNotFoundError();
      }

      return practitioner;
    },

    async deletePractitioner(id) {
      const deleted = await repository.deletePractitioner(id);

      if (!deleted) {
        throw createPractitionerNotFoundError();
      }
    },

    async createAssignment(practitionerId, input) {
      const normalized = normalizeAssignmentCreateInput(input);

      return repository.withTransaction(async (tx) => {
        await repository.lockPractitionerAssignments(practitionerId, tx);

        const practitioner = await ensurePractitionerExists(
          repository,
          practitionerId,
          tx,
        );

        if (requiresActiveParticipants(normalized) && !practitioner.is_active) {
          throw createInactivePractitionerError();
        }

        const facility = await ensureFacilityExists(
          repository,
          normalized.facilityId,
          tx,
        );

        if (requiresActiveParticipants(normalized) && !facility.is_active) {
          throw createInactiveFacilityError();
        }

        if (normalized.isPrimary && normalized.isActive) {
          await repository.clearPrimaryAssignments(practitionerId, tx);
        }

        return repository.createAssignment(practitionerId, normalized, tx);
      });
    },

    async listAssignments(practitionerId) {
      await ensurePractitionerExists(repository, practitionerId);
      return repository.listAssignments(practitionerId);
    },

    async updateAssignment(practitionerId, assignmentId, input) {
      const normalized = normalizeAssignmentUpdateInput(input);

      return repository.withTransaction(async (tx) => {
        await repository.lockPractitionerAssignments(practitionerId, tx);

        const practitioner = await ensurePractitionerExists(
          repository,
          practitionerId,
          tx,
        );
        const existingAssignment = await repository.findAssignmentById(
          practitionerId,
          assignmentId,
          tx,
        );

        if (!existingAssignment) {
          throw createAssignmentNotFoundError();
        }

        const resultingIsActive =
          normalized.isActive ?? existingAssignment.isActive;
        const requestedIsPrimary =
          normalized.isPrimary ?? existingAssignment.isPrimary;
        const resultingIsPrimary = resultingIsActive
          ? requestedIsPrimary
          : false;

        if (
          requiresActiveParticipants({
            isActive: resultingIsActive,
            isPrimary: resultingIsPrimary,
          })
        ) {
          if (!practitioner.is_active) {
            throw createInactivePractitionerError();
          }

          const facility = await ensureFacilityExists(
            repository,
            existingAssignment.facilityId,
            tx,
          );

          if (!facility.is_active) {
            throw createInactiveFacilityError();
          }
        }

        if (resultingIsPrimary) {
          await repository.clearPrimaryAssignments(
            practitionerId,
            tx,
            assignmentId,
          );
        }

        const updateInput: UpdatePractitionerAssignmentInput = {
          ...normalized,
          isPrimary: resultingIsPrimary,
          isActive: resultingIsActive,
        };

        const assignment = await repository.updateAssignment(
          practitionerId,
          assignmentId,
          updateInput,
          tx,
        );

        if (!assignment) {
          throw createAssignmentNotFoundError();
        }

        return assignment;
      });
    },

    async deleteAssignment(practitionerId, assignmentId) {
      await ensurePractitionerExists(repository, practitionerId);
      const deleted = await repository.deleteAssignment(
        practitionerId,
        assignmentId,
      );

      if (!deleted) {
        throw createAssignmentNotFoundError();
      }
    },
  };
}
