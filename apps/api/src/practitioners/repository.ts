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
  PractitionerAssignmentFacilitySummary,
} from '@hakimi/shared';
import type { Pool } from 'pg';
import {
  createAssignmentConflictError,
  createFacilityNotFoundError,
  createInternalError,
  createPractitionerCodeConflictError,
  createPractitionerLicenseConflictError,
  createPractitionerNotFoundError,
} from '../http/api-error.js';

type DbExecutor = {
  query<T extends Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<{
    rows: T[];
  }>;
};

type PractitionerRow = {
  id: string;
  code: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  profession: string;
  license_number: string;
  phone: string | null;
  email: string | null;
  bio: string | null;
  is_active: boolean;
  created_at: Date | string;
  updated_at: Date | string;
};

type PractitionerStatusRow = {
  id: string;
  is_active: boolean;
};

type FacilityStatusRow = {
  id: string;
  is_active: boolean;
};

type AssignmentRow = {
  id: string;
  practitioner_id: string;
  facility_id: string;
  role_title: string;
  department: string | null;
  is_primary: boolean;
  is_active: boolean;
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

const PRACTITIONER_SELECT_COLUMNS = `
  id,
  code,
  first_name,
  middle_name,
  last_name,
  profession,
  license_number,
  phone,
  email,
  bio,
  is_active,
  created_at,
  updated_at
`;

const ASSIGNMENT_SELECT_COLUMNS = `
  a.id,
  a.practitioner_id,
  a.facility_id,
  a.role_title,
  a.department,
  a.is_primary,
  a.is_active,
  a.created_at,
  a.updated_at,
  f.id AS facility_summary_id,
  f.code AS facility_code,
  f.name AS facility_name,
  f.facility_type AS facility_type,
  f.region AS facility_region,
  f.city AS facility_city,
  f.is_active AS facility_is_active
`;

const PRACTITIONER_MUTABLE_COLUMN_MAP = {
  code: 'code',
  firstName: 'first_name',
  middleName: 'middle_name',
  lastName: 'last_name',
  profession: 'profession',
  licenseNumber: 'license_number',
  phone: 'phone',
  email: 'email',
  bio: 'bio',
  isActive: 'is_active',
} as const;

const ASSIGNMENT_MUTABLE_COLUMN_MAP = {
  roleTitle: 'role_title',
  department: 'department',
  isPrimary: 'is_primary',
  isActive: 'is_active',
} as const;

function toIsoString(value: Date | string) {
  return new Date(value).toISOString();
}

function mapPractitionerRow(row: PractitionerRow): Practitioner {
  return {
    id: row.id,
    code: row.code,
    firstName: row.first_name,
    middleName: row.middle_name,
    lastName: row.last_name,
    profession: row.profession,
    licenseNumber: row.license_number,
    phone: row.phone,
    email: row.email,
    bio: row.bio,
    isActive: row.is_active,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

function mapFacilitySummary(
  row: AssignmentRow,
): PractitionerAssignmentFacilitySummary {
  return {
    id: row.facility_summary_id,
    code: row.facility_code,
    name: row.facility_name,
    facilityType:
      row.facility_type as PractitionerAssignmentFacilitySummary['facilityType'],
    region: row.facility_region,
    city: row.facility_city,
    isActive: row.facility_is_active,
  };
}

function mapAssignmentRow(row: AssignmentRow): PractitionerFacilityAssignment {
  return {
    id: row.id,
    practitionerId: row.practitioner_id,
    facilityId: row.facility_id,
    roleTitle: row.role_title,
    department: row.department,
    isPrimary: row.is_primary,
    isActive: row.is_active,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
    facility: mapFacilitySummary(row),
  };
}

function translateUniqueViolation(error: unknown): never {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === '23505'
  ) {
    const constraint = (error as { constraint?: string }).constraint;

    if (constraint === 'practitioners_code_key') {
      throw createPractitionerCodeConflictError();
    }

    if (constraint === 'practitioners_license_number_key') {
      throw createPractitionerLicenseConflictError();
    }

    if (
      constraint ===
      'practitioner_facility_assignments_practitioner_facility_key'
    ) {
      throw createAssignmentConflictError();
    }

    if (
      constraint ===
      'practitioner_facility_assignments_active_primary_unique_idx'
    ) {
      throw createAssignmentConflictError(
        'An active primary assignment already exists',
      );
    }
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === '23503'
  ) {
    const constraint = (error as { constraint?: string }).constraint;

    if (
      constraint === 'practitioner_facility_assignments_practitioner_id_fkey'
    ) {
      throw createPractitionerNotFoundError();
    }

    if (constraint === 'practitioner_facility_assignments_facility_id_fkey') {
      throw createFacilityNotFoundError();
    }
  }

  throw error;
}

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, '\\$&');
}

function buildPractitionerFilterSql(query: PractitionerListQuery) {
  const clauses: string[] = [];
  const values: unknown[] = [];

  if (query.profession) {
    values.push(query.profession);
    clauses.push(`profession = $${values.length}`);
  }

  if (query.isActive !== undefined) {
    values.push(query.isActive);
    clauses.push(`is_active = $${values.length}`);
  }

  if (query.facilityId) {
    values.push(query.facilityId);
    const parameter = `$${values.length}`;
    clauses.push(
      `EXISTS (
        SELECT 1
        FROM practitioner_facility_assignments assignments
        WHERE assignments.practitioner_id = practitioners.id
          AND assignments.facility_id = ${parameter}
          AND assignments.is_active = true
      )`,
    );
  }

  if (query.search) {
    const searchPattern = `%${escapeLikePattern(query.search)}%`;
    values.push(searchPattern);
    const parameter = `$${values.length}`;
    clauses.push(
      `(
        code ILIKE ${parameter} ESCAPE '\\'
        OR first_name ILIKE ${parameter} ESCAPE '\\'
        OR COALESCE(middle_name, '') ILIKE ${parameter} ESCAPE '\\'
        OR last_name ILIKE ${parameter} ESCAPE '\\'
        OR profession ILIKE ${parameter} ESCAPE '\\'
        OR license_number ILIKE ${parameter} ESCAPE '\\'
      )`,
    );
  }

  return {
    whereSql: clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '',
    values,
  };
}

async function queryPractitionerById(
  db: DbExecutor,
  id: string,
): Promise<Practitioner | null> {
  const result = await db.query<PractitionerRow>(
    `
      SELECT ${PRACTITIONER_SELECT_COLUMNS}
      FROM practitioners
      WHERE id = $1
    `,
    [id],
  );

  const row = result.rows[0];
  return row ? mapPractitionerRow(row) : null;
}

async function queryPractitionerStatus(
  db: DbExecutor,
  id: string,
): Promise<PractitionerStatusRow | null> {
  const result = await db.query<PractitionerStatusRow>(
    `
      SELECT id, is_active
      FROM practitioners
      WHERE id = $1
    `,
    [id],
  );

  return result.rows[0] ?? null;
}

async function queryFacilityStatus(
  db: DbExecutor,
  id: string,
): Promise<FacilityStatusRow | null> {
  const result = await db.query<FacilityStatusRow>(
    `
      SELECT id, is_active
      FROM healthcare_facilities
      WHERE id = $1
    `,
    [id],
  );

  return result.rows[0] ?? null;
}

async function queryAssignmentById(
  db: DbExecutor,
  practitionerId: string,
  assignmentId: string,
): Promise<PractitionerFacilityAssignment | null> {
  const result = await db.query<AssignmentRow>(
    `
      SELECT ${ASSIGNMENT_SELECT_COLUMNS}
      FROM practitioner_facility_assignments a
      JOIN healthcare_facilities f ON f.id = a.facility_id
      WHERE a.practitioner_id = $1
        AND a.id = $2
    `,
    [practitionerId, assignmentId],
  );

  const row = result.rows[0];
  return row ? mapAssignmentRow(row) : null;
}

export type PractitionerRepository = {
  createPractitioner(input: CreatePractitionerInput): Promise<Practitioner>;
  listPractitioners(
    query: PractitionerListQuery,
  ): Promise<PractitionerListResponse>;
  findPractitionerById(id: string): Promise<Practitioner | null>;
  updatePractitioner(
    id: string,
    input: UpdatePractitionerInput,
  ): Promise<Practitioner | null>;
  deletePractitioner(id: string): Promise<boolean>;
  withTransaction<T>(work: (db: DbExecutor) => Promise<T>): Promise<T>;
  createAssignment(
    practitionerId: string,
    input: CreatePractitionerAssignmentInput,
    db?: DbExecutor,
  ): Promise<PractitionerFacilityAssignment>;
  listAssignments(
    practitionerId: string,
    db?: DbExecutor,
  ): Promise<PractitionerAssignmentListResponse>;
  findAssignmentById(
    practitionerId: string,
    assignmentId: string,
    db?: DbExecutor,
  ): Promise<PractitionerFacilityAssignment | null>;
  updateAssignment(
    practitionerId: string,
    assignmentId: string,
    input: UpdatePractitionerAssignmentInput,
    db?: DbExecutor,
  ): Promise<PractitionerFacilityAssignment | null>;
  deleteAssignment(
    practitionerId: string,
    assignmentId: string,
    db?: DbExecutor,
  ): Promise<boolean>;
  lockPractitionerAssignments(
    practitionerId: string,
    db: DbExecutor,
  ): Promise<void>;
  clearPrimaryAssignments(
    practitionerId: string,
    db: DbExecutor,
    excludeAssignmentId?: string,
  ): Promise<void>;
  getPractitionerStatus(
    id: string,
    db?: DbExecutor,
  ): Promise<PractitionerStatusRow | null>;
  getFacilityStatus(
    id: string,
    db?: DbExecutor,
  ): Promise<FacilityStatusRow | null>;
};

export function createPractitionerRepository(
  db: Pick<Pool, 'query' | 'connect'>,
): PractitionerRepository {
  return {
    async createPractitioner(input) {
      try {
        const result = await db.query<PractitionerRow>(
          `
            INSERT INTO practitioners (
              code,
              first_name,
              middle_name,
              last_name,
              profession,
              license_number,
              phone,
              email,
              bio,
              is_active
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING ${PRACTITIONER_SELECT_COLUMNS}
          `,
          [
            input.code,
            input.firstName,
            input.middleName ?? null,
            input.lastName,
            input.profession,
            input.licenseNumber,
            input.phone ?? null,
            input.email ?? null,
            input.bio ?? null,
            input.isActive ?? true,
          ],
        );

        const row = result.rows[0];

        if (!row) {
          throw createInternalError();
        }

        return mapPractitionerRow(row);
      } catch (error) {
        return translateUniqueViolation(error);
      }
    },

    async listPractitioners(query) {
      const { whereSql, values } = buildPractitionerFilterSql(query);
      const countResult = await db.query<{ total_items: number }>(
        `
          SELECT COUNT(*)::int AS total_items
          FROM practitioners
          ${whereSql}
        `,
        values,
      );

      const totalItems = countResult.rows[0]?.total_items ?? 0;
      const offset = (query.page - 1) * query.pageSize;

      const dataResult = await db.query<PractitionerRow>(
        `
          SELECT ${PRACTITIONER_SELECT_COLUMNS}
          FROM practitioners
          ${whereSql}
          ORDER BY last_name ASC, first_name ASC, id ASC
          LIMIT $${values.length + 1}
          OFFSET $${values.length + 2}
        `,
        [...values, query.pageSize, offset],
      );

      const totalPages =
        totalItems === 0 ? 0 : Math.ceil(totalItems / query.pageSize);

      return {
        data: dataResult.rows.map(mapPractitionerRow),
        pagination: {
          page: query.page,
          pageSize: query.pageSize,
          totalItems,
          totalPages,
        },
      };
    },

    async findPractitionerById(id) {
      return queryPractitionerById(db, id);
    },

    async updatePractitioner(id, input) {
      const entries = Object.entries(input).filter(
        ([, value]) => value !== undefined,
      ) as Array<
        [
          keyof UpdatePractitionerInput,
          Exclude<
            UpdatePractitionerInput[keyof UpdatePractitionerInput],
            undefined
          >,
        ]
      >;

      if (entries.length === 0) {
        return null;
      }

      const values = entries.map(([, value]) => value);
      const setSql = entries
        .map(
          ([key], index) =>
            `${PRACTITIONER_MUTABLE_COLUMN_MAP[key]} = $${index + 1}`,
        )
        .join(', ');
      values.push(id);

      try {
        const result = await db.query<PractitionerRow>(
          `
            UPDATE practitioners
            SET ${setSql}, updated_at = now()
            WHERE id = $${values.length}
            RETURNING ${PRACTITIONER_SELECT_COLUMNS}
          `,
          values,
        );

        const row = result.rows[0];
        return row ? mapPractitionerRow(row) : null;
      } catch (error) {
        return translateUniqueViolation(error);
      }
    },

    async deletePractitioner(id) {
      const result = await db.query<{ id: string }>(
        `
          UPDATE practitioners
          SET is_active = false,
              updated_at = now()
          WHERE id = $1
          RETURNING id
        `,
        [id],
      );

      return result.rows.length > 0;
    },

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

    async createAssignment(practitionerId, input, executor = db) {
      try {
        const result = await executor.query<AssignmentRow>(
          `
            INSERT INTO practitioner_facility_assignments (
              practitioner_id,
              facility_id,
              role_title,
              department,
              is_primary,
              is_active
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id
          `,
          [
            practitionerId,
            input.facilityId,
            input.roleTitle,
            input.department ?? null,
            input.isPrimary ?? false,
            input.isActive ?? true,
          ],
        );

        const assignmentId = result.rows[0]?.id;

        if (!assignmentId) {
          throw createInternalError();
        }

        const assignment = await queryAssignmentById(
          executor,
          practitionerId,
          assignmentId,
        );

        if (!assignment) {
          throw createInternalError();
        }

        return assignment;
      } catch (error) {
        return translateUniqueViolation(error);
      }
    },

    async listAssignments(practitionerId, executor = db) {
      const result = await executor.query<AssignmentRow>(
        `
          SELECT ${ASSIGNMENT_SELECT_COLUMNS}
          FROM practitioner_facility_assignments a
          JOIN healthcare_facilities f ON f.id = a.facility_id
          WHERE a.practitioner_id = $1
          ORDER BY a.is_primary DESC, a.created_at ASC, a.id ASC
        `,
        [practitionerId],
      );

      return {
        data: result.rows.map(mapAssignmentRow),
      };
    },

    async findAssignmentById(practitionerId, assignmentId, executor = db) {
      return queryAssignmentById(executor, practitionerId, assignmentId);
    },

    async updateAssignment(practitionerId, assignmentId, input, executor = db) {
      const entries = Object.entries(input).filter(
        ([, value]) => value !== undefined,
      ) as Array<
        [
          keyof UpdatePractitionerAssignmentInput,
          Exclude<
            UpdatePractitionerAssignmentInput[keyof UpdatePractitionerAssignmentInput],
            undefined
          >,
        ]
      >;

      if (entries.length === 0) {
        return null;
      }

      const values = entries.map(([, value]) => value);
      const setSql = entries
        .map(
          ([key], index) =>
            `${ASSIGNMENT_MUTABLE_COLUMN_MAP[key]} = $${index + 1}`,
        )
        .join(', ');
      values.push(practitionerId, assignmentId);

      try {
        const result = await executor.query<{ id: string }>(
          `
            UPDATE practitioner_facility_assignments
            SET ${setSql}, updated_at = now()
            WHERE practitioner_id = $${values.length - 1}
              AND id = $${values.length}
            RETURNING id
          `,
          values,
        );

        const updatedId = result.rows[0]?.id;

        if (!updatedId) {
          return null;
        }

        const assignment = await queryAssignmentById(
          executor,
          practitionerId,
          updatedId,
        );

        if (!assignment) {
          throw createInternalError();
        }

        return assignment;
      } catch (error) {
        return translateUniqueViolation(error);
      }
    },

    async deleteAssignment(practitionerId, assignmentId, executor = db) {
      const result = await executor.query<{ id: string }>(
        `
          UPDATE practitioner_facility_assignments
          SET is_active = false,
              is_primary = false,
              updated_at = now()
          WHERE practitioner_id = $1
            AND id = $2
          RETURNING id
        `,
        [practitionerId, assignmentId],
      );

      return result.rows.length > 0;
    },

    async lockPractitionerAssignments(practitionerId, executor) {
      await executor.query(
        `
          SELECT id
          FROM practitioners
          WHERE id = $1
          FOR UPDATE
        `,
        [practitionerId],
      );

      await executor.query(
        `
          SELECT id
          FROM practitioner_facility_assignments
          WHERE practitioner_id = $1
          FOR UPDATE
        `,
        [practitionerId],
      );
    },

    async clearPrimaryAssignments(
      practitionerId,
      executor,
      excludeAssignmentId,
    ) {
      const values: unknown[] = [practitionerId];
      let filterSql = 'practitioner_id = $1 AND is_primary = true';

      if (excludeAssignmentId) {
        values.push(excludeAssignmentId);
        filterSql += ' AND id <> $2';
      }

      await executor.query(
        `
          UPDATE practitioner_facility_assignments
          SET is_primary = false,
              updated_at = now()
          WHERE ${filterSql}
        `,
        values,
      );
    },

    async getPractitionerStatus(id, executor = db) {
      return queryPractitionerStatus(executor, id);
    },

    async getFacilityStatus(id, executor = db) {
      return queryFacilityStatus(executor, id);
    },
  };
}
