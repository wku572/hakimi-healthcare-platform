import type { Pool, PoolClient } from 'pg';
import type { DbExecutor } from '../database-executor.js';
import type { ProtectedOperation } from './policy.js';
import {
  workforceRoles,
  type AuthorizationCandidate,
  type AuthorizationTarget,
  type RevocationReason,
  type VerifiedOidcIdentity,
  type WorkforceRole,
  type WorkforceRoleAssignment,
} from './types.js';

type CandidateRow = {
  actor_id: string;
  practitioner_id: string | null;
  authorization_time: Date | string;
  session_last_seen_at: Date | string | null;
  session_absolute_expires_at: Date | string | null;
  session_revoked_at: Date | string | null;
  roles: unknown;
  facility_scopes: string[] | null;
};

type SessionRow = { id: string };
type ExistsRow = { authorized: boolean };
type CurrentAuthorityRow = {
  practitioner_id: string | null;
  authorization_time: Date | string;
  roles: unknown;
  facility_scopes: string[] | null;
};

export type SessionAuthorizationResult =
  | Readonly<{
      status: 'AUTHORIZED';
      sessionId: string;
      candidate: AuthorizationCandidate;
    }>
  | Readonly<{ status: 'TARGET_NOT_AUTHORIZED' }>
  | Readonly<{ status: 'SESSION_NOT_ACTIVE' }>;

const INACTIVITY_MILLISECONDS = 30 * 60 * 1000;

function isWorkforceRole(value: unknown): value is WorkforceRole {
  return (
    typeof value === 'string' && workforceRoles.includes(value as WorkforceRole)
  );
}

function parseRoles(value: unknown): readonly WorkforceRoleAssignment[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const roles: WorkforceRoleAssignment[] = [];

  for (const item of value) {
    if (
      typeof item !== 'object' ||
      item === null ||
      !('role' in item) ||
      !isWorkforceRole(item.role)
    ) {
      continue;
    }

    const facilityId =
      'facilityId' in item && typeof item.facilityId === 'string'
        ? item.facilityId
        : null;
    roles.push(Object.freeze({ role: item.role, facilityId }));
  }

  return Object.freeze(roles);
}

function mapCandidate(
  row: CandidateRow,
  identity: VerifiedOidcIdentity,
): AuthorizationCandidate | null {
  const authorizationTime = new Date(row.authorization_time);

  if (row.session_revoked_at !== null) {
    return null;
  }

  if (row.session_absolute_expires_at !== null) {
    const absoluteExpiry = new Date(row.session_absolute_expires_at);
    const lastSeen = new Date(row.session_last_seen_at!);

    if (
      authorizationTime >= absoluteExpiry ||
      authorizationTime.getTime() - lastSeen.getTime() > INACTIVITY_MILLISECONDS
    ) {
      return null;
    }
  }

  return Object.freeze({
    actorId: row.actor_id,
    practitionerId: row.practitioner_id,
    sessionHash: identity.sessionHash,
    authenticatedAt: identity.authenticatedAt,
    authorizationTime,
    roles: parseRoles(row.roles),
    facilityScopes: Object.freeze([...(row.facility_scopes ?? [])]),
  });
}

export type AccessRepository = Readonly<{
  findAuthorizationCandidate(
    identity: VerifiedOidcIdentity,
  ): Promise<AuthorizationCandidate | null>;
  isTargetAuthorized(
    operation: ProtectedOperation,
    candidate: AuthorizationCandidate,
    target: AuthorizationTarget,
    executor?: DbExecutor,
  ): Promise<boolean>;
  touchSession(
    candidate: AuthorizationCandidate,
    operation: ProtectedOperation,
    target: AuthorizationTarget,
    permittedRoles: readonly WorkforceRole[],
  ): Promise<SessionAuthorizationResult>;
  revokeSessionsForFacility(
    facilityId: string,
    reason: RevocationReason,
  ): Promise<number>;
  revokeSessionsForPractitioner(
    practitionerId: string,
    reason: RevocationReason,
  ): Promise<number>;
  revokeSessionsForAssignment(
    assignmentId: string,
    reason: RevocationReason,
  ): Promise<number>;
}>;

async function queryAuthorized(db: DbExecutor, sql: string, values: unknown[]) {
  const result = await db.query<ExistsRow>(sql, values);
  return result.rows[0]?.authorized === true;
}

function actorIsPlatformAdminSql(
  actorParameter = '$1',
  authenticatedAtParameter = '$2',
) {
  return `EXISTS (
    SELECT 1
    FROM workforce_actors current_actor
    JOIN workforce_role_assignments current_assignment_role
      ON current_assignment_role.actor_id = current_actor.id
     AND current_assignment_role.is_active = true
     AND current_assignment_role.role = 'PLATFORM_ADMIN'
     AND current_assignment_role.activated_at <= ${authenticatedAtParameter}::timestamptz
    WHERE current_actor.id = ${actorParameter}
      AND current_actor.is_active = true
      AND current_actor.activated_at <= ${authenticatedAtParameter}::timestamptz
  )`;
}

function actorHasFacilityRoleSql(
  facilityExpression: string,
  roles: readonly ('FACILITY_ADMIN' | 'SCHEDULER')[],
  authenticatedAtParameter = '$3',
) {
  const roleList = roles.map((role) => `'${role}'`).join(', ');
  return `EXISTS (
    SELECT 1
    FROM workforce_actors current_actor
    JOIN workforce_role_assignments current_assignment_role
      ON current_assignment_role.actor_id = current_actor.id
     AND current_assignment_role.is_active = true
     AND current_assignment_role.role IN (${roleList})
     AND current_assignment_role.activated_at <= ${authenticatedAtParameter}::timestamptz
    JOIN healthcare_facilities current_facility
      ON current_facility.id = current_assignment_role.facility_id
     AND current_facility.is_active = true
    WHERE current_actor.id = $1
      AND current_actor.is_active = true
      AND current_actor.activated_at <= ${authenticatedAtParameter}::timestamptz
      AND current_assignment_role.facility_id = ${facilityExpression}
  )`;
}

function actorIsPractitionerForAppointmentSql(
  appointmentExpression: string,
  authenticatedAtParameter = '$3',
) {
  return `EXISTS (
    SELECT 1
    FROM workforce_actors current_actor
    JOIN workforce_role_assignments current_assignment_role
      ON current_assignment_role.actor_id = current_actor.id
     AND current_assignment_role.is_active = true
     AND current_assignment_role.role = 'PRACTITIONER'
     AND current_assignment_role.activated_at <= ${authenticatedAtParameter}::timestamptz
    JOIN practitioners current_practitioner
      ON current_practitioner.id = current_actor.practitioner_id
     AND current_practitioner.is_active = true
    JOIN appointments scoped_appointment
      ON scoped_appointment.id = ${appointmentExpression}
     AND scoped_appointment.practitioner_id = current_practitioner.id
    JOIN healthcare_facilities current_facility
      ON current_facility.id = scoped_appointment.facility_id
     AND current_facility.is_active = true
    JOIN practitioner_facility_assignments current_assignment
      ON current_assignment.practitioner_id = current_practitioner.id
     AND current_assignment.facility_id = scoped_appointment.facility_id
     AND current_assignment.is_active = true
    WHERE current_actor.id = $1
      AND current_actor.is_active = true
      AND current_actor.activated_at <= ${authenticatedAtParameter}::timestamptz
  )`;
}

async function lockAuthorizationTarget(
  client: PoolClient,
  candidate: AuthorizationCandidate,
  target: AuthorizationTarget,
) {
  const actor = await client.query<{ id: string }>(
    `
      SELECT id
      FROM workforce_actors
      WHERE id = $1
        AND is_active = true
      FOR UPDATE
    `,
    [candidate.actorId],
  );

  if (!actor.rows[0]) {
    return false;
  }

  if (target.facilityId) {
    await client.query(
      'SELECT id FROM healthcare_facilities WHERE id = $1 FOR SHARE',
      [target.facilityId],
    );
  }

  if (target.practitionerId) {
    await client.query('SELECT id FROM practitioners WHERE id = $1 FOR SHARE', [
      target.practitionerId,
    ]);
    await client.query(
      `
        SELECT assignment.id
        FROM practitioner_facility_assignments assignment
        WHERE assignment.practitioner_id IN (
          $1,
          (
            SELECT actor.practitioner_id
            FROM workforce_actors actor
            WHERE actor.id = $2
          )
        )
        ORDER BY assignment.id
        FOR SHARE OF assignment
      `,
      [target.practitionerId, candidate.actorId],
    );
  }

  if (target.patientId) {
    await client.query('SELECT id FROM patients WHERE id = $1 FOR SHARE', [
      target.patientId,
    ]);
    await client.query(
      `
        SELECT registration.id
        FROM patient_facility_registrations registration
        WHERE registration.patient_id = $1
        ORDER BY registration.id
        FOR SHARE OF registration
      `,
      [target.patientId],
    );
  }

  if (target.appointmentId) {
    await client.query('SELECT id FROM appointments WHERE id = $1 FOR SHARE', [
      target.appointmentId,
    ]);
    await client.query(
      `
        SELECT practitioner.id
        FROM appointments appointment
        JOIN practitioners practitioner
          ON practitioner.id = appointment.practitioner_id
        WHERE appointment.id = $1
        FOR SHARE OF practitioner
      `,
      [target.appointmentId],
    );
    await client.query(
      `
        SELECT facility.id
        FROM appointments appointment
        JOIN healthcare_facilities facility
          ON facility.id = appointment.facility_id
        WHERE appointment.id = $1
        FOR SHARE OF facility
      `,
      [target.appointmentId],
    );
  }

  if (target.assignmentId) {
    await client.query(
      `
        SELECT assignment.id
        FROM practitioner_facility_assignments assignment
        WHERE assignment.id = $1
        FOR SHARE OF assignment
      `,
      [target.assignmentId],
    );
  }

  if (target.facilityId) {
    await client.query(
      `
        SELECT assignment.id
        FROM practitioner_facility_assignments assignment
        JOIN workforce_actors actor
          ON actor.practitioner_id = assignment.practitioner_id
        WHERE actor.id = $1
          AND assignment.facility_id = $2
        ORDER BY assignment.id
        FOR SHARE OF assignment
      `,
      [candidate.actorId, target.facilityId],
    );
  }

  if (target.appointmentId) {
    await client.query(
      `
        SELECT assignment.id
        FROM appointments appointment
        JOIN practitioner_facility_assignments assignment
          ON assignment.practitioner_id = appointment.practitioner_id
         AND assignment.facility_id = appointment.facility_id
        WHERE appointment.id = $1
        ORDER BY assignment.id
        FOR SHARE OF assignment
      `,
      [target.appointmentId],
    );
  }

  return true;
}

async function refreshAuthorizationCandidate(
  db: DbExecutor,
  candidate: AuthorizationCandidate,
) {
  const result = await db.query<CurrentAuthorityRow>(
    `
      SELECT
        actor.practitioner_id,
        now() AS authorization_time,
        COALESCE((
          SELECT json_agg(
            json_build_object(
              'role', active_role.role,
              'facilityId', active_role.facility_id
            )
            ORDER BY active_role.role, active_role.facility_id
          )
          FROM workforce_role_assignments active_role
          LEFT JOIN healthcare_facilities role_facility
            ON role_facility.id = active_role.facility_id
          WHERE active_role.actor_id = actor.id
            AND active_role.is_active = true
            AND active_role.activated_at <= $2::timestamptz
            AND (
              active_role.facility_id IS NULL
              OR (
                role_facility.is_active = true
              )
            )
            AND (
              active_role.role <> 'PRACTITIONER'
              OR EXISTS (
                SELECT 1
                FROM practitioners linked_practitioner
                WHERE linked_practitioner.id = actor.practitioner_id
                  AND linked_practitioner.is_active = true
              )
            )
        ), '[]'::json) AS roles,
        COALESCE((
          SELECT array_agg(DISTINCT scopes.facility_id ORDER BY scopes.facility_id)
          FROM (
            SELECT administrative_role.facility_id
            FROM workforce_role_assignments administrative_role
            JOIN healthcare_facilities administrative_facility
              ON administrative_facility.id = administrative_role.facility_id
             AND administrative_facility.is_active = true
            WHERE administrative_role.actor_id = actor.id
              AND administrative_role.is_active = true
              AND administrative_role.activated_at <= $2::timestamptz
              AND administrative_role.role IN ('FACILITY_ADMIN', 'SCHEDULER')
            UNION
            SELECT practitioner_assignment.facility_id
            FROM practitioner_facility_assignments practitioner_assignment
            JOIN practitioners linked_practitioner
              ON linked_practitioner.id = actor.practitioner_id
             AND linked_practitioner.is_active = true
            JOIN healthcare_facilities practitioner_facility
              ON practitioner_facility.id = practitioner_assignment.facility_id
             AND practitioner_facility.is_active = true
            WHERE practitioner_assignment.practitioner_id = actor.practitioner_id
              AND practitioner_assignment.is_active = true
              AND EXISTS (
                SELECT 1
                FROM workforce_role_assignments practitioner_role
                WHERE practitioner_role.actor_id = actor.id
                  AND practitioner_role.role = 'PRACTITIONER'
                  AND practitioner_role.is_active = true
                  AND practitioner_role.activated_at <= $2::timestamptz
              )
          ) scopes
        ), ARRAY[]::uuid[]) AS facility_scopes
      FROM workforce_actors actor
      WHERE actor.id = $1
        AND actor.is_active = true
        AND actor.activated_at <= $2::timestamptz
    `,
    [candidate.actorId, candidate.authenticatedAt],
  );
  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return Object.freeze({
    actorId: candidate.actorId,
    practitionerId: row.practitioner_id,
    sessionHash: candidate.sessionHash,
    authenticatedAt: candidate.authenticatedAt,
    authorizationTime: new Date(row.authorization_time),
    roles: parseRoles(row.roles),
    facilityScopes: Object.freeze([...(row.facility_scopes ?? [])]),
  });
}

export function createAccessRepository(
  db: Pick<Pool, 'query' | 'connect'>,
): AccessRepository {
  const repository: AccessRepository = {
    async findAuthorizationCandidate(identity) {
      const result = await db.query<CandidateRow>(
        `
          SELECT
            actor.id AS actor_id,
            actor.practitioner_id,
            now() AS authorization_time,
            session.last_seen_at AS session_last_seen_at,
            session.absolute_expires_at AS session_absolute_expires_at,
            session.revoked_at AS session_revoked_at,
            COALESCE((
              SELECT json_agg(
                json_build_object(
                  'role', active_role.role,
                  'facilityId', active_role.facility_id
                )
                ORDER BY active_role.role, active_role.facility_id
              )
              FROM workforce_role_assignments active_role
              LEFT JOIN healthcare_facilities role_facility
                ON role_facility.id = active_role.facility_id
              WHERE active_role.actor_id = actor.id
                AND active_role.is_active = true
                AND active_role.activated_at <= $4::timestamptz
                AND (
                  active_role.facility_id IS NULL
                  OR (
                    role_facility.is_active = true
                  )
                )
                AND (
                  active_role.role <> 'PRACTITIONER'
                  OR EXISTS (
                    SELECT 1
                    FROM practitioners linked_practitioner
                    WHERE linked_practitioner.id = actor.practitioner_id
                      AND linked_practitioner.is_active = true
                  )
                )
            ), '[]'::json) AS roles,
            COALESCE((
              SELECT array_agg(DISTINCT scopes.facility_id ORDER BY scopes.facility_id)
              FROM (
                SELECT administrative_role.facility_id
                FROM workforce_role_assignments administrative_role
                JOIN healthcare_facilities administrative_facility
                  ON administrative_facility.id = administrative_role.facility_id
                 AND administrative_facility.is_active = true
                WHERE administrative_role.actor_id = actor.id
                  AND administrative_role.is_active = true
                  AND administrative_role.activated_at <= $4::timestamptz
                  AND administrative_role.role IN ('FACILITY_ADMIN', 'SCHEDULER')
                UNION
                SELECT practitioner_assignment.facility_id
                FROM practitioner_facility_assignments practitioner_assignment
                JOIN practitioners linked_practitioner
                  ON linked_practitioner.id = actor.practitioner_id
                 AND linked_practitioner.is_active = true
                JOIN healthcare_facilities practitioner_facility
                  ON practitioner_facility.id = practitioner_assignment.facility_id
                 AND practitioner_facility.is_active = true
                WHERE practitioner_assignment.practitioner_id = actor.practitioner_id
                  AND practitioner_assignment.is_active = true
                  AND EXISTS (
                    SELECT 1
                    FROM workforce_role_assignments practitioner_role
                    WHERE practitioner_role.actor_id = actor.id
                      AND practitioner_role.role = 'PRACTITIONER'
                      AND practitioner_role.is_active = true
                      AND practitioner_role.activated_at <= $4::timestamptz
                  )
              ) scopes
            ), ARRAY[]::uuid[]) AS facility_scopes
          FROM workforce_actors actor
          LEFT JOIN workforce_sessions session
            ON session.actor_id = actor.id
           AND session.oidc_session_hash = $3
          WHERE actor.oidc_issuer = $1
            AND actor.oidc_subject = $2
            AND actor.is_active = true
            AND actor.activated_at <= $4::timestamptz
        `,
        [
          identity.issuer,
          identity.subject,
          identity.sessionHash,
          identity.authenticatedAt,
        ],
      );
      const row = result.rows[0];
      return row ? mapCandidate(row, identity) : null;
    },

    async isTargetAuthorized(operation, candidate, target, executor = db) {
      const actorId = candidate.actorId;
      const platformOnly = [
        'createHealthcareFacility',
        'deactivateHealthcareFacility',
        'createPractitioner',
        'updatePractitioner',
        'deactivatePractitioner',
      ].includes(operation);

      if (platformOnly) {
        return queryAuthorized(
          executor,
          `SELECT ${actorIsPlatformAdminSql()} AS authorized`,
          [actorId, candidate.authenticatedAt],
        );
      }

      if (
        operation === 'listHealthcareFacilities' ||
        operation === 'listPractitioners' ||
        operation === 'listPatients' ||
        operation === 'listAppointments'
      ) {
        return true;
      }

      if (operation === 'getHealthcareFacilityById') {
        return queryAuthorized(
          executor,
          `
            SELECT (
              ${actorIsPlatformAdminSql('$1', '$3')}
              OR ${actorHasFacilityRoleSql('$2::uuid', ['FACILITY_ADMIN', 'SCHEDULER'])}
              OR EXISTS (
                SELECT 1
                FROM workforce_actors current_actor
                JOIN workforce_role_assignments practitioner_role
                  ON practitioner_role.actor_id = current_actor.id
                 AND practitioner_role.role = 'PRACTITIONER'
                 AND practitioner_role.is_active = true
                 AND practitioner_role.activated_at <= $3::timestamptz
                JOIN practitioners linked_practitioner
                  ON linked_practitioner.id = current_actor.practitioner_id
                 AND linked_practitioner.is_active = true
                JOIN practitioner_facility_assignments current_assignment
                  ON current_assignment.practitioner_id = linked_practitioner.id
                 AND current_assignment.facility_id = $2
                 AND current_assignment.is_active = true
                JOIN healthcare_facilities current_facility
                  ON current_facility.id = current_assignment.facility_id
                 AND current_facility.is_active = true
                WHERE current_actor.id = $1
                  AND current_actor.is_active = true
                  AND current_actor.activated_at <= $3::timestamptz
              )
            ) AS authorized
          `,
          [actorId, target.facilityId, candidate.authenticatedAt],
        );
      }

      if (operation === 'updateHealthcareFacility') {
        return queryAuthorized(
          executor,
          `SELECT (
            ${actorIsPlatformAdminSql('$1', '$3')}
            OR ${actorHasFacilityRoleSql('$2::uuid', ['FACILITY_ADMIN'])}
          ) AS authorized`,
          [actorId, target.facilityId, candidate.authenticatedAt],
        );
      }

      if (operation === 'getPractitionerById') {
        return queryAuthorized(
          executor,
          `
            SELECT (
              ${actorIsPlatformAdminSql('$1', '$3')}
              OR EXISTS (
                SELECT 1
                FROM workforce_actors current_actor
                JOIN workforce_role_assignments current_assignment_role
                  ON current_assignment_role.actor_id = current_actor.id
                 AND current_assignment_role.is_active = true
                 AND current_assignment_role.activated_at <= $3::timestamptz
                JOIN practitioners target_practitioner
                  ON target_practitioner.id = $2
                 AND target_practitioner.is_active = true
                WHERE current_actor.id = $1
                  AND current_actor.is_active = true
                  AND current_actor.activated_at <= $3::timestamptz
                  AND (
                    (current_assignment_role.role = 'PRACTITIONER'
                      AND current_actor.practitioner_id = target_practitioner.id)
                    OR EXISTS (
                      SELECT 1
                      FROM practitioner_facility_assignments target_assignment
                      WHERE target_assignment.practitioner_id = target_practitioner.id
                        AND target_assignment.is_active = true
                        AND (
                          EXISTS (
                            SELECT 1
                            FROM workforce_role_assignments administrative_role
                            WHERE administrative_role.actor_id = current_actor.id
                              AND administrative_role.role IN ('FACILITY_ADMIN', 'SCHEDULER')
                              AND administrative_role.facility_id = target_assignment.facility_id
                              AND administrative_role.is_active = true
                              AND administrative_role.activated_at <= $3::timestamptz
                          )
                          OR (
                            current_assignment_role.role = 'PRACTITIONER'
                            AND EXISTS (
                              SELECT 1
                              FROM practitioner_facility_assignments own_assignment
                              WHERE own_assignment.practitioner_id = current_actor.practitioner_id
                                AND own_assignment.facility_id = target_assignment.facility_id
                                AND own_assignment.is_active = true
                            )
                          )
                        )
                    )
                  )
              )
            ) AS authorized
          `,
          [actorId, target.practitionerId, candidate.authenticatedAt],
        );
      }

      if (operation === 'createPractitionerAssignment') {
        return queryAuthorized(
          executor,
          `SELECT (
            ${actorIsPlatformAdminSql('$1', '$3')}
            OR ${actorHasFacilityRoleSql('$2::uuid', ['FACILITY_ADMIN'])}
          ) AS authorized`,
          [actorId, target.facilityId, candidate.authenticatedAt],
        );
      }

      if (operation === 'listPractitionerAssignments') {
        return queryAuthorized(
          executor,
          `SELECT (
            ${actorIsPlatformAdminSql('$1', '$3')}
            OR EXISTS (
              SELECT 1
              FROM workforce_actors current_actor
              WHERE current_actor.id = $1
                AND current_actor.is_active = true
                AND current_actor.activated_at <= $3::timestamptz
                AND (
                  (
                    current_actor.practitioner_id = $2
                    AND EXISTS (
                      SELECT 1
                      FROM workforce_role_assignments practitioner_role
                      WHERE practitioner_role.actor_id = current_actor.id
                        AND practitioner_role.role = 'PRACTITIONER'
                        AND practitioner_role.is_active = true
                        AND practitioner_role.activated_at <= $3::timestamptz
                    )
                  )
                  OR EXISTS (
                    SELECT 1
                    FROM practitioner_facility_assignments target_assignment
                    WHERE target_assignment.practitioner_id = $2
                      AND target_assignment.is_active = true
                      AND EXISTS (
                        SELECT 1
                        FROM workforce_role_assignments administrative_role
                        WHERE administrative_role.actor_id = current_actor.id
                          AND administrative_role.role IN ('FACILITY_ADMIN', 'SCHEDULER')
                          AND administrative_role.facility_id = target_assignment.facility_id
                          AND administrative_role.is_active = true
                          AND administrative_role.activated_at <= $3::timestamptz
                      )
                  )
                )
            )
          ) AS authorized`,
          [actorId, target.practitionerId, candidate.authenticatedAt],
        );
      }

      if (
        operation === 'updatePractitionerAssignment' ||
        operation === 'deactivatePractitionerAssignment'
      ) {
        return queryAuthorized(
          executor,
          `SELECT (
            ${actorIsPlatformAdminSql('$1', '$4')}
            OR EXISTS (
              SELECT 1
              FROM practitioner_facility_assignments target_assignment
              WHERE target_assignment.id = $2
                AND target_assignment.practitioner_id = $3
                AND ${actorHasFacilityRoleSql('target_assignment.facility_id', ['FACILITY_ADMIN'], '$4')}
            )
          ) AS authorized`,
          [
            actorId,
            target.assignmentId,
            target.practitionerId,
            candidate.authenticatedAt,
          ],
        );
      }

      if (operation === 'createPatient' || operation === 'createAppointment') {
        return queryAuthorized(
          executor,
          `SELECT ${actorHasFacilityRoleSql('$2::uuid', ['FACILITY_ADMIN', 'SCHEDULER'])} AS authorized`,
          [actorId, target.facilityId, candidate.authenticatedAt],
        );
      }

      if (operation === 'getPatientById') {
        return queryAuthorized(
          executor,
          `SELECT EXISTS (
            SELECT 1
            FROM patient_facility_registrations registration
            JOIN healthcare_facilities facility
              ON facility.id = registration.facility_id
             AND facility.is_active = true
            WHERE registration.patient_id = $2
              AND ${actorHasFacilityRoleSql('registration.facility_id', ['FACILITY_ADMIN', 'SCHEDULER'])}
          ) AS authorized`,
          [actorId, target.patientId, candidate.authenticatedAt],
        );
      }

      if (operation === 'updatePatient' || operation === 'deactivatePatient') {
        return queryAuthorized(
          executor,
          `SELECT (
            (SELECT COUNT(*) FROM patient_facility_registrations WHERE patient_id = $2) = 1
            AND EXISTS (
              SELECT 1
              FROM patient_facility_registrations registration
              WHERE registration.patient_id = $2
                AND ${actorHasFacilityRoleSql('registration.facility_id', ['FACILITY_ADMIN', 'SCHEDULER'])}
            )
          ) AS authorized`,
          [actorId, target.patientId, candidate.authenticatedAt],
        );
      }

      if (
        operation === 'getAppointmentById' ||
        operation === 'cancelAppointment'
      ) {
        return queryAuthorized(
          executor,
          `SELECT EXISTS (
            SELECT 1
            FROM appointments target_appointment
            WHERE target_appointment.id = $2
              AND (
                ${actorHasFacilityRoleSql('target_appointment.facility_id', ['FACILITY_ADMIN', 'SCHEDULER'])}
                OR ${actorIsPractitionerForAppointmentSql('target_appointment.id')}
              )
          ) AS authorized`,
          [actorId, target.appointmentId, candidate.authenticatedAt],
        );
      }

      if (operation === 'updateAppointment') {
        return queryAuthorized(
          executor,
          `SELECT EXISTS (
            SELECT 1
            FROM appointments target_appointment
            WHERE target_appointment.id = $2
              AND ${actorHasFacilityRoleSql('target_appointment.facility_id', ['FACILITY_ADMIN', 'SCHEDULER'])}
          ) AS authorized`,
          [actorId, target.appointmentId, candidate.authenticatedAt],
        );
      }

      return false;
    },

    async touchSession(candidate, operation, target, permittedRoles) {
      const client = await db.connect();

      try {
        await client.query('BEGIN');

        if (!(await lockAuthorizationTarget(client, candidate, target))) {
          await client.query('ROLLBACK');
          return Object.freeze({ status: 'SESSION_NOT_ACTIVE' });
        }

        if (
          !(await repository.isTargetAuthorized(
            operation,
            candidate,
            target,
            client,
          ))
        ) {
          await client.query('ROLLBACK');
          return Object.freeze({ status: 'TARGET_NOT_AUTHORIZED' });
        }

        const result = await client.query<SessionRow>(
          `
          WITH locked_actor AS MATERIALIZED (
            SELECT actor.id
            FROM workforce_actors actor
            WHERE actor.id = $1
              AND actor.is_active = true
              AND actor.activated_at <= $3::timestamptz
            FOR UPDATE OF actor
          ),
          eligible_roles AS MATERIALIZED (
            SELECT active_role.id
            FROM workforce_role_assignments active_role
            LEFT JOIN healthcare_facilities role_facility
              ON role_facility.id = active_role.facility_id
            WHERE active_role.actor_id = $1
              AND active_role.is_active = true
              AND active_role.activated_at <= $3::timestamptz
              AND active_role.role = ANY($4::varchar[])
              AND (
                active_role.facility_id IS NULL
                OR role_facility.is_active = true
              )
            ORDER BY active_role.id
            FOR SHARE OF active_role
          )
          INSERT INTO workforce_sessions (
            actor_id,
            oidc_session_hash,
            started_at,
            last_seen_at,
            absolute_expires_at
          )
          SELECT
            actor.id,
            $2,
            $3,
            GREATEST($3::timestamptz, now()),
            $3::timestamptz + interval '8 hours'
          FROM locked_actor actor
          WHERE now() < $3::timestamptz + interval '8 hours'
            AND EXISTS (SELECT 1 FROM eligible_roles)
          ON CONFLICT (actor_id, oidc_session_hash) DO UPDATE
          SET last_seen_at = GREATEST(
                workforce_sessions.last_seen_at,
                EXCLUDED.last_seen_at
              ),
              updated_at = now()
          WHERE workforce_sessions.revoked_at IS NULL
            AND workforce_sessions.last_seen_at >= now() - interval '30 minutes'
            AND workforce_sessions.absolute_expires_at > now()
            AND EXISTS (
              SELECT 1
              FROM workforce_actors current_actor
              WHERE current_actor.id = workforce_sessions.actor_id
                AND current_actor.is_active = true
            )
          RETURNING id
        `,
          [
            candidate.actorId,
            candidate.sessionHash,
            candidate.authenticatedAt,
            permittedRoles,
          ],
        );
        const sessionId = result.rows[0]?.id;

        if (!sessionId) {
          await client.query('ROLLBACK');
          return Object.freeze({ status: 'SESSION_NOT_ACTIVE' });
        }

        const currentCandidate = await refreshAuthorizationCandidate(
          client,
          candidate,
        );
        if (!currentCandidate) {
          await client.query('ROLLBACK');
          return Object.freeze({ status: 'SESSION_NOT_ACTIVE' });
        }

        await client.query('COMMIT');
        return Object.freeze({
          status: 'AUTHORIZED',
          sessionId,
          candidate: currentCandidate,
        });
      } catch (error) {
        try {
          await client.query('ROLLBACK');
        } catch {
          // Preserve the original privacy-safe boundary error.
        }
        throw error;
      } finally {
        client.release();
      }
    },

    async revokeSessionsForFacility(facilityId, reason) {
      const result = await db.query<SessionRow>(
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
              revocation_reason = $2,
              updated_at = now()
          WHERE session.revoked_at IS NULL
            AND session.id IN (SELECT id FROM locked_sessions)
          RETURNING session.id
        `,
        [facilityId, reason],
      );
      return result.rows.length;
    },

    async revokeSessionsForPractitioner(practitionerId, reason) {
      const result = await db.query<SessionRow>(
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
              revocation_reason = $2,
              updated_at = now()
          WHERE session.revoked_at IS NULL
            AND session.id IN (SELECT id FROM locked_sessions)
          RETURNING session.id
        `,
        [practitionerId, reason],
      );
      return result.rows.length;
    },

    async revokeSessionsForAssignment(assignmentId, reason) {
      const result = await db.query<SessionRow>(
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
              revocation_reason = $2,
              updated_at = now()
          WHERE session.revoked_at IS NULL
            AND session.id IN (SELECT id FROM locked_sessions)
          RETURNING session.id
        `,
        [assignmentId, reason],
      );
      return result.rows.length;
    },
  };

  return repository;
}
