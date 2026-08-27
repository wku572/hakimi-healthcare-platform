import type {
  CreatePatientInput,
  Patient,
  PatientFacilityRegistration,
  PatientListQuery,
  PatientListResponse,
  UpdatePatientInput,
} from '@hakimi/shared';
import type { DomainAuthorizationScope } from '../access/types.js';
import {
  createFacilityInactiveError,
  createFacilityNotFoundError,
  createPatientNotFoundError,
} from '../http/api-error.js';
import type { PatientRepository, PatientRow } from './repository.js';

export type PatientService = {
  createPatient(input: CreatePatientInput): Promise<Patient>;
  listPatients(
    query: PatientListQuery,
    scope?: DomainAuthorizationScope,
  ): Promise<PatientListResponse>;
  getPatientById(
    id: string,
    scope?: DomainAuthorizationScope,
  ): Promise<Patient>;
  updatePatient(
    id: string,
    input: UpdatePatientInput,
    scope?: DomainAuthorizationScope,
  ): Promise<Patient>;
  deletePatient(id: string): Promise<void>;
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

function normalizeAdministrativeSex(value: string) {
  return value.trim().toLowerCase() as CreatePatientInput['administrativeSex'];
}

function normalizeCreateInput(input: CreatePatientInput): CreatePatientInput {
  return {
    facilityId: input.facilityId,
    medicalRecordNumber: normalizeText(input.medicalRecordNumber),
    firstName: normalizeText(input.firstName),
    middleName: normalizeNullableText(input.middleName),
    lastName: normalizeNullableText(input.lastName),
    dateOfBirth: input.dateOfBirth ?? undefined,
    administrativeSex: normalizeAdministrativeSex(input.administrativeSex),
    phone: normalizeNullableText(input.phone),
    email: normalizeNullableEmail(input.email),
    addressLine: normalizeNullableText(input.addressLine),
    city: normalizeNullableText(input.city),
    region: normalizeNullableText(input.region),
  };
}

function normalizeUpdateInput(input: UpdatePatientInput): UpdatePatientInput {
  const normalized: UpdatePatientInput = {};

  if (input.firstName !== undefined) {
    normalized.firstName = normalizeText(input.firstName);
  }

  if (input.middleName !== undefined) {
    normalized.middleName = normalizeNullableText(input.middleName);
  }

  if (input.lastName !== undefined) {
    normalized.lastName = normalizeNullableText(input.lastName);
  }

  if (input.dateOfBirth !== undefined) {
    normalized.dateOfBirth = input.dateOfBirth;
  }

  if (input.administrativeSex !== undefined) {
    normalized.administrativeSex = normalizeAdministrativeSex(
      input.administrativeSex,
    );
  }

  if (input.phone !== undefined) {
    normalized.phone = normalizeNullableText(input.phone);
  }

  if (input.email !== undefined) {
    normalized.email = normalizeNullableEmail(input.email);
  }

  if (input.addressLine !== undefined) {
    normalized.addressLine = normalizeNullableText(input.addressLine);
  }

  if (input.city !== undefined) {
    normalized.city = normalizeNullableText(input.city);
  }

  if (input.region !== undefined) {
    normalized.region = normalizeNullableText(input.region);
  }

  if (input.isActive !== undefined) {
    normalized.isActive = input.isActive;
  }

  return normalized;
}

function mapPatient(
  patient: PatientRow,
  registrations: PatientFacilityRegistration[],
): Patient {
  return {
    id: patient.id,
    firstName: patient.first_name,
    middleName: patient.middle_name,
    lastName: patient.last_name,
    dateOfBirth: patient.date_of_birth,
    administrativeSex:
      patient.administrative_sex as Patient['administrativeSex'],
    phone: patient.phone,
    email: patient.email,
    addressLine: patient.address_line,
    city: patient.city,
    region: patient.region,
    isActive: patient.is_active,
    createdAt: new Date(patient.created_at).toISOString(),
    updatedAt: new Date(patient.updated_at).toISOString(),
    registrations,
  };
}

async function hydratePatient(
  repository: PatientRepository,
  patient: PatientRow,
  db?: Parameters<PatientRepository['findRegistrationsByPatientId']>[1],
  scope?: DomainAuthorizationScope,
) {
  const registrations = await repository.findRegistrationsByPatientId(
    patient.id,
    db,
    scope,
  );

  return mapPatient(patient, registrations);
}

async function hydratePatients(
  repository: PatientRepository,
  patients: PatientRow[],
  db?: Parameters<PatientRepository['findRegistrationsByPatientIds']>[1],
  scope?: DomainAuthorizationScope,
): Promise<Patient[]> {
  const registrationsByPatientId =
    await repository.findRegistrationsByPatientIds(
      patients.map((patient) => patient.id),
      db,
      scope,
    );

  return patients.map((patient) =>
    mapPatient(patient, registrationsByPatientId.get(patient.id) ?? []),
  );
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

export function createPatientService(
  repository: PatientRepository,
): PatientService {
  return {
    async createPatient(input) {
      const normalized = normalizeCreateInput(input);

      return repository.withTransaction(async (tx) => {
        const facility = await repository.getFacilityStatus(
          normalized.facilityId,
          tx,
        );

        ensureFacilityStatus(facility);

        const patient = await repository.createPatient(normalized, tx);
        await repository.createPatientRegistration(
          {
            patientId: patient.id,
            facilityId: normalized.facilityId,
            medicalRecordNumber: normalized.medicalRecordNumber,
          },
          tx,
        );

        return hydratePatient(repository, patient, tx);
      });
    },

    async listPatients(query, scope) {
      const result = await repository.listPatients(query, scope);
      const data = await hydratePatients(
        repository,
        result.rows,
        undefined,
        scope,
      );

      return {
        data,
        pagination: result.pagination,
      };
    },

    async getPatientById(id, scope) {
      const patient = await repository.findPatientById(id);

      if (!patient) {
        throw createPatientNotFoundError();
      }

      return hydratePatient(repository, patient, undefined, scope);
    },

    async updatePatient(id, input, scope) {
      const normalized = normalizeUpdateInput(input);
      const patient = await repository.updatePatient(id, normalized);

      if (!patient) {
        throw createPatientNotFoundError();
      }

      return hydratePatient(repository, patient, undefined, scope);
    },

    async deletePatient(id) {
      const deleted = await repository.deletePatient(id);

      if (!deleted) {
        throw createPatientNotFoundError();
      }
    },
  };
}
