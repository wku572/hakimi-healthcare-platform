import type {
  Appointment,
  AppointmentListQuery,
  AppointmentListResponse,
  AppointmentFacilitySummary,
  AppointmentPatientSummary,
  AppointmentPractitionerSummary,
  AppointmentStatus,
  CancelAppointmentInput,
  CreateAppointmentInput,
  UpdateAppointmentInput,
} from '@hakimi/shared';
import type { DomainAuthorizationScope } from '../access/types.js';
import type { Pool } from 'pg';
import type { DbExecutor } from '../database-executor.js';
import {
  createAppointmentConflictError,
  createFacilityNotFoundError,
  createInternalError,
  createPatientNotFoundError,
  createPractitionerNotFoundError,
} from '../http/api-error.js';

type AppointmentRow = {
  id: string;
  patient_id: string;
  practitioner_id: string;
  facility_id: string;
  scheduled_start: Date | string;
  scheduled_end: Date | string;
  status: string;
  schedule_version: number;
  cancellation_reason: string | null;
  cancelled_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
  patient_summary_id: string;
  patient_first_name: string;
  patient_middle_name: string | null;
  patient_last_name: string | null;
  patient_date_of_birth: string | null;
  patient_administrative_sex: string;
  patient_is_active: boolean;
  patient_medical_record_number: string;
  practitioner_summary_id: string;
  practitioner_code: string;
  practitioner_first_name: string;
  practitioner_middle_name: string | null;
  practitioner_last_name: string;
  practitioner_profession: string;
  practitioner_is_active: boolean;
  facility_summary_id: string;
  facility_code: string;
  facility_name: string;
  facility_type: string;
  facility_region: string;
  facility_city: string;
  facility_is_active: boolean;
};

type AppointmentStatusRow = {
  id: string;
  is_active: boolean;
};

type AppointmentScheduleStateRow = {
  id: string;
  practitioner_id: string;
  status: string;
  schedule_version: number;
  scheduled_start: Date | string;
  scheduled_end: Date | string;
};

type PractitionerAssignmentStatusRow = {
  id: string;
};

type PatientRegistrationStatusRow = {
  id: string;
};

type AppointmentSearchResult = {
  rows: Appointment[];
  pagination: AppointmentListResponse['pagination'];
};

const appointmentStatuses = [
  'SCHEDULED',
  'CONFIRMED',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
] as const;

const APPOINTMENT_SELECT_COLUMNS = `
  a.id,
  a.patient_id,
  a.practitioner_id,
  a.facility_id,
  a.scheduled_start,
  a.scheduled_end,
  a.status,
  a.schedule_version,
  a.cancellation_reason,
  a.cancelled_at,
  a.created_at,
  a.updated_at,
  p.id AS patient_summary_id,
  p.first_name AS patient_first_name,
  p.middle_name AS patient_middle_name,
  p.last_name AS patient_last_name,
  p.date_of_birth AS patient_date_of_birth,
  p.administrative_sex AS patient_administrative_sex,
  p.is_active AS patient_is_active,
  r.medical_record_number AS patient_medical_record_number,
  pr.id AS practitioner_summary_id,
  pr.code AS practitioner_code,
  pr.first_name AS practitioner_first_name,
  pr.middle_name AS practitioner_middle_name,
  pr.last_name AS practitioner_last_name,
  pr.profession AS practitioner_profession,
  pr.is_active AS practitioner_is_active,
  f.id AS facility_summary_id,
  f.code AS facility_code,
  f.name AS facility_name,
  f.facility_type AS facility_type,
  f.region AS facility_region,
  f.city AS facility_city,
  f.is_active AS facility_is_active
`;

const APPOINTMENT_MUTABLE_COLUMN_MAP = {
  scheduledStart: 'scheduled_start',
  scheduledEnd: 'scheduled_end',
  status: 'status',
} as const;

function toIsoString(value: Date | string | null) {
  if (value === null) {
    return null;
  }

  return new Date(value).toISOString();
}

function mapPatientSummary(row: AppointmentRow): AppointmentPatientSummary {
  return {
    id: row.patient_summary_id,
    firstName: row.patient_first_name,
    middleName: row.patient_middle_name,
    lastName: row.patient_last_name,
    dateOfBirth: row.patient_date_of_birth,
    administrativeSex:
      row.patient_administrative_sex as AppointmentPatientSummary['administrativeSex'],
    isActive: row.patient_is_active,
    medicalRecordNumber: row.patient_medical_record_number,
  };
}

function mapPractitionerSummary(
  row: AppointmentRow,
): AppointmentPractitionerSummary {
  return {
    id: row.practitioner_summary_id,
    code: row.practitioner_code,
    firstName: row.practitioner_first_name,
    middleName: row.practitioner_middle_name,
    lastName: row.practitioner_last_name,
    profession: row.practitioner_profession,
    isActive: row.practitioner_is_active,
  };
}

function mapFacilitySummary(row: AppointmentRow): AppointmentFacilitySummary {
  return {
    id: row.facility_summary_id,
    code: row.facility_code,
    name: row.facility_name,
    facilityType:
      row.facility_type as AppointmentFacilitySummary['facilityType'],
    region: row.facility_region,
    city: row.facility_city,
    isActive: row.facility_is_active,
  };
}

function mapAppointmentRow(row: AppointmentRow): Appointment {
  const status = row.status as AppointmentStatus;

  if (!appointmentStatuses.includes(status)) {
    throw createInternalError();
  }

  return {
    id: row.id,
    patientId: row.patient_id,
    practitionerId: row.practitioner_id,
    facilityId: row.facility_id,
    scheduledStart: toIsoString(row.scheduled_start)!,
    scheduledEnd: toIsoString(row.scheduled_end)!,
    status,
    cancellationReason: row.cancellation_reason,
    cancelledAt: toIsoString(row.cancelled_at),
    createdAt: toIsoString(row.created_at)!,
    updatedAt: toIsoString(row.updated_at)!,
    patient: mapPatientSummary(row),
    practitioner: mapPractitionerSummary(row),
    facility: mapFacilitySummary(row),
  };
}

function buildAppointmentFilterSql(
  query: AppointmentListQuery,
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
      JOIN healthcare_facilities scoped_facility
        ON scoped_facility.id = a.facility_id
       AND scoped_facility.is_active = true
      WHERE scoped_actor.id = ${actorParameter}
        AND scoped_actor.is_active = true
        AND (
          EXISTS (
            SELECT 1
            FROM workforce_role_assignments administrative_role
            WHERE administrative_role.actor_id = scoped_actor.id
              AND administrative_role.role IN ('FACILITY_ADMIN', 'SCHEDULER')
              AND administrative_role.facility_id = a.facility_id
              AND administrative_role.is_active = true
          )
          OR EXISTS (
            SELECT 1
            FROM workforce_role_assignments practitioner_role
            JOIN practitioners linked_practitioner
              ON linked_practitioner.id = scoped_actor.practitioner_id
             AND linked_practitioner.id = a.practitioner_id
             AND linked_practitioner.is_active = true
            JOIN practitioner_facility_assignments own_assignment
              ON own_assignment.practitioner_id = linked_practitioner.id
             AND own_assignment.facility_id = a.facility_id
             AND own_assignment.is_active = true
            WHERE practitioner_role.actor_id = scoped_actor.id
              AND practitioner_role.role = 'PRACTITIONER'
              AND practitioner_role.is_active = true
          )
        )
    )`);
  }

  if (query.facilityId) {
    values.push(query.facilityId);
    clauses.push(`a.facility_id = $${values.length}`);
  }

  if (query.practitionerId) {
    values.push(query.practitionerId);
    clauses.push(`a.practitioner_id = $${values.length}`);
  }

  if (query.patientId) {
    values.push(query.patientId);
    clauses.push(`a.patient_id = $${values.length}`);
  }

  if (query.status) {
    values.push(query.status);
    clauses.push(`a.status = $${values.length}`);
  }

  if (query.from) {
    values.push(query.from);
    clauses.push(`a.scheduled_end > $${values.length}::timestamptz`);
  }

  if (query.to) {
    values.push(query.to);
    clauses.push(`a.scheduled_start < $${values.length}::timestamptz`);
  }

  return {
    whereSql: clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '',
    values,
  };
}

async function queryAppointmentById(
  db: DbExecutor,
  id: string,
): Promise<Appointment | null> {
  const result = await db.query<AppointmentRow>(
    `
      SELECT ${APPOINTMENT_SELECT_COLUMNS}
      FROM appointments a
      JOIN patients p ON p.id = a.patient_id
      JOIN patient_facility_registrations r
        ON r.patient_id = a.patient_id
       AND r.facility_id = a.facility_id
      JOIN practitioners pr ON pr.id = a.practitioner_id
      JOIN healthcare_facilities f ON f.id = a.facility_id
      WHERE a.id = $1
    `,
    [id],
  );

  return result.rows[0] ? mapAppointmentRow(result.rows[0]) : null;
}

async function queryAppointmentScheduleStateById(
  db: DbExecutor,
  id: string,
): Promise<AppointmentScheduleStateRow | null> {
  const result = await db.query<AppointmentScheduleStateRow>(
    `
      SELECT
        id,
        practitioner_id,
        status,
        schedule_version,
        scheduled_start,
        scheduled_end
      FROM appointments
      WHERE id = $1
    `,
    [id],
  );

  return result.rows[0] ?? null;
}

function translateDatabaseError(error: unknown): never {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === '23503'
  ) {
    const constraint = (error as { constraint?: string }).constraint;

    if (constraint === 'appointments_patient_id_fkey') {
      throw createPatientNotFoundError();
    }

    if (constraint === 'appointments_practitioner_id_fkey') {
      throw createPractitionerNotFoundError();
    }

    if (constraint === 'appointments_facility_id_fkey') {
      throw createFacilityNotFoundError();
    }
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === '23P01'
  ) {
    const constraint = (error as { constraint?: string }).constraint;

    if (constraint === 'appointments_practitioner_time_no_overlap_excl') {
      throw createAppointmentConflictError();
    }
  }

  throw error;
}

export type AppointmentRepository = {
  withTransaction<T>(work: (db: DbExecutor) => Promise<T>): Promise<T>;
  createAppointment(
    input: CreateAppointmentInput,
    db?: DbExecutor,
  ): Promise<Appointment>;
  findAppointmentById(id: string, db?: DbExecutor): Promise<Appointment | null>;
  findAppointmentScheduleStateById(
    id: string,
    db?: DbExecutor,
  ): Promise<AppointmentScheduleStateRow | null>;
  listAppointments(
    query: AppointmentListQuery,
    scope?: DomainAuthorizationScope,
    db?: DbExecutor,
  ): Promise<AppointmentSearchResult>;
  updateAppointment(
    id: string,
    input: UpdateAppointmentInput,
    db?: DbExecutor,
  ): Promise<Appointment | null>;
  cancelAppointment(
    id: string,
    input: CancelAppointmentInput,
    db?: DbExecutor,
  ): Promise<Appointment | null>;
  getFacilityStatus(
    id: string,
    db?: DbExecutor,
  ): Promise<AppointmentStatusRow | null>;
  getPractitionerStatus(
    id: string,
    db?: DbExecutor,
  ): Promise<AppointmentStatusRow | null>;
  getPatientStatus(
    id: string,
    db?: DbExecutor,
  ): Promise<AppointmentStatusRow | null>;
  getActivePractitionerAssignment(
    practitionerId: string,
    facilityId: string,
    db?: DbExecutor,
  ): Promise<PractitionerAssignmentStatusRow | null>;
  getPatientRegistration(
    patientId: string,
    facilityId: string,
    db?: DbExecutor,
  ): Promise<PatientRegistrationStatusRow | null>;
  findConflictingAppointment(
    practitionerId: string,
    scheduledStart: string,
    scheduledEnd: string,
    excludeAppointmentId?: string,
    db?: DbExecutor,
  ): Promise<Appointment | null>;
};

export function createAppointmentRepository(
  db: Pick<Pool, 'query' | 'connect'>,
): AppointmentRepository {
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

    async createAppointment(input, executor = db) {
      try {
        const result = await executor.query<{ id: string }>(
          `
            INSERT INTO appointments (
              patient_id,
              practitioner_id,
              facility_id,
              scheduled_start,
              scheduled_end,
              status
            )
            VALUES ($1, $2, $3, $4, $5, 'SCHEDULED')
            RETURNING id
          `,
          [
            input.patientId,
            input.practitionerId,
            input.facilityId,
            input.scheduledStart,
            input.scheduledEnd,
          ],
        );

        const appointmentId = result.rows[0]?.id;

        if (!appointmentId) {
          throw createInternalError();
        }

        const appointment = await queryAppointmentById(executor, appointmentId);

        if (!appointment) {
          throw createInternalError();
        }

        return appointment;
      } catch (error) {
        return translateDatabaseError(error);
      }
    },

    async findAppointmentById(id, executor = db) {
      return queryAppointmentById(executor, id);
    },

    async findAppointmentScheduleStateById(id, executor = db) {
      return queryAppointmentScheduleStateById(executor, id);
    },

    async listAppointments(query, scope, executor = db) {
      const { whereSql, values } = buildAppointmentFilterSql(query, scope);
      const countResult = await executor.query<{ total_items: number }>(
        `
          SELECT COUNT(*)::int AS total_items
          FROM appointments a
          ${whereSql}
        `,
        values,
      );

      const totalItems = countResult.rows[0]?.total_items ?? 0;
      const offset = (query.page - 1) * query.pageSize;

      const dataResult = await executor.query<AppointmentRow>(
        `
          SELECT ${APPOINTMENT_SELECT_COLUMNS}
          FROM appointments a
          JOIN patients p ON p.id = a.patient_id
          JOIN patient_facility_registrations r
            ON r.patient_id = a.patient_id
           AND r.facility_id = a.facility_id
          JOIN practitioners pr ON pr.id = a.practitioner_id
          JOIN healthcare_facilities f ON f.id = a.facility_id
          ${whereSql}
          ORDER BY a.scheduled_start ASC, a.id ASC
          LIMIT $${values.length + 1}
          OFFSET $${values.length + 2}
        `,
        [...values, query.pageSize, offset],
      );

      const totalPages =
        totalItems === 0 ? 0 : Math.ceil(totalItems / query.pageSize);

      return {
        rows: dataResult.rows.map(mapAppointmentRow),
        pagination: {
          page: query.page,
          pageSize: query.pageSize,
          totalItems,
          totalPages,
        },
      };
    },

    async updateAppointment(id, input, executor = db) {
      const entries = Object.entries(input).filter(
        ([, value]) => value !== undefined,
      ) as Array<
        [
          keyof UpdateAppointmentInput,
          Exclude<
            UpdateAppointmentInput[keyof UpdateAppointmentInput],
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
            `${APPOINTMENT_MUTABLE_COLUMN_MAP[key]} = $${index + 1}`,
        )
        .join(', ');
      const hasTimeChanges = entries.some(
        ([key]) => key === 'scheduledStart' || key === 'scheduledEnd',
      );
      const updateFragments = [setSql];

      if (hasTimeChanges) {
        updateFragments.push('schedule_version = schedule_version + 1');
      }

      values.push(id);

      try {
        const result = await executor.query<{ id: string }>(
          `
            UPDATE appointments
            SET ${updateFragments.join(', ')}, updated_at = now()
            WHERE id = $${values.length}
            RETURNING id
          `,
          values,
        );

        const appointmentId = result.rows[0]?.id;

        if (!appointmentId) {
          return null;
        }

        const appointment = await queryAppointmentById(executor, appointmentId);

        if (!appointment) {
          throw createInternalError();
        }

        return appointment;
      } catch (error) {
        return translateDatabaseError(error);
      }
    },

    async cancelAppointment(id, input, executor = db) {
      const result = await executor.query<{ id: string }>(
        `
          UPDATE appointments
          SET status = 'CANCELLED',
              cancellation_reason = $1,
              cancelled_at = COALESCE(cancelled_at, now()),
              updated_at = now()
          WHERE id = $2
          RETURNING id
        `,
        [input.cancellationReason, id],
      );

      const appointmentId = result.rows[0]?.id;

      if (!appointmentId) {
        return null;
      }

      const appointment = await queryAppointmentById(executor, appointmentId);

      if (!appointment) {
        throw createInternalError();
      }

      return appointment;
    },

    async getFacilityStatus(id, executor = db) {
      const result = await executor.query<AppointmentStatusRow>(
        `
          SELECT id, is_active
          FROM healthcare_facilities
          WHERE id = $1
        `,
        [id],
      );

      return result.rows[0] ?? null;
    },

    async getPractitionerStatus(id, executor = db) {
      const result = await executor.query<AppointmentStatusRow>(
        `
          SELECT id, is_active
          FROM practitioners
          WHERE id = $1
        `,
        [id],
      );

      return result.rows[0] ?? null;
    },

    async getPatientStatus(id, executor = db) {
      const result = await executor.query<AppointmentStatusRow>(
        `
          SELECT id, is_active
          FROM patients
          WHERE id = $1
        `,
        [id],
      );

      return result.rows[0] ?? null;
    },

    async getActivePractitionerAssignment(
      practitionerId,
      facilityId,
      executor = db,
    ) {
      const result = await executor.query<PractitionerAssignmentStatusRow>(
        `
          SELECT id
          FROM practitioner_facility_assignments
          WHERE practitioner_id = $1
            AND facility_id = $2
            AND is_active = true
          LIMIT 1
        `,
        [practitionerId, facilityId],
      );

      return result.rows[0] ?? null;
    },

    async getPatientRegistration(patientId, facilityId, executor = db) {
      const result = await executor.query<PatientRegistrationStatusRow>(
        `
          SELECT id
          FROM patient_facility_registrations
          WHERE patient_id = $1
            AND facility_id = $2
          LIMIT 1
        `,
        [patientId, facilityId],
      );

      return result.rows[0] ?? null;
    },

    async findConflictingAppointment(
      practitionerId,
      scheduledStart,
      scheduledEnd,
      excludeAppointmentId,
      executor = db,
    ) {
      const values: unknown[] = [practitionerId, scheduledStart, scheduledEnd];
      let excludeClause = '';

      if (excludeAppointmentId) {
        values.push(excludeAppointmentId);
        excludeClause = `AND a.id <> $4`;
      }

      const result = await executor.query<AppointmentRow>(
        `
          SELECT ${APPOINTMENT_SELECT_COLUMNS}
          FROM appointments a
          JOIN patients p ON p.id = a.patient_id
          JOIN patient_facility_registrations r
            ON r.patient_id = a.patient_id
           AND r.facility_id = a.facility_id
          JOIN practitioners pr ON pr.id = a.practitioner_id
          JOIN healthcare_facilities f ON f.id = a.facility_id
          WHERE a.practitioner_id = $1
            AND a.status IN ('SCHEDULED', 'CONFIRMED')
            AND tstzrange(a.scheduled_start, a.scheduled_end, '[)')
              && tstzrange($2::timestamptz, $3::timestamptz, '[)')
            ${excludeClause}
          LIMIT 1
        `,
        values,
      );

      return result.rows[0] ? mapAppointmentRow(result.rows[0]) : null;
    },
  };
}
