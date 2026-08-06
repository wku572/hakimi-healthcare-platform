import type { AppointmentStatus } from '@hakimi/shared';
import type { Pool } from 'pg';
import { createInternalError } from '../http/api-error.js';
import type { DbExecutor } from '../database-executor.js';
import type {
  AppointmentReminder,
  AppointmentReminderProcessingContext,
  ReminderKind,
  ReminderStatus,
} from './types.js';

type ReminderRow = {
  id: string;
  appointment_id: string;
  reminder_kind: string;
  schedule_version: number;
  idempotency_key: string;
  available_at: Date | string;
  status: string;
  attempt_count: number;
  max_attempts: number;
  locked_at: Date | string | null;
  locked_until: Date | string | null;
  locked_by: string | null;
  lease_token: string | null;
  last_error_category: string | null;
  delivered_at: Date | string | null;
  cancelled_at: Date | string | null;
  superseded_at: Date | string | null;
  dead_lettered_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type ReminderProcessingRow = ReminderRow & {
  appointment_schedule_version: number;
  appointment_status: string;
  appointment_scheduled_start: Date | string;
  appointment_scheduled_end: Date | string;
};

type AppointmentReminderClaimRow = ReminderProcessingRow;

function toIsoString(value: Date | string | null) {
  if (value === null) {
    return null;
  }

  return new Date(value).toISOString();
}

function mapReminderRow(row: ReminderRow): AppointmentReminder {
  return {
    id: row.id,
    appointmentId: row.appointment_id,
    reminderKind: row.reminder_kind as ReminderKind,
    scheduleVersion: row.schedule_version,
    idempotencyKey: row.idempotency_key,
    availableAt: toIsoString(row.available_at)!,
    status: row.status as ReminderStatus,
    attemptCount: row.attempt_count,
    maxAttempts: row.max_attempts,
    lockedAt: toIsoString(row.locked_at),
    lockedUntil: toIsoString(row.locked_until),
    lockedBy: row.locked_by,
    leaseToken: row.lease_token,
    lastErrorCategory: row.last_error_category,
    deliveredAt: toIsoString(row.delivered_at),
    cancelledAt: toIsoString(row.cancelled_at),
    supersededAt: toIsoString(row.superseded_at),
    deadLetteredAt: toIsoString(row.dead_lettered_at),
    createdAt: toIsoString(row.created_at)!,
    updatedAt: toIsoString(row.updated_at)!,
  };
}

function mapProcessingRow(
  row: ReminderProcessingRow,
): AppointmentReminderProcessingContext {
  const reminder = mapReminderRow(row);

  return {
    ...reminder,
    appointmentScheduleVersion: row.appointment_schedule_version,
    appointmentStatus: row.appointment_status as AppointmentStatus,
    appointmentScheduledStart: toIsoString(row.appointment_scheduled_start)!,
    appointmentScheduledEnd: toIsoString(row.appointment_scheduled_end)!,
    appointmentIsStarted:
      new Date(row.appointment_scheduled_start).getTime() <= Date.now(),
  };
}

async function queryReminderById(
  db: DbExecutor,
  id: string,
): Promise<AppointmentReminder | null> {
  const result = await db.query<ReminderRow>(
    `
      SELECT
        id,
        appointment_id,
        reminder_kind,
        schedule_version,
        idempotency_key,
        available_at,
        status,
        attempt_count,
        max_attempts,
        locked_at,
        locked_until,
        locked_by,
        lease_token,
        last_error_category,
        delivered_at,
        cancelled_at,
        superseded_at,
        dead_lettered_at,
        created_at,
        updated_at
      FROM appointment_reminders
      WHERE id = $1
    `,
    [id],
  );

  return result.rows[0] ? mapReminderRow(result.rows[0]) : null;
}

async function queryReminderProcessingContextById(
  db: DbExecutor,
  id: string,
): Promise<AppointmentReminderProcessingContext | null> {
  const result = await db.query<ReminderProcessingRow>(
    `
      SELECT
        r.id,
        r.appointment_id,
        r.reminder_kind,
        r.schedule_version,
        r.idempotency_key,
        r.available_at,
        r.status,
        r.attempt_count,
        r.max_attempts,
        r.locked_at,
        r.locked_until,
        r.locked_by,
        r.lease_token,
        r.last_error_category,
        r.delivered_at,
        r.cancelled_at,
        r.superseded_at,
        r.dead_lettered_at,
        r.created_at,
        r.updated_at,
        a.schedule_version AS appointment_schedule_version,
        a.status AS appointment_status,
        a.scheduled_start AS appointment_scheduled_start,
        a.scheduled_end AS appointment_scheduled_end
      FROM appointment_reminders r
      JOIN appointments a ON a.id = r.appointment_id
      WHERE r.id = $1
    `,
    [id],
  );

  return result.rows[0] ? mapProcessingRow(result.rows[0]) : null;
}

export type CreateAppointmentReminderInput = {
  appointmentId: string;
  reminderKind: ReminderKind;
  scheduleVersion: number;
  idempotencyKey: string;
  availableAt: string;
};

export type ReminderRepository = {
  withTransaction<T>(work: (db: DbExecutor) => Promise<T>): Promise<T>;
  createAppointmentReminder(
    input: CreateAppointmentReminderInput,
    db?: DbExecutor,
  ): Promise<AppointmentReminder | null>;
  findAppointmentReminderById(
    id: string,
    db?: DbExecutor,
  ): Promise<AppointmentReminder | null>;
  findAppointmentReminderProcessingContextById(
    id: string,
    db?: DbExecutor,
  ): Promise<AppointmentReminderProcessingContext | null>;
  claimDueReminders(
    input: {
      workerId: string;
      batchSize: number;
      now: string;
      leaseUntil: string;
    },
    db?: DbExecutor,
  ): Promise<AppointmentReminderProcessingContext[]>;
  cancelActiveAppointmentReminders(
    appointmentId: string,
    db?: DbExecutor,
  ): Promise<number>;
  supersedeAppointmentReminders(
    appointmentId: string,
    scheduleVersion: number,
    db?: DbExecutor,
  ): Promise<number>;
  markReminderDelivered(
    id: string,
    leaseToken: string,
    db?: DbExecutor,
  ): Promise<boolean>;
  markReminderRetry(
    id: string,
    leaseToken: string,
    nextAvailableAt: string,
    errorCategory: string,
    db?: DbExecutor,
  ): Promise<boolean>;
  markReminderCancelled(
    id: string,
    leaseToken: string,
    errorCategory: string,
    db?: DbExecutor,
  ): Promise<boolean>;
  markReminderDeadLetter(
    id: string,
    leaseToken: string,
    errorCategory: string,
    db?: DbExecutor,
  ): Promise<boolean>;
  deadLetterExhaustedReminders(
    db?: DbExecutor,
  ): Promise<AppointmentReminderProcessingContext[]>;
};

export function createReminderRepository(
  db: Pick<Pool, 'query' | 'connect'>,
): ReminderRepository {
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

    async createAppointmentReminder(input, executor = db) {
      try {
        const result = await executor.query<ReminderRow>(
          `
            INSERT INTO appointment_reminders (
              appointment_id,
              reminder_kind,
              schedule_version,
              idempotency_key,
              available_at
            )
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT DO NOTHING
            RETURNING
              id,
              appointment_id,
              reminder_kind,
              schedule_version,
              idempotency_key,
              available_at,
              status,
              attempt_count,
              max_attempts,
              locked_at,
              locked_until,
              locked_by,
              lease_token,
              last_error_category,
              delivered_at,
              cancelled_at,
              superseded_at,
              dead_lettered_at,
              created_at,
              updated_at
          `,
          [
            input.appointmentId,
            input.reminderKind,
            input.scheduleVersion,
            input.idempotencyKey,
            input.availableAt,
          ],
        );

        return result.rows[0] ? mapReminderRow(result.rows[0]) : null;
      } catch {
        throw createInternalError();
      }
    },

    async findAppointmentReminderById(id, executor = db) {
      return queryReminderById(executor, id);
    },

    async findAppointmentReminderProcessingContextById(id, executor = db) {
      return queryReminderProcessingContextById(executor, id);
    },

    async claimDueReminders(input, executor = db) {
      const result = await executor.query<AppointmentReminderClaimRow>(
        `
          WITH candidates AS (
            SELECT id
            FROM appointment_reminders
            WHERE (
                status = 'PENDING'
                AND available_at <= $1::timestamptz
                AND attempt_count < max_attempts
              )
              OR (
                status = 'PROCESSING'
                AND locked_until IS NOT NULL
                AND locked_until <= $1::timestamptz
                AND attempt_count < max_attempts
              )
            ORDER BY available_at ASC, id ASC
            LIMIT $2
            FOR UPDATE SKIP LOCKED
          ),
          claimed AS (
            UPDATE appointment_reminders r
            SET
              status = 'PROCESSING',
              attempt_count = r.attempt_count + 1,
              locked_at = $1::timestamptz,
              locked_until = $3::timestamptz,
              locked_by = $4,
              lease_token = uuidv7(),
              updated_at = now()
            FROM candidates c
            WHERE r.id = c.id
            RETURNING r.id
          )
          SELECT
            r.id,
            r.appointment_id,
            r.reminder_kind,
            r.schedule_version,
            r.idempotency_key,
            r.available_at,
            r.status,
            r.attempt_count,
            r.max_attempts,
            r.locked_at,
            r.locked_until,
            r.locked_by,
            r.lease_token,
            r.last_error_category,
            r.delivered_at,
            r.cancelled_at,
            r.superseded_at,
            r.dead_lettered_at,
            r.created_at,
            r.updated_at,
            a.schedule_version AS appointment_schedule_version,
            a.status AS appointment_status,
            a.scheduled_start AS appointment_scheduled_start,
            a.scheduled_end AS appointment_scheduled_end
          FROM appointment_reminders r
          JOIN claimed c ON c.id = r.id
          JOIN appointments a ON a.id = r.appointment_id
          ORDER BY r.available_at ASC, r.id ASC
        `,
        [input.now, input.batchSize, input.leaseUntil, input.workerId],
      );

      return result.rows.map(mapProcessingRow);
    },

    async cancelActiveAppointmentReminders(appointmentId, executor = db) {
      const result = await executor.query<{ id: string }>(
        `
          UPDATE appointment_reminders
          SET
            status = 'CANCELLED',
            cancelled_at = COALESCE(cancelled_at, now()),
            locked_at = NULL,
            locked_until = NULL,
            locked_by = NULL,
            lease_token = NULL,
            updated_at = now()
          WHERE appointment_id = $1
            AND reminder_kind = 'APPOINTMENT_24H'
            AND status IN ('PENDING', 'PROCESSING')
          RETURNING id
        `,
        [appointmentId],
      );

      return result.rows.length;
    },

    async supersedeAppointmentReminders(
      appointmentId,
      scheduleVersion,
      executor = db,
    ) {
      const result = await executor.query<{ id: string }>(
        `
          UPDATE appointment_reminders
          SET
            status = 'SUPERSEDED',
            superseded_at = COALESCE(superseded_at, now()),
            locked_at = NULL,
            locked_until = NULL,
            locked_by = NULL,
            lease_token = NULL,
            updated_at = now()
          WHERE appointment_id = $1
            AND reminder_kind = 'APPOINTMENT_24H'
            AND schedule_version < $2
            AND status IN ('PENDING', 'PROCESSING')
          RETURNING id
        `,
        [appointmentId, scheduleVersion],
      );

      return result.rows.length;
    },

    async markReminderDelivered(id, leaseToken, executor = db) {
      const result = await executor.query<{ id: string }>(
        `
          UPDATE appointment_reminders
          SET
            status = 'DELIVERED',
            delivered_at = COALESCE(delivered_at, now()),
            locked_at = NULL,
            locked_until = NULL,
            locked_by = NULL,
            lease_token = NULL,
            updated_at = now()
          WHERE id = $1
            AND status = 'PROCESSING'
            AND lease_token = $2
          RETURNING id
        `,
        [id, leaseToken],
      );

      return result.rows.length === 1;
    },

    async markReminderRetry(
      id,
      leaseToken,
      nextAvailableAt,
      errorCategory,
      executor = db,
    ) {
      const result = await executor.query<{ id: string }>(
        `
          UPDATE appointment_reminders
          SET
            status = 'PENDING',
            available_at = $3::timestamptz,
            locked_at = NULL,
            locked_until = NULL,
            locked_by = NULL,
            lease_token = NULL,
            last_error_category = $4,
            updated_at = now()
          WHERE id = $1
            AND status = 'PROCESSING'
            AND lease_token = $2
          RETURNING id
        `,
        [id, leaseToken, nextAvailableAt, errorCategory],
      );

      return result.rows.length === 1;
    },

    async markReminderCancelled(id, leaseToken, errorCategory, executor = db) {
      const result = await executor.query<{ id: string }>(
        `
          UPDATE appointment_reminders
          SET
            status = 'CANCELLED',
            cancelled_at = COALESCE(cancelled_at, now()),
            locked_at = NULL,
            locked_until = NULL,
            locked_by = NULL,
            lease_token = NULL,
            last_error_category = $3,
            updated_at = now()
          WHERE id = $1
            AND status = 'PROCESSING'
            AND lease_token = $2
          RETURNING id
        `,
        [id, leaseToken, errorCategory],
      );

      return result.rows.length === 1;
    },

    async markReminderDeadLetter(id, leaseToken, errorCategory, executor = db) {
      const result = await executor.query<{ id: string }>(
        `
          UPDATE appointment_reminders
          SET
            status = 'DEAD_LETTER',
            dead_lettered_at = COALESCE(dead_lettered_at, now()),
            locked_at = NULL,
            locked_until = NULL,
            locked_by = NULL,
            lease_token = NULL,
            last_error_category = $3,
            updated_at = now()
          WHERE id = $1
            AND status = 'PROCESSING'
            AND lease_token = $2
          RETURNING id
        `,
        [id, leaseToken, errorCategory],
      );

      return result.rows.length === 1;
    },

    async deadLetterExhaustedReminders(executor = db) {
      const result = await executor.query<ReminderProcessingRow>(
        `
          WITH candidates AS (
            SELECT id
            FROM appointment_reminders
            WHERE (
                status = 'PENDING'
                AND available_at <= now()
                AND attempt_count >= max_attempts
              )
              OR (
                status = 'PROCESSING'
                AND locked_until IS NOT NULL
                AND locked_until <= now()
                AND attempt_count >= max_attempts
              )
            ORDER BY available_at ASC, id ASC
            LIMIT 100
            FOR UPDATE SKIP LOCKED
          ),
          updated AS (
            UPDATE appointment_reminders r
            SET
              status = 'DEAD_LETTER',
              dead_lettered_at = COALESCE(dead_lettered_at, now()),
              locked_at = NULL,
              locked_until = NULL,
              locked_by = NULL,
              lease_token = NULL,
              updated_at = now()
            FROM candidates c
            WHERE r.id = c.id
            RETURNING r.id
          )
          SELECT
            r.id,
            r.appointment_id,
            r.reminder_kind,
            r.schedule_version,
            r.idempotency_key,
            r.available_at,
            r.status,
            r.attempt_count,
            r.max_attempts,
            r.locked_at,
            r.locked_until,
            r.locked_by,
            r.lease_token,
            r.last_error_category,
            r.delivered_at,
            r.cancelled_at,
            r.superseded_at,
            r.dead_lettered_at,
            r.created_at,
            r.updated_at,
            a.schedule_version AS appointment_schedule_version,
            a.status AS appointment_status,
            a.scheduled_start AS appointment_scheduled_start,
            a.scheduled_end AS appointment_scheduled_end
          FROM appointment_reminders r
          JOIN updated u ON u.id = r.id
          JOIN appointments a ON a.id = r.appointment_id
          ORDER BY r.available_at ASC, r.id ASC
        `,
      );

      return result.rows.map(mapProcessingRow);
    },
  };
}
