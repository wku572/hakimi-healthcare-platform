import type {
  CreatePatientInput,
  PatientFacilityRegistration,
  PatientFacilityRegistrationFacilitySummary,
  PatientListQuery,
  PatientPagination,
  UpdatePatientInput,
} from '@hakimi/shared';
import type { Pool } from 'pg';
import { isFacilityType } from '@hakimi/shared';
import {
  createInternalError,
  createPatientRegistrationConflictError,
} from '../http/api-error.js';

type DbExecutor = {
  query<T extends Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<{
    rows: T[];
  }>;
};

export type PatientRow = {
  id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string | null;
  date_of_birth: string | null;
  administrative_sex: string;
  phone: string | null;
  email: string | null;
  address_line: string | null;
  city: string | null;
  region: string | null;
  is_active: boolean;
  created_at: Date | string;
  updated_at: Date | string;
};

type FacilityStatusRow = {
  id: string;
  is_active: boolean;
};

type PatientRegistrationRow = {
  id: string;
  patient_id: string;
  facility_id: string;
  medical_record_number: string;
  created_at: Date | string;
  updated_at: Date | string;
  facility_summary_id: string;
  facility_code: string;
  facility_name: string;
  facility_type: string;
  facility_region: string;
  facility_city: string;
  facility_is_active: boolean;
};

type PatientSearchResult = {
  rows: PatientRow[];
  pagination: PatientPagination;
};

const PATIENT_SELECT_COLUMNS = `
  id,
  first_name,
  middle_name,
  last_name,
  date_of_birth,
  administrative_sex,
  phone,
  email,
  address_line,
  city,
  region,
  is_active,
  created_at,
  updated_at
`;

const REGISTRATION_SELECT_COLUMNS = `
  r.id,
  r.patient_id,
  r.facility_id,
  r.medical_record_number,
  r.created_at,
  r.updated_at,
  f.id AS facility_summary_id,
  f.code AS facility_code,
  f.name AS facility_name,
  f.facility_type AS facility_type,
  f.region AS facility_region,
  f.city AS facility_city,
  f.is_active AS facility_is_active
`;

const PATIENT_MUTABLE_COLUMN_MAP = {
  firstName: 'first_name',
  middleName: 'middle_name',
  lastName: 'last_name',
  dateOfBirth: 'date_of_birth',
  administrativeSex: 'administrative_sex',
  phone: 'phone',
  email: 'email',
  addressLine: 'address_line',
  city: 'city',
  region: 'region',
  isActive: 'is_active',
} as const;

function toIsoString(value: Date | string) {
  return new Date(value).toISOString();
}

function mapFacilitySummary(
  row: PatientRegistrationRow,
): PatientFacilityRegistrationFacilitySummary {
  if (!isFacilityType(row.facility_type)) {
    throw createInternalError();
  }

  return {
    id: row.facility_summary_id,
    code: row.facility_code,
    name: row.facility_name,
    facilityType: row.facility_type,
    region: row.facility_region,
    city: row.facility_city,
    isActive: row.facility_is_active,
  };
}

function mapRegistrationRow(
  row: PatientRegistrationRow,
): PatientFacilityRegistration {
  return {
    id: row.id,
    patientId: row.patient_id,
    facilityId: row.facility_id,
    medicalRecordNumber: row.medical_record_number,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
    facility: mapFacilitySummary(row),
  };
}

function normalizePatientSearchPattern(value: string) {
  return value.replace(/[\\%_]/g, '\\$&');
}

function buildPatientFilterSql(query: PatientListQuery) {
  const clauses: string[] = [];
  const values: unknown[] = [];
  const registrationExactClauses: string[] = [];

  if (query.isActive !== undefined) {
    values.push(query.isActive);
    clauses.push(`is_active = $${values.length}`);
  }

  if (query.administrativeSex) {
    values.push(query.administrativeSex);
    clauses.push(`administrative_sex = $${values.length}`);
  }

  let facilityIdParameter: string | null = null;

  if (query.facilityId) {
    values.push(query.facilityId);
    facilityIdParameter = `$${values.length}`;
    registrationExactClauses.push(
      `registrations.facility_id = ${facilityIdParameter}`,
    );
  }

  if (query.medicalRecordNumber) {
    values.push(query.medicalRecordNumber);
    registrationExactClauses.push(
      `registrations.medical_record_number = $${values.length}`,
    );
  }

  if (registrationExactClauses.length > 0) {
    clauses.push(
      `EXISTS (
        SELECT 1
        FROM patient_facility_registrations registrations
        WHERE registrations.patient_id = patients.id
          AND ${registrationExactClauses.join(' AND ')}
      )`,
    );
  }

  if (query.search) {
    const searchPattern = `%${normalizePatientSearchPattern(query.search)}%`;
    values.push(searchPattern);
    const searchParameter = `$${values.length}`;
    const registrationSearchClauses = [
      `registrations.medical_record_number ILIKE ${searchParameter} ESCAPE '\\'`,
    ];

    if (facilityIdParameter) {
      registrationSearchClauses.unshift(
        `registrations.facility_id = ${facilityIdParameter}`,
      );
    }

    clauses.push(
      `(
        first_name ILIKE ${searchParameter} ESCAPE '\\'
        OR COALESCE(middle_name, '') ILIKE ${searchParameter} ESCAPE '\\'
        OR COALESCE(last_name, '') ILIKE ${searchParameter} ESCAPE '\\'
        OR COALESCE(phone, '') ILIKE ${searchParameter} ESCAPE '\\'
        OR COALESCE(email, '') ILIKE ${searchParameter} ESCAPE '\\'
        OR EXISTS (
          SELECT 1
          FROM patient_facility_registrations registrations
          WHERE registrations.patient_id = patients.id
            AND ${registrationSearchClauses.join(' AND ')}
        )
      )`,
    );
  }

  return {
    whereSql: clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '',
    values,
  };
}

async function loadRegistrationsForPatientIds(
  db: DbExecutor,
  patientIds: string[],
): Promise<Map<string, PatientFacilityRegistration[]>> {
  if (patientIds.length === 0) {
    return new Map();
  }

  const result = await db.query<PatientRegistrationRow>(
    `
      SELECT ${REGISTRATION_SELECT_COLUMNS}
      FROM patient_facility_registrations r
      JOIN healthcare_facilities f ON f.id = r.facility_id
      WHERE r.patient_id = ANY($1::uuid[])
      ORDER BY r.patient_id ASC, r.created_at ASC, r.id ASC
    `,
    [patientIds],
  );

  const registrationsByPatientId = new Map<
    string,
    PatientFacilityRegistration[]
  >();

  for (const row of result.rows) {
    const registration = mapRegistrationRow(row);
    const registrations = registrationsByPatientId.get(registration.patientId);

    if (registrations) {
      registrations.push(registration);
    } else {
      registrationsByPatientId.set(registration.patientId, [registration]);
    }
  }

  return registrationsByPatientId;
}

export type CreatePatientRegistrationInput = {
  patientId: string;
  facilityId: string;
  medicalRecordNumber: string;
};

export type PatientRepository = {
  withTransaction<T>(work: (db: DbExecutor) => Promise<T>): Promise<T>;
  createPatient(
    input: CreatePatientInput,
    db?: DbExecutor,
  ): Promise<PatientRow>;
  updatePatient(
    id: string,
    input: UpdatePatientInput,
    db?: DbExecutor,
  ): Promise<PatientRow | null>;
  deletePatient(id: string, db?: DbExecutor): Promise<boolean>;
  findPatientById(id: string, db?: DbExecutor): Promise<PatientRow | null>;
  listPatients(
    query: PatientListQuery,
    db?: DbExecutor,
  ): Promise<PatientSearchResult>;
  findRegistrationsByPatientId(
    patientId: string,
    db?: DbExecutor,
  ): Promise<PatientFacilityRegistration[]>;
  findRegistrationsByPatientIds(
    patientIds: string[],
    db?: DbExecutor,
  ): Promise<Map<string, PatientFacilityRegistration[]>>;
  createPatientRegistration(
    input: CreatePatientRegistrationInput,
    db?: DbExecutor,
  ): Promise<PatientFacilityRegistration>;
  getFacilityStatus(
    id: string,
    db?: DbExecutor,
  ): Promise<FacilityStatusRow | null>;
};

export function createPatientRepository(
  db: Pick<Pool, 'query' | 'connect'>,
): PatientRepository {
  return {
    async withTransaction(work) {
      const client = await db.connect();

      try {
        await client.query('BEGIN');
        const result = await work(client);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        try {
          await client.query('ROLLBACK');
        } catch {
          // Ignore rollback failures and surface the original error.
        }

        throw error;
      } finally {
        client.release();
      }
    },

    async createPatient(input, executor = db) {
      const result = await executor.query<PatientRow>(
        `
          INSERT INTO patients (
            first_name,
            middle_name,
            last_name,
            date_of_birth,
            administrative_sex,
            phone,
            email,
            address_line,
            city,
            region,
            is_active
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)
          RETURNING ${PATIENT_SELECT_COLUMNS}
        `,
        [
          input.firstName,
          input.middleName ?? null,
          input.lastName ?? null,
          input.dateOfBirth ?? null,
          input.administrativeSex,
          input.phone ?? null,
          input.email ?? null,
          input.addressLine ?? null,
          input.city ?? null,
          input.region ?? null,
        ],
      );

      const row = result.rows[0];

      if (!row) {
        throw createInternalError();
      }

      return row;
    },

    async updatePatient(id, input, executor = db) {
      const entries = Object.entries(input).filter(
        ([, value]) => value !== undefined,
      ) as Array<
        [
          keyof UpdatePatientInput,
          Exclude<UpdatePatientInput[keyof UpdatePatientInput], undefined>,
        ]
      >;

      if (entries.length === 0) {
        return null;
      }

      const values = entries.map(([, value]) => value);
      const setSql = entries
        .map(
          ([key], index) =>
            `${PATIENT_MUTABLE_COLUMN_MAP[key]} = $${index + 1}`,
        )
        .join(', ');
      values.push(id);

      const result = await executor.query<PatientRow>(
        `
          UPDATE patients
          SET ${setSql}, updated_at = now()
          WHERE id = $${values.length}
          RETURNING ${PATIENT_SELECT_COLUMNS}
        `,
        values,
      );

      return result.rows[0] ?? null;
    },

    async deletePatient(id, executor = db) {
      const result = await executor.query<{ id: string }>(
        `
          UPDATE patients
          SET is_active = false,
              updated_at = now()
          WHERE id = $1
          RETURNING id
        `,
        [id],
      );

      return result.rows.length > 0;
    },

    async findPatientById(id, executor = db) {
      const result = await executor.query<PatientRow>(
        `
          SELECT ${PATIENT_SELECT_COLUMNS}
          FROM patients
          WHERE id = $1
        `,
        [id],
      );

      return result.rows[0] ?? null;
    },

    async listPatients(query, executor = db) {
      const { whereSql, values } = buildPatientFilterSql(query);
      const countResult = await executor.query<{ total_items: number }>(
        `
          SELECT COUNT(*)::int AS total_items
          FROM patients
          ${whereSql}
        `,
        values,
      );

      const totalItems = countResult.rows[0]?.total_items ?? 0;
      const offset = (query.page - 1) * query.pageSize;

      const dataResult = await executor.query<PatientRow>(
        `
          SELECT ${PATIENT_SELECT_COLUMNS}
          FROM patients
          ${whereSql}
          ORDER BY last_name ASC NULLS LAST, first_name ASC, id ASC
          LIMIT $${values.length + 1}
          OFFSET $${values.length + 2}
        `,
        [...values, query.pageSize, offset],
      );

      const totalPages =
        totalItems === 0 ? 0 : Math.ceil(totalItems / query.pageSize);

      return {
        rows: dataResult.rows,
        pagination: {
          page: query.page,
          pageSize: query.pageSize,
          totalItems,
          totalPages,
        },
      };
    },

    async findRegistrationsByPatientId(patientId, executor = db) {
      const result = await executor.query<PatientRegistrationRow>(
        `
          SELECT ${REGISTRATION_SELECT_COLUMNS}
          FROM patient_facility_registrations r
          JOIN healthcare_facilities f ON f.id = r.facility_id
          WHERE r.patient_id = $1
          ORDER BY r.created_at ASC, r.id ASC
        `,
        [patientId],
      );

      return result.rows.map(mapRegistrationRow);
    },

    async findRegistrationsByPatientIds(patientIds, executor = db) {
      return loadRegistrationsForPatientIds(executor, patientIds);
    },

    async createPatientRegistration(input, executor = db) {
      try {
        const result = await executor.query<PatientRegistrationRow>(
          `
            INSERT INTO patient_facility_registrations (
              patient_id,
              facility_id,
              medical_record_number
            )
            VALUES ($1, $2, $3)
            RETURNING id
          `,
          [input.patientId, input.facilityId, input.medicalRecordNumber],
        );

        const registrationId = result.rows[0]?.id;

        if (!registrationId) {
          throw createInternalError();
        }

        const registrations = await executor.query<PatientRegistrationRow>(
          `
            SELECT ${REGISTRATION_SELECT_COLUMNS}
            FROM patient_facility_registrations r
            JOIN healthcare_facilities f ON f.id = r.facility_id
            WHERE r.id = $1
          `,
          [registrationId],
        );

        const row = registrations.rows[0];

        if (!row) {
          throw createInternalError();
        }

        return mapRegistrationRow(row);
      } catch (error) {
        if (
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          (error as { code?: string }).code === '23505'
        ) {
          const constraint = (error as { constraint?: string }).constraint;

          if (
            constraint === 'patient_facility_registrations_facility_mrn_key'
          ) {
            throw createPatientRegistrationConflictError();
          }
        }

        throw error;
      }
    },

    async getFacilityStatus(id, executor = db) {
      const result = await executor.query<FacilityStatusRow>(
        `
          SELECT id, is_active
          FROM healthcare_facilities
          WHERE id = $1
        `,
        [id],
      );

      return result.rows[0] ?? null;
    },
  };
}
