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
import type { DomainAuthorizationScope } from '../access/types.js';
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

function buildPractitionerFilterSql(
  query: PractitionerListQuery,
  scope?: DomainAuthorizationScope,
) {
  const clauses: string[] = [];
  const values: unknown[] = [];

  if (scope && !scope.isPlatformAdmin) {
    values.push(scope.actorId);
    const actorParameter = `$${values.length}`;
    clauses.push(`EXISTS (
      SELECT 1
      FROM workforce_actors scoped_actor
      WHERE scoped_actor.id = ${actorParameter}
        AND scoped_actor.is_active = true
        AND (
          (
            scoped_actor.practitioner_id = practitioners.id
            AND EXISTS (
              SELECT 1
              FROM workforce_role_assignments practitioner_role
              WHERE practitioner_role.actor_id = scoped_actor.id
                AND practitioner_role.role = 'PRACTITIONER'
                AND practitioner_role.is_active = true
            )
          )
          OR EXISTS (
            SELECT 1
            FROM practitioner_facility_assignments target_assignment
            JOIN healthcare_facilities shared_facility
              ON shared_facility.id = target_assignment.facility_id
             AND shared_facility.is_active = true
            WHERE target_assignment.practitioner_id = practitioners.id
              AND target_assignment.is_active = true
              AND (
                EXISTS (
                  SELECT 1
                  FROM workforce_role_assignments administrative_role
                  WHERE administrative_role.actor_id = scoped_actor.id
                    AND administrative_role.role IN ('FACILITY_ADMIN', 'SCHEDULER')
                    AND administrative_role.facility_id = target_assignment.facility_id
                    AND administrative_role.is_active = true
                )
                OR EXISTS (
                  SELECT 1
                  FROM workforce_role_assignments practitioner_role
                  JOIN practitioner_facility_assignments own_assignment
                    ON own_assignment.practitioner_id = scoped_actor.practitioner_id
                   AND own_assignment.facility_id = target_assignment.facility_id
                   AND own_assignment.is_active = true
                  WHERE practitioner_role.actor_id = scoped_actor.id
                    AND practitioner_role.role = 'PRACTITIONER'
                    AND practitioner_role.is_active = true
                )
              )
          )
        )
    )`);
    clauses.push('practitioners.is_active = true');
  }

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
    scope?: DomainAuthorizationScope,
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
    scope?: DomainAuthorizationScope,
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

    async listPractitioners(query, scope) {
      const { whereSql, values } = buildPractitionerFilterSql(query, scope);
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
      const changesLifecycle = input.isActive !== undefined;

      try {
        const result = await db.query<PractitionerRow>(
          `
            WITH locked_actors AS MATERIALIZED (
              SELECT actor.id
              FROM workforce_actors actor
              WHERE ${changesLifecycle ? 'true' : 'false'}
                AND actor.practitioner_id = $${values.length}
              ORDER BY actor.id
              FOR UPDATE OF actor
            ),
            previous_practitioner AS MATERIALIZED (
              SELECT practitioner.id, practitioner.is_active
              FROM practitioners practitioner
              LEFT JOIN locked_actors actor_lock_barrier ON false
              WHERE practitioner.id = $${values.length}
              FOR UPDATE OF practitioner
            ),
            updated_practitioner AS MATERIALIZED (
              UPDATE practitioners practitioner
              SET ${setSql}, updated_at = now()
              FROM previous_practitioner previous
              WHERE practitioner.id = previous.id
              RETURNING
                practitioner.id,
                practitioner.code,
                practitioner.first_name,
                practitioner.middle_name,
                practitioner.last_name,
                practitioner.profession,
                practitioner.license_number,
                practitioner.phone,
                practitioner.email,
                practitioner.bio,
                practitioner.is_active,
                practitioner.created_at,
                practitioner.updated_at,
                previous.is_active AS previous_is_active
            ),
            authority_epoch AS (
              UPDATE workforce_actors actor
              SET activated_at = now(),
                  updated_at = now()
              FROM updated_practitioner practitioner
              WHERE ${changesLifecycle ? 'true' : 'false'}
                AND practitioner.is_active IS DISTINCT FROM practitioner.previous_is_active
                AND actor.practitioner_id = practitioner.id
                AND actor.is_active = true
              RETURNING actor.id
            )
            SELECT ${PRACTITIONER_SELECT_COLUMNS},
                   (SELECT COUNT(*) FROM authority_epoch) AS authority_epoch_count
            FROM updated_practitioner
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
          WITH locked_actors AS MATERIALIZED (
            SELECT actor.id
            FROM workforce_actors actor
            WHERE actor.practitioner_id = $1
            ORDER BY actor.id
            FOR UPDATE OF actor
          ),
          previous_practitioner AS MATERIALIZED (
            SELECT practitioner.id, practitioner.is_active
            FROM practitioners practitioner
            LEFT JOIN locked_actors actor_lock_barrier ON false
            WHERE practitioner.id = $1
            FOR UPDATE OF practitioner
          ),
          updated_practitioner AS MATERIALIZED (
            UPDATE practitioners practitioner
            SET is_active = false,
                updated_at = now()
            FROM previous_practitioner previous
            WHERE practitioner.id = previous.id
            RETURNING practitioner.id,
                      practitioner.is_active,
                      previous.is_active AS previous_is_active
          ),
          authority_epoch AS (
            UPDATE workforce_actors actor
            SET activated_at = now(),
                updated_at = now()
            FROM updated_practitioner practitioner
            WHERE practitioner.is_active IS DISTINCT FROM practitioner.previous_is_active
              AND actor.practitioner_id = practitioner.id
              AND actor.is_active = true
            RETURNING actor.id
          )
          SELECT id,
                 (SELECT COUNT(*) FROM authority_epoch) AS authority_epoch_count
          FROM updated_practitioner
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
            WITH created_assignment AS MATERIALIZED (
              INSERT INTO practitioner_facility_assignments (
                practitioner_id,
                facility_id,
                role_title,
                department,
                is_primary,
                is_active
              )
              VALUES ($1, $2, $3, $4, $5, $6)
              RETURNING id, practitioner_id, is_active
            ),
            authority_epoch AS (
              UPDATE workforce_role_assignments role
              SET activated_at = now(),
                  updated_at = now()
              FROM workforce_actors actor,
                   created_assignment assignment
              WHERE assignment.is_active = true
                AND actor.practitioner_id = assignment.practitioner_id
                AND role.actor_id = actor.id
                AND role.role = 'PRACTITIONER'
                AND role.facility_id IS NULL
                AND role.is_active = true
              RETURNING role.id
            )
            SELECT id,
                   (SELECT COUNT(*) FROM authority_epoch) AS authority_epoch_count
            FROM created_assignment
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

    async listAssignments(practitionerId, scope, executor = db) {
      const values: unknown[] = [practitionerId];
      let scopeSql = '';

      if (scope && !scope.isPlatformAdmin) {
        values.push(scope.actorId);
        scopeSql = `AND EXISTS (
          SELECT 1
          FROM workforce_actors scoped_actor
          WHERE scoped_actor.id = $2
            AND scoped_actor.is_active = true
            AND (
              (
                scoped_actor.practitioner_id = a.practitioner_id
                AND EXISTS (
                  SELECT 1
                  FROM workforce_role_assignments practitioner_role
                  WHERE practitioner_role.actor_id = scoped_actor.id
                    AND practitioner_role.role = 'PRACTITIONER'
                    AND practitioner_role.is_active = true
                )
              )
              OR EXISTS (
                SELECT 1
                FROM workforce_role_assignments administrative_role
                JOIN healthcare_facilities scoped_facility
                  ON scoped_facility.id = administrative_role.facility_id
                 AND scoped_facility.is_active = true
                WHERE administrative_role.actor_id = scoped_actor.id
                  AND administrative_role.role IN ('FACILITY_ADMIN', 'SCHEDULER')
                  AND administrative_role.facility_id = a.facility_id
                  AND administrative_role.is_active = true
              )
            )
        )`;
      }

      const result = await executor.query<AssignmentRow>(
        `
          SELECT ${ASSIGNMENT_SELECT_COLUMNS}
          FROM practitioner_facility_assignments a
          JOIN healthcare_facilities f ON f.id = a.facility_id
          WHERE a.practitioner_id = $1
            ${scopeSql}
          ORDER BY a.is_primary DESC, a.created_at ASC, a.id ASC
        `,
        values,
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
            WITH previous_assignment AS MATERIALIZED (
              SELECT id, is_active
              FROM practitioner_facility_assignments
              WHERE practitioner_id = $${values.length - 1}
                AND id = $${values.length}
              FOR UPDATE
            ),
            updated_assignment AS MATERIALIZED (
              UPDATE practitioner_facility_assignments assignment
              SET ${setSql}, updated_at = now()
              FROM previous_assignment previous
              WHERE assignment.id = previous.id
              RETURNING assignment.id,
                        assignment.practitioner_id,
                        assignment.is_active,
                        previous.is_active AS previous_is_active
            ),
            authority_epoch AS (
              UPDATE workforce_role_assignments role
              SET activated_at = now(),
                  updated_at = now()
              FROM workforce_actors actor,
                   updated_assignment assignment
              WHERE assignment.is_active IS DISTINCT FROM assignment.previous_is_active
                AND actor.practitioner_id = assignment.practitioner_id
                AND role.actor_id = actor.id
                AND role.role = 'PRACTITIONER'
                AND role.facility_id IS NULL
                AND role.is_active = true
              RETURNING role.id
            )
            SELECT id,
                   (SELECT COUNT(*) FROM authority_epoch) AS authority_epoch_count
            FROM updated_assignment
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
          WITH previous_assignment AS MATERIALIZED (
            SELECT id, is_active
            FROM practitioner_facility_assignments
            WHERE practitioner_id = $1
              AND id = $2
            FOR UPDATE
          ),
          updated_assignment AS MATERIALIZED (
            UPDATE practitioner_facility_assignments assignment
            SET is_active = false,
                is_primary = false,
                updated_at = now()
            FROM previous_assignment previous
            WHERE assignment.id = previous.id
            RETURNING assignment.id,
                      assignment.practitioner_id,
                      assignment.is_active,
                      previous.is_active AS previous_is_active
          ),
          authority_epoch AS (
            UPDATE workforce_role_assignments role
            SET activated_at = now(),
                updated_at = now()
            FROM workforce_actors actor,
                 updated_assignment assignment
            WHERE assignment.is_active IS DISTINCT FROM assignment.previous_is_active
              AND actor.practitioner_id = assignment.practitioner_id
              AND role.actor_id = actor.id
              AND role.role = 'PRACTITIONER'
              AND role.facility_id IS NULL
              AND role.is_active = true
            RETURNING role.id
          )
          SELECT id,
                 (SELECT COUNT(*) FROM authority_epoch) AS authority_epoch_count
          FROM updated_assignment
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
