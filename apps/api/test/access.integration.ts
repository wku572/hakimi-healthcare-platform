import crypto from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createAccessRepository } from '../src/access/repository.js';
import { createAccessService } from '../src/access/service.js';
import {
  createProvisioningService,
  provisioningCommandSchema,
} from '../src/access/provisioning.js';
import type { VerifiedOidcIdentity } from '../src/access/types.js';
import { createPostgresPool } from '../src/database.js';
import { loadEnvironment } from '../src/env.js';
import { createHealthcareFacilityRepository } from '../src/facilities/repository.js';
import { createHealthcareFacilityService } from '../src/facilities/service.js';
import { runMigrationCommand } from '../src/migrations/runner.js';
import { createPractitionerRepository } from '../src/practitioners/repository.js';
import { createPractitionerService } from '../src/practitioners/service.js';

if (process.env.NODE_ENV === 'production') {
  throw new Error('test:integration:db refuses to run in production.');
}

const issuer = 'https://identity.example.test/workforce';
const subject = `synthetic-access-${crypto.randomUUID()}`;
const sessionHash = crypto
  .createHash('sha256')
  .update('synthetic-session')
  .digest('hex');
const facilityCode = `ACCESS-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
const otherFacilityCode = `OTHER-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

describe.sequential('PostgreSQL workforce access integration', () => {
  const environment = loadEnvironment();
  const pool = createPostgresPool(environment.DATABASE_URL);
  const provisioning = createProvisioningService(pool);
  const repository = createAccessRepository(pool);
  const service = createAccessService(repository);
  let actorId = '';
  let facilityId = '';
  let otherFacilityId = '';

  const identity = (hash = sessionHash): VerifiedOidcIdentity =>
    Object.freeze({
      issuer,
      subject,
      sessionHash: hash,
      authenticatedAt: new Date(),
    });

  beforeAll(async () => {
    await runMigrationCommand('up');
    const facilities = await pool.query<{ id: string }>(
      `
        INSERT INTO healthcare_facilities (
          code,
          name,
          facility_type,
          license_number,
          region,
          city,
          address_line,
          is_active
        )
        VALUES
          ($1, 'Synthetic Access Clinic', 'clinic', $2, 'Synthetic Region', 'Synthetic City', 'Synthetic Address', true),
          ($3, 'Synthetic Other Clinic', 'clinic', $4, 'Synthetic Region', 'Synthetic City', 'Synthetic Address', true)
        RETURNING id
      `,
      [
        facilityCode,
        `LICENSE-${facilityCode}`,
        otherFacilityCode,
        `LICENSE-${otherFacilityCode}`,
      ],
    );
    facilityId = facilities.rows[0]!.id;
    otherFacilityId = facilities.rows[1]!.id;

    await provisioning(
      provisioningCommandSchema.parse({
        action: 'PROVISION_ACTOR',
        oidcIssuer: issuer,
        oidcSubject: subject,
      }),
    );
    const actor = await pool.query<{ id: string }>(
      'SELECT id FROM workforce_actors WHERE oidc_issuer = $1 AND oidc_subject = $2',
      [issuer, subject],
    );
    actorId = actor.rows[0]!.id;
    await provisioning(
      provisioningCommandSchema.parse({
        action: 'ASSIGN_ROLE',
        actorId,
        role: 'FACILITY_ADMIN',
        facilityId,
      }),
    );
  });

  afterAll(async () => {
    if (actorId) {
      await pool.query('DELETE FROM workforce_sessions WHERE actor_id = $1', [
        actorId,
      ]);
      await pool.query(
        'DELETE FROM workforce_role_assignments WHERE actor_id = $1',
        [actorId],
      );
      await pool.query('DELETE FROM workforce_actors WHERE id = $1', [actorId]);
    }
    if (facilityId && otherFacilityId) {
      await pool.query(
        'DELETE FROM healthcare_facilities WHERE id = ANY($1::uuid[])',
        [[facilityId, otherFacilityId]],
      );
    }
    await pool.end();
  });

  it('creates one session under concurrent authorized requests and isolates facilities', async () => {
    const candidates = await Promise.all([
      service.resolveCandidate(identity()),
      service.resolveCandidate(identity()),
    ]);
    const decisions = await Promise.all(
      candidates.map((value) =>
        service.authorize(value, 'listHealthcareFacilities'),
      ),
    );

    expect(
      new Set(decisions.map((decision) => decision.context.sessionId)).size,
    ).toBe(1);
    const sessionCount = await pool.query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM workforce_sessions WHERE actor_id = $1',
      [actorId],
    );
    expect(sessionCount.rows[0]!.count).toBe('1');

    const currentCandidate = await service.resolveCandidate(identity());
    await expect(
      service.authorize(
        currentCandidate,
        'getHealthcareFacilityById',
        undefined,
        { facilityId: otherFacilityId },
      ),
    ).rejects.toMatchObject({ code: 'FACILITY_NOT_FOUND', statusCode: 404 });
  });

  it('revokes sessions atomically with role reduction and never revives them', async () => {
    const result = await provisioning(
      provisioningCommandSchema.parse({
        action: 'DEACTIVATE_ROLE',
        actorId,
        role: 'FACILITY_ADMIN',
        facilityId,
      }),
    );
    expect(result.affectedCount).toBeGreaterThanOrEqual(2);
    await expect(service.resolveCandidate(identity())).rejects.toMatchObject({
      code: 'AUTHENTICATION_REQUIRED',
      statusCode: 401,
    });

    await provisioning(
      provisioningCommandSchema.parse({
        action: 'ASSIGN_ROLE',
        actorId,
        role: 'FACILITY_ADMIN',
        facilityId,
      }),
    );
    await expect(service.resolveCandidate(identity())).rejects.toMatchObject({
      code: 'AUTHENTICATION_REQUIRED',
      statusCode: 401,
    });

    const replacementHash = crypto
      .createHash('sha256')
      .update('replacement-synthetic-session')
      .digest('hex');
    const replacementCandidate = await service.resolveCandidate(
      identity(replacementHash),
    );
    await expect(
      service.authorize(replacementCandidate, 'listHealthcareFacilities'),
    ).resolves.toMatchObject({
      context: { actorId },
    });
  });

  it('rolls back a rejected scope change without creating authority', async () => {
    await pool.query(
      'UPDATE healthcare_facilities SET is_active = false WHERE id = $1',
      [otherFacilityId],
    );

    await expect(
      provisioning(
        provisioningCommandSchema.parse({
          action: 'ASSIGN_ROLE',
          actorId,
          role: 'SCHEDULER',
          facilityId: otherFacilityId,
        }),
      ),
    ).rejects.toThrow('PROVISIONING_TARGET_NOT_FOUND');

    const roleCount = await pool.query<{ count: string }>(
      `
        SELECT COUNT(*)::text AS count
        FROM workforce_role_assignments
        WHERE actor_id = $1
          AND role = 'SCHEDULER'
          AND facility_id = $2
      `,
      [actorId, otherFacilityId],
    );
    expect(roleCount.rows[0]!.count).toBe('0');
  });

  it('fails closed for inactivity and absolute session expiry', async () => {
    const inactiveHash = crypto
      .createHash('sha256')
      .update('inactive-synthetic-session')
      .digest('hex');
    const inactiveCandidate = await service.resolveCandidate(
      identity(inactiveHash),
    );
    await service.authorize(inactiveCandidate, 'listHealthcareFacilities');
    await pool.query(
      `
        UPDATE workforce_sessions
        SET started_at = now() - interval '1 hour',
            last_seen_at = now() - interval '31 minutes'
        WHERE actor_id = $1 AND oidc_session_hash = $2
      `,
      [actorId, inactiveHash],
    );
    await expect(
      service.resolveCandidate(identity(inactiveHash)),
    ).rejects.toMatchObject({ code: 'AUTHENTICATION_REQUIRED' });

    const expiredHash = crypto
      .createHash('sha256')
      .update('expired-synthetic-session')
      .digest('hex');
    const expiredCandidate = await service.resolveCandidate(
      identity(expiredHash),
    );
    await service.authorize(expiredCandidate, 'listHealthcareFacilities');
    await pool.query(
      `
        UPDATE workforce_sessions
        SET started_at = now() - interval '9 hours',
            last_seen_at = now() - interval '1 minute',
            absolute_expires_at = now() - interval '30 seconds'
        WHERE actor_id = $1 AND oidc_session_hash = $2
      `,
      [actorId, expiredHash],
    );
    await expect(
      service.resolveCandidate(identity(expiredHash)),
    ).rejects.toMatchObject({ code: 'AUTHENTICATION_REQUIRED' });
  });

  it('cannot revive a session during concurrent role reduction', async () => {
    const concurrentHash = crypto
      .createHash('sha256')
      .update('concurrent-reduction-session')
      .digest('hex');
    const concurrentCandidate = await service.resolveCandidate(
      identity(concurrentHash),
    );

    const outcomes = await Promise.allSettled([
      service.authorize(concurrentCandidate, 'listHealthcareFacilities'),
      provisioning(
        provisioningCommandSchema.parse({
          action: 'DEACTIVATE_ROLE',
          actorId,
          role: 'FACILITY_ADMIN',
          facilityId,
        }),
      ),
    ]);

    expect(outcomes[1]!.status).toBe('fulfilled');
    const activeSessionCount = await pool.query<{ count: string }>(
      `
        SELECT COUNT(*)::text AS count
        FROM workforce_sessions
        WHERE actor_id = $1
          AND oidc_session_hash = $2
          AND revoked_at IS NULL
      `,
      [actorId, concurrentHash],
    );
    expect(activeSessionCount.rows[0]!.count).toBe('0');
    try {
      const reducedCandidate = await service.resolveCandidate(
        identity(concurrentHash),
      );
      await expect(
        service.authorize(reducedCandidate, 'listHealthcareFacilities'),
      ).rejects.toMatchObject({ code: 'FORBIDDEN', statusCode: 403 });
    } catch (error) {
      expect(error).toMatchObject({
        code: 'AUTHENTICATION_REQUIRED',
        statusCode: 401,
      });
    }

    await provisioning(
      provisioningCommandSchema.parse({
        action: 'ASSIGN_ROLE',
        actorId,
        role: 'FACILITY_ADMIN',
        facilityId,
      }),
    );
  });
});

describe.sequential('target-specific authorization linearization', () => {
  const environment = loadEnvironment();
  const pool = createPostgresPool(environment.DATABASE_URL);
  const provisioning = createProvisioningService(pool);
  const repository = createAccessRepository(pool);
  const facilityService = createHealthcareFacilityService(
    createHealthcareFacilityRepository(pool),
  );
  const practitionerService = createPractitionerService(
    createPractitionerRepository(pool),
  );
  const raceIssuer = `${issuer}/target-race`;
  const roleSubject = `synthetic-role-race-${crypto.randomUUID()}`;
  const practitionerSubject = `synthetic-practitioner-race-${crypto.randomUUID()}`;
  const roleFacilityCode = `ROLE-A-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const retainedFacilityCode = `ROLE-B-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const practitionerFacilityCode = `PRACT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  let roleActorId = '';
  let roleFacilityId = '';
  let retainedFacilityId = '';
  let practitionerActorId = '';
  let practitionerId = '';
  let practitionerFacilityId = '';
  let assignmentId = '';

  async function provisionActor(
    subjectValue: string,
    linkedPractitioner?: string,
  ) {
    await provisioning(
      provisioningCommandSchema.parse({
        action: 'PROVISION_ACTOR',
        oidcIssuer: raceIssuer,
        oidcSubject: subjectValue,
        practitionerId: linkedPractitioner,
      }),
    );
    const actor = await pool.query<{ id: string }>(
      'SELECT id FROM workforce_actors WHERE oidc_issuer = $1 AND oidc_subject = $2',
      [raceIssuer, subjectValue],
    );
    return actor.rows[0]!.id;
  }

  function identityFor(
    subjectValue: string,
    hash: string,
    authenticatedAt = new Date(),
  ): VerifiedOidcIdentity {
    return Object.freeze({
      issuer: raceIssuer,
      subject: subjectValue,
      sessionHash: hash,
      authenticatedAt,
    });
  }

  function createGatedService() {
    let releaseCheck!: () => void;
    let markChecked!: () => void;
    const checked = new Promise<void>((resolve) => {
      markChecked = resolve;
    });
    const continueAuthorization = new Promise<void>((resolve) => {
      releaseCheck = resolve;
    });
    let firstCheck = true;
    const gatedRepository = {
      ...repository,
      async isTargetAuthorized(
        ...parameters: Parameters<typeof repository.isTargetAuthorized>
      ) {
        const authorized = await repository.isTargetAuthorized(...parameters);
        if (firstCheck) {
          firstCheck = false;
          markChecked();
          await continueAuthorization;
        }
        return authorized;
      },
    };

    return {
      service: createAccessService(gatedRepository),
      checked,
      releaseCheck,
    };
  }

  beforeAll(async () => {
    await runMigrationCommand('up');
    const facilities = await pool.query<{ id: string }>(
      `
        INSERT INTO healthcare_facilities (
          code,
          name,
          facility_type,
          license_number,
          region,
          city,
          address_line,
          is_active
        )
        VALUES
          ($1, 'Synthetic Role Facility A', 'clinic', $2, 'Synthetic Region', 'Synthetic City', 'Synthetic Address', true),
          ($3, 'Synthetic Role Facility B', 'clinic', $4, 'Synthetic Region', 'Synthetic City', 'Synthetic Address', true),
          ($5, 'Synthetic Practitioner Facility', 'clinic', $6, 'Synthetic Region', 'Synthetic City', 'Synthetic Address', true)
        RETURNING id
      `,
      [
        roleFacilityCode,
        `LICENSE-${roleFacilityCode}`,
        retainedFacilityCode,
        `LICENSE-${retainedFacilityCode}`,
        practitionerFacilityCode,
        `LICENSE-${practitionerFacilityCode}`,
      ],
    );
    roleFacilityId = facilities.rows[0]!.id;
    retainedFacilityId = facilities.rows[1]!.id;
    practitionerFacilityId = facilities.rows[2]!.id;

    roleActorId = await provisionActor(roleSubject);
    for (const targetFacilityId of [roleFacilityId, retainedFacilityId]) {
      await provisioning(
        provisioningCommandSchema.parse({
          action: 'ASSIGN_ROLE',
          actorId: roleActorId,
          role: 'FACILITY_ADMIN',
          facilityId: targetFacilityId,
        }),
      );
    }

    const practitioner = await pool.query<{ id: string }>(
      `
        INSERT INTO practitioners (
          code,
          first_name,
          last_name,
          profession,
          license_number
        )
        VALUES ($1, 'Synthetic', 'Practitioner', 'General Practice', $2)
        RETURNING id
      `,
      [
        `P-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        `P-LICENSE-${crypto.randomUUID()}`,
      ],
    );
    practitionerId = practitioner.rows[0]!.id;
    const assignment = await pool.query<{ id: string }>(
      `
        INSERT INTO practitioner_facility_assignments (
          practitioner_id,
          facility_id,
          role_title,
          is_active
        )
        VALUES ($1, $2, 'Synthetic Practitioner', true)
        RETURNING id
      `,
      [practitionerId, practitionerFacilityId],
    );
    assignmentId = assignment.rows[0]!.id;
    practitionerActorId = await provisionActor(
      practitionerSubject,
      practitionerId,
    );
    await provisioning(
      provisioningCommandSchema.parse({
        action: 'ASSIGN_ROLE',
        actorId: practitionerActorId,
        role: 'PRACTITIONER',
      }),
    );
  });

  afterAll(async () => {
    const actorIds = [roleActorId, practitionerActorId].filter(Boolean);
    if (actorIds.length) {
      await pool.query(
        'DELETE FROM workforce_sessions WHERE actor_id = ANY($1::uuid[])',
        [actorIds],
      );
      await pool.query(
        'DELETE FROM workforce_role_assignments WHERE actor_id = ANY($1::uuid[])',
        [actorIds],
      );
      await pool.query(
        'DELETE FROM workforce_actors WHERE id = ANY($1::uuid[])',
        [actorIds],
      );
    }
    if (assignmentId) {
      await pool.query(
        'DELETE FROM practitioner_facility_assignments WHERE id = $1',
        [assignmentId],
      );
    }
    if (practitionerId) {
      await pool.query('DELETE FROM practitioners WHERE id = $1', [
        practitionerId,
      ]);
    }
    const facilityIds = [
      roleFacilityId,
      retainedFacilityId,
      practitionerFacilityId,
    ].filter(Boolean);
    if (facilityIds.length) {
      await pool.query(
        'DELETE FROM healthcare_facilities WHERE id = ANY($1::uuid[])',
        [facilityIds],
      );
    }
    await pool.end();
  });

  it('rejects facility A after its role is removed while the same role remains at B', async () => {
    const hash = crypto
      .createHash('sha256')
      .update('synthetic-target-facility-role-race')
      .digest('hex');
    const candidate = await repository.findAuthorizationCandidate(
      identityFor(roleSubject, hash),
    );
    expect(candidate).not.toBeNull();
    const gate = createGatedService();
    const domainMutation = vi.fn();
    const request = (async () => {
      await gate.service.authorize(
        candidate!,
        'getHealthcareFacilityById',
        undefined,
        { facilityId: roleFacilityId },
      );
      domainMutation();
    })();

    await gate.checked;
    await provisioning(
      provisioningCommandSchema.parse({
        action: 'DEACTIVATE_ROLE',
        actorId: roleActorId,
        role: 'FACILITY_ADMIN',
        facilityId: roleFacilityId,
      }),
    );
    gate.releaseCheck();

    await expect(request).rejects.toMatchObject({
      code: 'FACILITY_NOT_FOUND',
      statusCode: 404,
    });
    expect(domainMutation).not.toHaveBeenCalled();
    const result = await pool.query<{ count: string }>(
      `
        SELECT COUNT(*)::text AS count
        FROM workforce_sessions
        WHERE actor_id = $1
          AND oidc_session_hash = $2
      `,
      [roleActorId, hash],
    );
    expect(result.rows[0]!.count).toBe('0');
    const retainedRole = await pool.query<{ is_active: boolean }>(
      `
        SELECT is_active
        FROM workforce_role_assignments
        WHERE actor_id = $1
          AND role = 'FACILITY_ADMIN'
          AND facility_id = $2
      `,
      [roleActorId, retainedFacilityId],
    );
    expect(retainedRole.rows[0]!.is_active).toBe(true);
  });

  it('blocks a facility role activated after authentication', async () => {
    const hash = crypto
      .createHash('sha256')
      .update('synthetic-facility-role-activation')
      .digest('hex');
    const staleIdentity = identityFor(roleSubject, hash);
    const candidate =
      await repository.findAuthorizationCandidate(staleIdentity);
    expect(candidate).not.toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 5));
    await provisioning(
      provisioningCommandSchema.parse({
        action: 'ASSIGN_ROLE',
        actorId: roleActorId,
        role: 'FACILITY_ADMIN',
        facilityId: roleFacilityId,
      }),
    );

    await expect(
      createAccessService(repository).authorize(
        candidate!,
        'getHealthcareFacilityById',
        undefined,
        { facilityId: roleFacilityId },
      ),
    ).rejects.toMatchObject({ code: 'FACILITY_NOT_FOUND', statusCode: 404 });
  });

  it('rejects a removed practitioner assignment without extending the session or invoking the domain service', async () => {
    const hash = crypto
      .createHash('sha256')
      .update('synthetic-target-practitioner-race')
      .digest('hex');
    const fixedIdentity = identityFor(practitionerSubject, hash);
    const initialCandidate =
      await repository.findAuthorizationCandidate(fixedIdentity);
    expect(initialCandidate).not.toBeNull();
    await createAccessService(repository).authorize(
      initialCandidate!,
      'getHealthcareFacilityById',
      undefined,
      { facilityId: practitionerFacilityId },
    );
    const before = await pool.query<{ last_seen_at: Date }>(
      `
        SELECT last_seen_at
        FROM workforce_sessions
        WHERE actor_id = $1
          AND oidc_session_hash = $2
      `,
      [practitionerActorId, hash],
    );
    const candidate =
      await repository.findAuthorizationCandidate(fixedIdentity);
    expect(candidate).not.toBeNull();
    const gate = createGatedService();
    const domainMutation = vi.fn();
    const request = (async () => {
      await gate.service.authorize(
        candidate!,
        'getHealthcareFacilityById',
        undefined,
        { facilityId: practitionerFacilityId },
      );
      domainMutation();
    })();

    await gate.checked;
    await practitionerService.updateAssignment(practitionerId, assignmentId, {
      isActive: false,
    });
    gate.releaseCheck();

    await expect(request).rejects.toMatchObject({
      code: 'FACILITY_NOT_FOUND',
      statusCode: 404,
    });
    expect(domainMutation).not.toHaveBeenCalled();
    const after = await pool.query<{ last_seen_at: Date }>(
      `
        SELECT last_seen_at
        FROM workforce_sessions
        WHERE actor_id = $1
          AND oidc_session_hash = $2
      `,
      [practitionerActorId, hash],
    );
    expect(after.rows[0]!.last_seen_at.toISOString()).toBe(
      before.rows[0]!.last_seen_at.toISOString(),
    );
    const practitionerRole = await pool.query<{ is_active: boolean }>(
      `
        SELECT is_active
        FROM workforce_role_assignments
        WHERE actor_id = $1
          AND role = 'PRACTITIONER'
          AND facility_id IS NULL
      `,
      [practitionerActorId],
    );
    expect(practitionerRole.rows[0]!.is_active).toBe(true);
  });

  it('blocks scope expansion for an existing identity until reauthentication and recovers revocation idempotently', async () => {
    const hash = crypto
      .createHash('sha256')
      .update('synthetic-scope-expansion-session')
      .digest('hex');
    const authenticatedAt = new Date();
    const staleIdentity = identityFor(
      practitionerSubject,
      hash,
      authenticatedAt,
    );
    const staleCandidate =
      await repository.findAuthorizationCandidate(staleIdentity);
    expect(staleCandidate).not.toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 5));
    await practitionerService.updateAssignment(practitionerId, assignmentId, {
      isActive: true,
    });

    await expect(
      createAccessService(repository).authorize(
        staleCandidate!,
        'getHealthcareFacilityById',
        undefined,
        { facilityId: practitionerFacilityId },
      ),
    ).rejects.toMatchObject({
      code: 'FACILITY_NOT_FOUND',
      statusCode: 404,
    });

    const assignmentBeforeRecovery = await pool.query<{
      is_active: boolean;
      updated_at: Date;
    }>(
      'SELECT is_active, updated_at FROM practitioner_facility_assignments WHERE id = $1',
      [assignmentId],
    );
    const first = await provisioning(
      provisioningCommandSchema.parse({
        action: 'REVOKE_ASSIGNMENT_SESSIONS',
        assignmentId,
      }),
    );
    const second = await provisioning(
      provisioningCommandSchema.parse({
        action: 'REVOKE_ASSIGNMENT_SESSIONS',
        assignmentId,
      }),
    );
    expect(first.affectedCount).toBeGreaterThanOrEqual(1);
    expect(second.affectedCount).toBe(0);
    const assignmentAfterRecovery = await pool.query<{
      is_active: boolean;
      updated_at: Date;
    }>(
      'SELECT is_active, updated_at FROM practitioner_facility_assignments WHERE id = $1',
      [assignmentId],
    );
    expect(assignmentAfterRecovery.rows[0]).toEqual(
      assignmentBeforeRecovery.rows[0],
    );
  });

  it('preserves authority across ordinary facility, practitioner, and assignment edits', async () => {
    const hash = crypto
      .createHash('sha256')
      .update('synthetic-non-lifecycle-edits')
      .digest('hex');
    const identity = identityFor(practitionerSubject, hash);
    const initialCandidate =
      await repository.findAuthorizationCandidate(identity);
    expect(initialCandidate).not.toBeNull();
    await createAccessService(repository).authorize(
      initialCandidate!,
      'getHealthcareFacilityById',
      undefined,
      { facilityId: practitionerFacilityId },
    );
    const epochsBefore = await pool.query<{
      actor_activated_at: Date;
      role_activated_at: Date;
    }>(
      `
        SELECT actor.activated_at AS actor_activated_at,
               role.activated_at AS role_activated_at
        FROM workforce_actors actor
        JOIN workforce_role_assignments role
          ON role.actor_id = actor.id
         AND role.role = 'PRACTITIONER'
         AND role.facility_id IS NULL
        WHERE actor.id = $1
      `,
      [practitionerActorId],
    );

    await facilityService.updateFacility(practitionerFacilityId, {
      name: 'Synthetic Practitioner Facility Updated',
      phone: '+251 11 000 0000',
      email: 'synthetic-facility@example.test',
    });
    await practitionerService.updatePractitioner(practitionerId, {
      profession: 'Synthetic General Medicine',
      phone: '+1 202 555 0100',
      bio: 'Synthetic non-clinical profile text.',
    });
    await practitionerService.updateAssignment(practitionerId, assignmentId, {
      roleTitle: 'Synthetic Senior Practitioner',
      department: 'Synthetic Outpatient Department',
      isPrimary: true,
    });

    const currentCandidate =
      await repository.findAuthorizationCandidate(identity);
    expect(currentCandidate).not.toBeNull();
    await expect(
      createAccessService(repository).authorize(
        currentCandidate!,
        'getHealthcareFacilityById',
        undefined,
        { facilityId: practitionerFacilityId },
      ),
    ).resolves.toMatchObject({ context: { actorId: practitionerActorId } });
    const epochsAfter = await pool.query<{
      actor_activated_at: Date;
      role_activated_at: Date;
    }>(
      `
        SELECT actor.activated_at AS actor_activated_at,
               role.activated_at AS role_activated_at
        FROM workforce_actors actor
        JOIN workforce_role_assignments role
          ON role.actor_id = actor.id
         AND role.role = 'PRACTITIONER'
         AND role.facility_id IS NULL
        WHERE actor.id = $1
      `,
      [practitionerActorId],
    );
    expect(epochsAfter.rows[0]!.actor_activated_at.toISOString()).toBe(
      epochsBefore.rows[0]!.actor_activated_at.toISOString(),
    );
    expect(epochsAfter.rows[0]!.role_activated_at.toISOString()).toBe(
      epochsBefore.rows[0]!.role_activated_at.toISOString(),
    );
  });

  it('blocks facility and practitioner reactivation for identities authenticated before the state change', async () => {
    async function createCandidate(label: string) {
      const hash = crypto.createHash('sha256').update(label).digest('hex');
      const identity = identityFor(practitionerSubject, hash);
      const candidate = await repository.findAuthorizationCandidate(identity);
      expect(candidate).not.toBeNull();
      await createAccessService(repository).authorize(
        candidate!,
        'getHealthcareFacilityById',
        undefined,
        { facilityId: practitionerFacilityId },
      );
      return {
        candidate: (await repository.findAuthorizationCandidate(identity))!,
        hash,
      };
    }

    const facilityIdentity = await createCandidate(
      'synthetic-facility-reactivation',
    );
    const beforeFacility = await pool.query<{ last_seen_at: Date }>(
      `
        SELECT last_seen_at
        FROM workforce_sessions
        WHERE actor_id = $1
          AND oidc_session_hash = $2
      `,
      [practitionerActorId, facilityIdentity.hash],
    );
    await new Promise((resolve) => setTimeout(resolve, 5));
    await facilityService.updateFacility(practitionerFacilityId, {
      isActive: false,
    });
    await expect(
      createAccessService(repository).authorize(
        facilityIdentity.candidate,
        'getHealthcareFacilityById',
        undefined,
        { facilityId: practitionerFacilityId },
      ),
    ).rejects.toMatchObject({ code: 'FACILITY_NOT_FOUND', statusCode: 404 });
    await facilityService.updateFacility(practitionerFacilityId, {
      isActive: true,
    });
    await expect(
      createAccessService(repository).authorize(
        facilityIdentity.candidate,
        'getHealthcareFacilityById',
        undefined,
        { facilityId: practitionerFacilityId },
      ),
    ).rejects.toMatchObject({ code: 'FACILITY_NOT_FOUND', statusCode: 404 });
    const afterFacility = await pool.query<{ last_seen_at: Date }>(
      `
        SELECT last_seen_at
        FROM workforce_sessions
        WHERE actor_id = $1
          AND oidc_session_hash = $2
      `,
      [practitionerActorId, facilityIdentity.hash],
    );
    expect(afterFacility.rows[0]!.last_seen_at.toISOString()).toBe(
      beforeFacility.rows[0]!.last_seen_at.toISOString(),
    );

    const practitionerIdentity = await createCandidate(
      'synthetic-practitioner-reactivation',
    );
    await new Promise((resolve) => setTimeout(resolve, 5));
    await practitionerService.updatePractitioner(practitionerId, {
      isActive: false,
    });
    await expect(
      createAccessService(repository).authorize(
        practitionerIdentity.candidate,
        'getHealthcareFacilityById',
        undefined,
        { facilityId: practitionerFacilityId },
      ),
    ).rejects.toMatchObject({ code: 'FACILITY_NOT_FOUND', statusCode: 404 });
    await practitionerService.updatePractitioner(practitionerId, {
      isActive: true,
    });
    await expect(
      createAccessService(repository).authorize(
        practitionerIdentity.candidate,
        'getHealthcareFacilityById',
        undefined,
        { facilityId: practitionerFacilityId },
      ),
    ).rejects.toMatchObject({ code: 'FACILITY_NOT_FOUND', statusCode: 404 });
  });

  it('recovers practitioner and facility revocation idempotently without replaying domain mutations', async () => {
    async function createActiveSession(label: string) {
      const hash = crypto.createHash('sha256').update(label).digest('hex');
      const candidate = await repository.findAuthorizationCandidate(
        identityFor(practitionerSubject, hash),
      );
      expect(candidate).not.toBeNull();
      await createAccessService(repository).authorize(
        candidate!,
        'getHealthcareFacilityById',
        undefined,
        { facilityId: practitionerFacilityId },
      );
    }

    await createActiveSession('synthetic-practitioner-recovery');
    const practitionerBefore = await pool.query<{
      is_active: boolean;
      updated_at: Date;
    }>('SELECT is_active, updated_at FROM practitioners WHERE id = $1', [
      practitionerId,
    ]);
    const practitionerFirst = await provisioning(
      provisioningCommandSchema.parse({
        action: 'REVOKE_PRACTITIONER_SESSIONS',
        practitionerId,
      }),
    );
    const practitionerSecond = await provisioning(
      provisioningCommandSchema.parse({
        action: 'REVOKE_PRACTITIONER_SESSIONS',
        practitionerId,
      }),
    );
    expect(practitionerFirst.affectedCount).toBeGreaterThanOrEqual(1);
    expect(practitionerSecond.affectedCount).toBe(0);
    const practitionerAfter = await pool.query<{
      is_active: boolean;
      updated_at: Date;
    }>('SELECT is_active, updated_at FROM practitioners WHERE id = $1', [
      practitionerId,
    ]);
    expect(practitionerAfter.rows[0]).toEqual(practitionerBefore.rows[0]);

    await createActiveSession('synthetic-facility-recovery');
    const facilityBefore = await pool.query<{
      is_active: boolean;
      updated_at: Date;
    }>(
      'SELECT is_active, updated_at FROM healthcare_facilities WHERE id = $1',
      [practitionerFacilityId],
    );
    const facilityFirst = await provisioning(
      provisioningCommandSchema.parse({
        action: 'REVOKE_FACILITY_SESSIONS',
        facilityId: practitionerFacilityId,
      }),
    );
    const facilitySecond = await provisioning(
      provisioningCommandSchema.parse({
        action: 'REVOKE_FACILITY_SESSIONS',
        facilityId: practitionerFacilityId,
      }),
    );
    expect(facilityFirst.affectedCount).toBeGreaterThanOrEqual(1);
    expect(facilitySecond.affectedCount).toBe(0);
    const facilityAfter = await pool.query<{
      is_active: boolean;
      updated_at: Date;
    }>(
      'SELECT is_active, updated_at FROM healthcare_facilities WHERE id = $1',
      [practitionerFacilityId],
    );
    expect(facilityAfter.rows[0]).toEqual(facilityBefore.rows[0]);
  });
});
