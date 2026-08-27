import type {
  CreateHealthcareFacilityInput,
  HealthcareFacility,
  HealthcareFacilityListQuery,
  HealthcareFacilityListResponse,
  UpdateHealthcareFacilityInput,
  FacilityType,
} from '@hakimi/shared';
import type { DomainAuthorizationScope } from '../access/types.js';
import {
  createCodeConflictError,
  createLicenseConflictError,
  createInternalError,
} from '../http/api-error.js';

type DbExecutor = {
  query<T extends Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<{
    rows: T[];
  }>;
};

type FacilityRow = {
  id: string;
  code: string;
  name: string;
  facility_type: string;
  license_number: string | null;
  phone: string | null;
  email: string | null;
  region: string;
  city: string;
  address_line: string | null;
  is_active: boolean;
  created_at: Date | string;
  updated_at: Date | string;
};

const FACILITY_SELECT_COLUMNS = `
  id,
  code,
  name,
  facility_type,
  license_number,
  phone,
  email,
  region,
  city,
  address_line,
  is_active,
  created_at,
  updated_at
`;

const FACILITY_MUTABLE_COLUMN_MAP = {
  code: 'code',
  name: 'name',
  facilityType: 'facility_type',
  licenseNumber: 'license_number',
  phone: 'phone',
  email: 'email',
  region: 'region',
  city: 'city',
  addressLine: 'address_line',
  isActive: 'is_active',
} as const;

function toIsoString(value: Date | string) {
  return new Date(value).toISOString();
}

function mapFacilityRow(row: FacilityRow): HealthcareFacility {
  const facilityType = row.facility_type as FacilityType;

  if (
    facilityType !== 'hospital' &&
    facilityType !== 'clinic' &&
    facilityType !== 'health_center' &&
    facilityType !== 'diagnostic_center' &&
    facilityType !== 'pharmacy'
  ) {
    throw createInternalError();
  }

  return {
    id: row.id,
    code: row.code,
    name: row.name,
    facilityType,
    licenseNumber: row.license_number,
    phone: row.phone,
    email: row.email,
    region: row.region,
    city: row.city,
    addressLine: row.address_line,
    isActive: row.is_active,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
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

    if (constraint === 'healthcare_facilities_code_key') {
      throw createCodeConflictError();
    }

    if (constraint === 'healthcare_facilities_license_number_key') {
      throw createLicenseConflictError();
    }
  }

  throw error;
}

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, '\\$&');
}

function buildFacilityFilterSql(
  query: HealthcareFacilityListQuery,
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
          EXISTS (
            SELECT 1
            FROM workforce_role_assignments scoped_role
            WHERE scoped_role.actor_id = scoped_actor.id
              AND scoped_role.is_active = true
              AND scoped_role.role IN ('FACILITY_ADMIN', 'SCHEDULER')
              AND scoped_role.facility_id = healthcare_facilities.id
          )
          OR EXISTS (
            SELECT 1
            FROM workforce_role_assignments practitioner_role
            JOIN practitioners linked_practitioner
              ON linked_practitioner.id = scoped_actor.practitioner_id
             AND linked_practitioner.is_active = true
            JOIN practitioner_facility_assignments scoped_assignment
              ON scoped_assignment.practitioner_id = linked_practitioner.id
             AND scoped_assignment.is_active = true
             AND scoped_assignment.facility_id = healthcare_facilities.id
            WHERE practitioner_role.actor_id = scoped_actor.id
              AND practitioner_role.role = 'PRACTITIONER'
              AND practitioner_role.is_active = true
          )
        )
    )`);
    clauses.push('is_active = true');
  }

  if (query.facilityType) {
    values.push(query.facilityType);
    clauses.push(`facility_type = $${values.length}`);
  }

  if (query.region) {
    values.push(query.region);
    clauses.push(`region = $${values.length}`);
  }

  if (query.city) {
    values.push(query.city);
    clauses.push(`city = $${values.length}`);
  }

  if (query.isActive !== undefined) {
    values.push(query.isActive);
    clauses.push(`is_active = $${values.length}`);
  }

  if (query.search) {
    const searchPattern = `%${escapeLikePattern(query.search)}%`;
    values.push(searchPattern);
    const parameter = `$${values.length}`;
    clauses.push(
      `(code ILIKE ${parameter} ESCAPE '\\' OR name ILIKE ${parameter} ESCAPE '\\' OR region ILIKE ${parameter} ESCAPE '\\' OR city ILIKE ${parameter} ESCAPE '\\')`,
    );
  }

  return {
    whereSql: clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '',
    values,
  };
}

export type HealthcareFacilityRepository = {
  create(input: CreateHealthcareFacilityInput): Promise<HealthcareFacility>;
  list(
    query: HealthcareFacilityListQuery,
    scope?: DomainAuthorizationScope,
  ): Promise<HealthcareFacilityListResponse>;
  findById(id: string): Promise<HealthcareFacility | null>;
  update(
    id: string,
    input: UpdateHealthcareFacilityInput,
  ): Promise<HealthcareFacility | null>;
  deactivate(id: string): Promise<boolean>;
};

export function createHealthcareFacilityRepository(
  db: DbExecutor,
): HealthcareFacilityRepository {
  return {
    async create(input) {
      try {
        const result = await db.query<FacilityRow>(
          `
            INSERT INTO healthcare_facilities (
              code,
              name,
              facility_type,
              license_number,
              phone,
              email,
              region,
              city,
              address_line,
              is_active
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING ${FACILITY_SELECT_COLUMNS}
          `,
          [
            input.code,
            input.name,
            input.facilityType,
            input.licenseNumber ?? null,
            input.phone ?? null,
            input.email ?? null,
            input.region,
            input.city,
            input.addressLine ?? null,
            input.isActive ?? true,
          ],
        );

        const row = result.rows[0];

        if (!row) {
          throw createInternalError();
        }

        return mapFacilityRow(row);
      } catch (error) {
        return translateUniqueViolation(error);
      }
    },

    async list(query, scope) {
      const { whereSql, values } = buildFacilityFilterSql(query, scope);
      const countResult = await db.query<{ total_items: number }>(
        `
          SELECT COUNT(*)::int AS total_items
          FROM healthcare_facilities
          ${whereSql}
        `,
        values,
      );

      const totalItems = countResult.rows[0]?.total_items ?? 0;
      const offset = (query.page - 1) * query.pageSize;

      const dataResult = await db.query<FacilityRow>(
        `
          SELECT ${FACILITY_SELECT_COLUMNS}
          FROM healthcare_facilities
          ${whereSql}
          ORDER BY name ASC, id ASC
          LIMIT $${values.length + 1}
          OFFSET $${values.length + 2}
        `,
        [...values, query.pageSize, offset],
      );

      const totalPages =
        totalItems === 0 ? 0 : Math.ceil(totalItems / query.pageSize);

      return {
        data: dataResult.rows.map(mapFacilityRow),
        pagination: {
          page: query.page,
          pageSize: query.pageSize,
          totalItems,
          totalPages,
        },
      };
    },

    async findById(id) {
      const result = await db.query<FacilityRow>(
        `
          SELECT ${FACILITY_SELECT_COLUMNS}
          FROM healthcare_facilities
          WHERE id = $1
        `,
        [id],
      );

      const row = result.rows[0];

      return row ? mapFacilityRow(row) : null;
    },

    async update(id, input) {
      const entries = Object.entries(input).filter(
        ([, value]) => value !== undefined,
      ) as Array<
        [
          keyof UpdateHealthcareFacilityInput,
          Exclude<
            UpdateHealthcareFacilityInput[keyof UpdateHealthcareFacilityInput],
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
            `${FACILITY_MUTABLE_COLUMN_MAP[key]} = $${index + 1}`,
        )
        .join(', ');
      values.push(id);
      const changesLifecycle = input.isActive !== undefined;

      try {
        const result = await db.query<FacilityRow>(
          `
            WITH previous_facility AS MATERIALIZED (
              SELECT id, is_active
              FROM healthcare_facilities
              WHERE id = $${values.length}
              FOR UPDATE
            ),
            updated_facility AS MATERIALIZED (
              UPDATE healthcare_facilities facility
              SET ${setSql}, updated_at = now()
              FROM previous_facility previous
              WHERE facility.id = previous.id
              RETURNING
                facility.id,
                facility.code,
                facility.name,
                facility.facility_type,
                facility.license_number,
                facility.phone,
                facility.email,
                facility.region,
                facility.city,
                facility.address_line,
                facility.is_active,
                facility.created_at,
                facility.updated_at,
                previous.is_active AS previous_is_active
            ),
            authority_epoch AS (
              UPDATE workforce_role_assignments role
              SET activated_at = now(),
                  updated_at = now()
              FROM updated_facility facility
              WHERE ${changesLifecycle ? 'true' : 'false'}
                AND facility.is_active IS DISTINCT FROM facility.previous_is_active
                AND role.is_active = true
                AND (
                  role.facility_id = facility.id
                  OR (
                    role.role = 'PRACTITIONER'
                    AND role.facility_id IS NULL
                    AND EXISTS (
                      SELECT 1
                      FROM workforce_actors actor
                      JOIN practitioner_facility_assignments assignment
                        ON assignment.practitioner_id = actor.practitioner_id
                       AND assignment.facility_id = facility.id
                       AND assignment.is_active = true
                      WHERE actor.id = role.actor_id
                    )
                  )
                )
              RETURNING role.id
            )
            SELECT ${FACILITY_SELECT_COLUMNS},
                   (SELECT COUNT(*) FROM authority_epoch) AS authority_epoch_count
            FROM updated_facility
          `,
          values,
        );

        const row = result.rows[0];

        return row ? mapFacilityRow(row) : null;
      } catch (error) {
        return translateUniqueViolation(error);
      }
    },

    async deactivate(id) {
      const result = await db.query<{ id: string }>(
        `
          WITH previous_facility AS MATERIALIZED (
            SELECT id, is_active
            FROM healthcare_facilities
            WHERE id = $1
            FOR UPDATE
          ),
          updated_facility AS MATERIALIZED (
            UPDATE healthcare_facilities facility
            SET is_active = false,
                updated_at = now()
            FROM previous_facility previous
            WHERE facility.id = previous.id
            RETURNING facility.id,
                      facility.is_active,
                      previous.is_active AS previous_is_active
          ),
          authority_epoch AS (
            UPDATE workforce_role_assignments role
            SET activated_at = now(),
                updated_at = now()
            FROM updated_facility facility
            WHERE facility.is_active IS DISTINCT FROM facility.previous_is_active
              AND role.is_active = true
              AND (
                role.facility_id = facility.id
                OR (
                  role.role = 'PRACTITIONER'
                  AND role.facility_id IS NULL
                  AND EXISTS (
                    SELECT 1
                    FROM workforce_actors actor
                    JOIN practitioner_facility_assignments assignment
                      ON assignment.practitioner_id = actor.practitioner_id
                     AND assignment.facility_id = facility.id
                     AND assignment.is_active = true
                    WHERE actor.id = role.actor_id
                  )
                )
              )
            RETURNING role.id
          )
          SELECT id,
                 (SELECT COUNT(*) FROM authority_epoch) AS authority_epoch_count
          FROM updated_facility
        `,
        [id],
      );

      return result.rows.length > 0;
    },
  };
}
