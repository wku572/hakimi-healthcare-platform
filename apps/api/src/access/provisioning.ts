import type { Pool } from 'pg';
import { z } from 'zod';
import type { DbExecutor } from '../database-executor.js';

const actorIdSchema = z.string().uuid();
const practitionerIdSchema = z.string().uuid();
const facilityIdSchema = z.string().uuid();
const roleSchema = z.enum([
  'PLATFORM_ADMIN',
  'FACILITY_ADMIN',
  'SCHEDULER',
  'PRACTITIONER',
  'OPERATIONS_OPERATOR',
]);

const provisionActorSchema = z
  .object({
    action: z.literal('PROVISION_ACTOR'),
    oidcIssuer: z.string().min(1).max(500).url(),
    oidcSubject: z.string().min(1).max(255),
    practitionerId: practitionerIdSchema.optional(),
  })
  .strict();

const actorActionSchema = z
  .object({
    action: z.enum(['ACTIVATE_ACTOR', 'DEACTIVATE_ACTOR', 'REVOKE_SESSIONS']),
    actorId: actorIdSchema,
  })
  .strict();

const bindPractitionerSchema = z
  .object({
    action: z.literal('BIND_PRACTITIONER'),
    actorId: actorIdSchema,
    practitionerId: practitionerIdSchema,
  })
  .strict();

const roleActionSchema = z
  .object({
    action: z.enum(['ASSIGN_ROLE', 'DEACTIVATE_ROLE']),
    actorId: actorIdSchema,
    role: roleSchema,
    facilityId: facilityIdSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    const isFacilityScoped =
      value.role === 'FACILITY_ADMIN' || value.role === 'SCHEDULER';

    if (isFacilityScoped !== (value.facilityId !== undefined)) {
      context.addIssue({
        code: 'custom',
        path: ['facilityId'],
        message: 'Role and facility scope do not match',
      });
    }
  });

const facilityRevocationRecoverySchema = z
  .object({
    action: z.literal('REVOKE_FACILITY_SESSIONS'),
    facilityId: facilityIdSchema,
  })
  .strict();

const practitionerRevocationRecoverySchema = z
  .object({
    action: z.literal('REVOKE_PRACTITIONER_SESSIONS'),
    practitionerId: practitionerIdSchema,
  })
  .strict();

const assignmentRevocationRecoverySchema = z
  .object({
    action: z.literal('REVOKE_ASSIGNMENT_SESSIONS'),
    assignmentId: z.string().uuid(),
  })
  .strict();

export const provisioningCommandSchema = z.discriminatedUnion('action', [
  provisionActorSchema,
  actorActionSchema,
  bindPractitionerSchema,
  roleActionSchema,
  facilityRevocationRecoverySchema,
  practitionerRevocationRecoverySchema,
  assignmentRevocationRecoverySchema,
]);

export type ProvisioningCommand = z.infer<typeof provisioningCommandSchema>;

type ProvisioningResult = Readonly<{
  affectedCount: number;
}>;

async function revokeActorSessions(
  db: DbExecutor,
  actorId: string,
  reason:
    | 'ACTOR_DEACTIVATED'
    | 'ROLE_CHANGED'
    | 'FACILITY_SCOPE_CHANGED'
    | 'PRACTITIONER_BINDING_CHANGED'
    | 'MANUAL_REVOCATION',
) {
  const result = await db.query<{ id: string }>(
    `
      WITH locked_sessions AS MATERIALIZED (
        SELECT id
        FROM workforce_sessions
        WHERE actor_id = $1
          AND revoked_at IS NULL
        ORDER BY id
        FOR UPDATE
      )
      UPDATE workforce_sessions
      SET revoked_at = now(),
          revocation_reason = $2,
          updated_at = now()
      WHERE id IN (SELECT id FROM locked_sessions)
      RETURNING id
    `,
    [actorId, reason],
  );
  return result.rows.length;
}

async function lockActor(db: DbExecutor, actorId: string) {
  const result = await db.query<{ id: string }>(
    `
      SELECT id
      FROM workforce_actors
      WHERE id = $1
      FOR UPDATE
    `,
    [actorId],
  );

  if (!result.rows[0]) {
    throw new Error('PROVISIONING_TARGET_NOT_FOUND');
  }
}

async function recoverFacilityRevocation(db: DbExecutor, facilityId: string) {
  const result = await db.query<{ id: string }>(
    `
      WITH affected_actor_ids AS MATERIALIZED (
        SELECT role.actor_id AS id
        FROM workforce_role_assignments role
        WHERE role.facility_id = $1
        UNION
        SELECT actor.id
        FROM workforce_actors actor
        JOIN practitioner_facility_assignments assignment
          ON assignment.practitioner_id = actor.practitioner_id
        WHERE assignment.facility_id = $1
      ),
      locked_actors AS MATERIALIZED (
        SELECT actor.id
        FROM workforce_actors actor
        JOIN affected_actor_ids affected ON affected.id = actor.id
        ORDER BY actor.id
        FOR UPDATE OF actor
      ),
      locked_sessions AS MATERIALIZED (
        SELECT session.id
        FROM workforce_sessions session
        JOIN locked_actors actor ON actor.id = session.actor_id
        WHERE session.revoked_at IS NULL
        ORDER BY session.id
        FOR UPDATE OF session
      )
      UPDATE workforce_sessions session
      SET revoked_at = now(),
          revocation_reason = 'FACILITY_SCOPE_CHANGED',
          updated_at = now()
      WHERE session.id IN (SELECT id FROM locked_sessions)
      RETURNING session.id
    `,
    [facilityId],
  );
  return result.rows.length;
}

async function recoverPractitionerRevocation(
  db: DbExecutor,
  practitionerId: string,
) {
  const result = await db.query<{ id: string }>(
    `
      WITH locked_actors AS MATERIALIZED (
        SELECT actor.id
        FROM workforce_actors actor
        WHERE actor.practitioner_id = $1
        ORDER BY actor.id
        FOR UPDATE OF actor
      ),
      locked_sessions AS MATERIALIZED (
        SELECT session.id
        FROM workforce_sessions session
        JOIN locked_actors actor ON actor.id = session.actor_id
        WHERE session.revoked_at IS NULL
        ORDER BY session.id
        FOR UPDATE OF session
      )
      UPDATE workforce_sessions session
      SET revoked_at = now(),
          revocation_reason = 'PRACTITIONER_STATE_CHANGED',
          updated_at = now()
      WHERE session.id IN (SELECT id FROM locked_sessions)
      RETURNING session.id
    `,
    [practitionerId],
  );
  return result.rows.length;
}

async function recoverAssignmentRevocation(
  db: DbExecutor,
  assignmentId: string,
) {
  const result = await db.query<{ id: string }>(
    `
      WITH affected_actor_ids AS MATERIALIZED (
        SELECT actor.id
        FROM workforce_actors actor
        JOIN practitioner_facility_assignments assignment
          ON assignment.practitioner_id = actor.practitioner_id
        WHERE assignment.id = $1
      ),
      locked_actors AS MATERIALIZED (
        SELECT actor.id
        FROM workforce_actors actor
        JOIN affected_actor_ids affected ON affected.id = actor.id
        ORDER BY actor.id
        FOR UPDATE OF actor
      ),
      locked_sessions AS MATERIALIZED (
        SELECT session.id
        FROM workforce_sessions session
        JOIN locked_actors actor ON actor.id = session.actor_id
        WHERE session.revoked_at IS NULL
        ORDER BY session.id
        FOR UPDATE OF session
      )
      UPDATE workforce_sessions session
      SET revoked_at = now(),
          revocation_reason = 'PRACTITIONER_ASSIGNMENT_CHANGED',
          updated_at = now()
      WHERE session.id IN (SELECT id FROM locked_sessions)
      RETURNING session.id
    `,
    [assignmentId],
  );
  return result.rows.length;
}

export function createProvisioningService(pool: Pick<Pool, 'connect'>) {
  return async function executeProvisioningCommand(
    command: ProvisioningCommand,
  ): Promise<ProvisioningResult> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      let affectedCount = 0;

      if (command.action === 'PROVISION_ACTOR') {
        if (command.practitionerId) {
          const practitioner = await client.query<{ id: string }>(
            `
              SELECT id
              FROM practitioners
              WHERE id = $1
                AND is_active = true
              FOR UPDATE
            `,
            [command.practitionerId],
          );

          if (!practitioner.rows[0]) {
            throw new Error('PROVISIONING_TARGET_NOT_FOUND');
          }
        }

        const actor = await client.query<{ id: string }>(
          `
            INSERT INTO workforce_actors (
              oidc_issuer,
              oidc_subject,
              practitioner_id
            )
            VALUES ($1, $2, $3)
            RETURNING id
          `,
          [
            command.oidcIssuer,
            command.oidcSubject,
            command.practitionerId ?? null,
          ],
        );
        affectedCount = actor.rows.length;
      } else if (command.action === 'REVOKE_FACILITY_SESSIONS') {
        affectedCount = await recoverFacilityRevocation(
          client,
          command.facilityId,
        );
      } else if (command.action === 'REVOKE_PRACTITIONER_SESSIONS') {
        affectedCount = await recoverPractitionerRevocation(
          client,
          command.practitionerId,
        );
      } else if (command.action === 'REVOKE_ASSIGNMENT_SESSIONS') {
        affectedCount = await recoverAssignmentRevocation(
          client,
          command.assignmentId,
        );
      } else {
        await lockActor(client, command.actorId);

        if (command.action === 'ACTIVATE_ACTOR') {
          const result = await client.query<{ id: string }>(
            `
              UPDATE workforce_actors
              SET is_active = true,
                  activated_at = now(),
                  deactivated_at = NULL,
                  updated_at = now()
              WHERE id = $1
                AND is_active = false
              RETURNING id
            `,
            [command.actorId],
          );
          affectedCount = result.rows.length;
        }

        if (command.action === 'DEACTIVATE_ACTOR') {
          const result = await client.query<{ id: string }>(
            `
              UPDATE workforce_actors
              SET is_active = false,
                  deactivated_at = COALESCE(deactivated_at, now()),
                  updated_at = now()
              WHERE id = $1
              RETURNING id
            `,
            [command.actorId],
          );
          affectedCount =
            result.rows.length +
            (await revokeActorSessions(
              client,
              command.actorId,
              'ACTOR_DEACTIVATED',
            ));
        }

        if (command.action === 'BIND_PRACTITIONER') {
          const practitioners = await client.query<{
            id: string;
            is_active: boolean;
          }>(
            `
              SELECT practitioner.id, practitioner.is_active
              FROM practitioners practitioner
              WHERE practitioner.id IN (
                $2,
                (
                  SELECT actor.practitioner_id
                  FROM workforce_actors actor
                  WHERE actor.id = $1
                )
              )
              ORDER BY practitioner.id
              FOR UPDATE OF practitioner
            `,
            [command.actorId, command.practitionerId],
          );

          if (
            !practitioners.rows.some(
              (practitioner) =>
                practitioner.id === command.practitionerId &&
                practitioner.is_active,
            )
          ) {
            throw new Error('PROVISIONING_TARGET_NOT_FOUND');
          }

          const result = await client.query<{ id: string }>(
            `
              UPDATE workforce_actors
              SET practitioner_id = $2,
                  activated_at = now(),
                  updated_at = now()
              WHERE id = $1
              RETURNING id
            `,
            [command.actorId, command.practitionerId],
          );
          affectedCount =
            result.rows.length +
            (await revokeActorSessions(
              client,
              command.actorId,
              'PRACTITIONER_BINDING_CHANGED',
            ));
        }

        if (command.action === 'ASSIGN_ROLE') {
          if (command.role === 'PRACTITIONER') {
            const practitioner = await client.query<{ id: string }>(
              `
                SELECT practitioner.id
                FROM workforce_actors actor
                JOIN practitioners practitioner
                  ON practitioner.id = actor.practitioner_id
                 AND practitioner.is_active = true
                WHERE actor.id = $1
                FOR UPDATE OF practitioner
              `,
              [command.actorId],
            );

            if (!practitioner.rows[0]) {
              throw new Error('PROVISIONING_TARGET_NOT_FOUND');
            }
          }

          if (command.facilityId) {
            const facility = await client.query<{ id: string }>(
              `
                SELECT id
                FROM healthcare_facilities
                WHERE id = $1
                  AND is_active = true
                FOR UPDATE
              `,
              [command.facilityId],
            );

            if (!facility.rows[0]) {
              throw new Error('PROVISIONING_TARGET_NOT_FOUND');
            }
          }

          const result = command.facilityId
            ? await client.query<{ id: string }>(
                `
                  INSERT INTO workforce_role_assignments (
                    actor_id,
                    role,
                    facility_id
                  )
                  VALUES ($1, $2, $3)
                  ON CONFLICT (actor_id, role, facility_id)
                    WHERE facility_id IS NOT NULL
                  DO UPDATE SET
                    is_active = true,
                    activated_at = now(),
                    deactivated_at = NULL,
                    updated_at = now()
                  RETURNING id
                `,
                [command.actorId, command.role, command.facilityId],
              )
            : await client.query<{ id: string }>(
                `
                INSERT INTO workforce_role_assignments (
                  actor_id,
                  role,
                  facility_id
                )
                VALUES ($1, $2, NULL)
                ON CONFLICT (actor_id, role)
                  WHERE facility_id IS NULL
                DO UPDATE SET
                  is_active = true,
                  activated_at = now(),
                  deactivated_at = NULL,
                  updated_at = now()
                RETURNING id
              `,
                [command.actorId, command.role],
              );
          affectedCount =
            result.rows.length +
            (await revokeActorSessions(
              client,
              command.actorId,
              command.facilityId ? 'FACILITY_SCOPE_CHANGED' : 'ROLE_CHANGED',
            ));
        }

        if (command.action === 'DEACTIVATE_ROLE') {
          const result = await client.query<{ id: string }>(
            `
              UPDATE workforce_role_assignments
              SET is_active = false,
                  deactivated_at = COALESCE(deactivated_at, now()),
                  updated_at = now()
              WHERE actor_id = $1
                AND role = $2
                AND facility_id IS NOT DISTINCT FROM $3::uuid
              RETURNING id
            `,
            [command.actorId, command.role, command.facilityId ?? null],
          );

          if (!result.rows[0]) {
            throw new Error('PROVISIONING_TARGET_NOT_FOUND');
          }

          affectedCount =
            result.rows.length +
            (await revokeActorSessions(
              client,
              command.actorId,
              command.facilityId ? 'FACILITY_SCOPE_CHANGED' : 'ROLE_CHANGED',
            ));
        }

        if (command.action === 'REVOKE_SESSIONS') {
          affectedCount = await revokeActorSessions(
            client,
            command.actorId,
            'MANUAL_REVOCATION',
          );
        }
      }

      await client.query('COMMIT');
      return Object.freeze({ affectedCount });
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Preserve the original opaque provisioning failure.
      }
      throw error;
    } finally {
      client.release();
    }
  };
}
