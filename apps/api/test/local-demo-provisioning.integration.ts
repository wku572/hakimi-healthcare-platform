import crypto from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAccessRepository } from '../src/access/repository.js';
import { createAccessService } from '../src/access/service.js';
import type {
  LocalDemoProvisioningConfig,
  LocalDemoProvisioningSummary,
} from '../src/access/local-demo-provisioning.js';
import { provisionLocalDemoData } from '../src/access/local-demo-provisioning.js';
import type { VerifiedOidcIdentity } from '../src/access/types.js';
import { createPostgresPool } from '../src/database.js';
import { loadEnvironment } from '../src/env.js';
import { runMigrationCommand } from '../src/migrations/runner.js';
import { createHealthcareFacilityRepository } from '../src/facilities/repository.js';
import { createPatientRepository } from '../src/patients/repository.js';

if (process.env.NODE_ENV === 'production') {
  throw new Error('test:integration:db refuses to run in production.');
}

const environment = loadEnvironment();
const pool = createPostgresPool(environment.DATABASE_URL);
const accessRepository = createAccessRepository(pool);
const accessService = createAccessService(accessRepository);
const facilityRepository = createHealthcareFacilityRepository(pool);
const patientRepository = createPatientRepository(pool);

function suffix() {
  return crypto.randomUUID().slice(0, 8).toUpperCase();
}

function hashSession(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function createConfig(): LocalDemoProvisioningConfig {
  const marker = suffix();
  const primaryFacilityId = crypto.randomUUID();
  const otherFacilityId = crypto.randomUUID();
  const practitionerOneId = crypto.randomUUID();
  const practitionerTwoId = crypto.randomUUID();
  const otherPractitionerId = crypto.randomUUID();
  const patientOneId = crypto.randomUUID();
  const patientTwoId = crypto.randomUUID();
  const otherPatientId = crypto.randomUUID();

  return Object.freeze({
    oidcIssuer: `http://localhost:8080/realms/hakimi-local/${marker}`,
    oidcSubject: `synthetic-local-demo-${marker}`,
    actorId: crypto.randomUUID(),
    primaryFacility: Object.freeze({
      id: primaryFacilityId,
      code: `DEMO-ADDIS-${marker}`,
      name: 'Addis Family Clinic',
      facilityType: 'clinic',
      licenseNumber: `DEMO-FAC-${marker}-1`,
      phone: '+251 11 000 0101',
      email: `addis-${marker.toLowerCase()}@example.test`,
      region: 'Addis Ababa',
      city: 'Addis Ababa',
      addressLine: 'Fictional Bole Road address',
      timeZone: 'Africa/Addis_Ababa',
    }),
    otherFacility: Object.freeze({
      id: otherFacilityId,
      code: `DEMO-OTHER-${marker}`,
      name: 'Northside Demo Clinic',
      facilityType: 'clinic',
      licenseNumber: `DEMO-FAC-${marker}-2`,
      phone: '+251 11 000 0102',
      email: `northside-${marker.toLowerCase()}@example.test`,
      region: 'Amhara',
      city: 'Bahir Dar',
      addressLine: 'Fictional lakeside address',
      timeZone: 'Africa/Addis_Ababa',
    }),
    practitioners: Object.freeze([
      Object.freeze({
        id: practitionerOneId,
        assignmentId: crypto.randomUUID(),
        facilityId: primaryFacilityId,
        code: `DEMO-PRAC-${marker}-1`,
        firstName: 'Selam',
        lastName: 'Bekele',
        profession: 'general practitioner',
        licenseNumber: `DEMO-LIC-${marker}-1`,
        roleTitle: 'General Practitioner',
        department: 'Outpatient Care',
        isPrimary: true,
      }),
      Object.freeze({
        id: practitionerTwoId,
        assignmentId: crypto.randomUUID(),
        facilityId: primaryFacilityId,
        code: `DEMO-PRAC-${marker}-2`,
        firstName: 'Dawit',
        lastName: 'Tesfaye',
        profession: 'family medicine',
        licenseNumber: `DEMO-LIC-${marker}-2`,
        roleTitle: 'Family Medicine Practitioner',
        department: 'Family Clinic',
        isPrimary: false,
      }),
      Object.freeze({
        id: otherPractitionerId,
        assignmentId: crypto.randomUUID(),
        facilityId: otherFacilityId,
        code: `DEMO-PRAC-${marker}-3`,
        firstName: 'Marta',
        lastName: 'Lemma',
        profession: 'general practitioner',
        licenseNumber: `DEMO-LIC-${marker}-3`,
        roleTitle: 'General Practitioner',
        department: 'Demo Care',
        isPrimary: true,
      }),
    ]),
    patients: Object.freeze([
      Object.freeze({
        id: patientOneId,
        registrationId: crypto.randomUUID(),
        facilityId: primaryFacilityId,
        medicalRecordNumber: `DEMO-MRN-${marker}-1`,
        firstName: 'Amina',
        lastName: 'Kebede',
        dateOfBirth: '1992-04-12',
        administrativeSex: 'female',
        city: 'Addis Ababa',
        region: 'Addis Ababa',
      }),
      Object.freeze({
        id: patientTwoId,
        registrationId: crypto.randomUUID(),
        facilityId: primaryFacilityId,
        medicalRecordNumber: `DEMO-MRN-${marker}-2`,
        firstName: 'Noah',
        lastName: 'Tadesse',
        dateOfBirth: '1988-09-23',
        administrativeSex: 'male',
        city: 'Addis Ababa',
        region: 'Addis Ababa',
      }),
      Object.freeze({
        id: otherPatientId,
        registrationId: crypto.randomUUID(),
        facilityId: otherFacilityId,
        medicalRecordNumber: `DEMO-MRN-${marker}-3`,
        firstName: 'Liya',
        lastName: 'Abate',
        dateOfBirth: '1996-01-17',
        administrativeSex: 'female',
        city: 'Bahir Dar',
        region: 'Amhara',
      }),
    ]),
    appointment: Object.freeze({
      id: crypto.randomUUID(),
      patientId: patientOneId,
      practitionerId: practitionerOneId,
      facilityId: primaryFacilityId,
    }),
  });
}

const config = createConfig();
let firstSummary: LocalDemoProvisioningSummary | null = null;

function identity(subject = config.oidcSubject): VerifiedOidcIdentity {
  return Object.freeze({
    issuer: config.oidcIssuer,
    subject,
    sessionHash: hashSession(`local-demo-${subject}`),
    authenticatedAt: new Date(),
  });
}

async function countRows(table: string, ids: readonly string[]) {
  const result = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM ${table} WHERE id = ANY($1::uuid[])`,
    [ids],
  );
  return result.rows[0]!.count;
}

describe('PostgreSQL local demo provisioning integration', () => {
  beforeAll(async () => {
    await runMigrationCommand('up');
  });

  afterAll(async () => {
    await pool.query(
      'DELETE FROM appointment_reminders WHERE appointment_id = $1',
      [config.appointment.id],
    );
    await pool.query('DELETE FROM appointments WHERE id = $1', [
      config.appointment.id,
    ]);
    await pool.query(
      'DELETE FROM practitioner_working_hours WHERE practitioner_id = ANY($1::uuid[])',
      [config.practitioners.map((practitioner) => practitioner.id)],
    );
    await pool.query('DELETE FROM workforce_sessions WHERE actor_id = $1', [
      config.actorId,
    ]);
    await pool.query(
      'DELETE FROM workforce_role_assignments WHERE actor_id = $1',
      [config.actorId],
    );
    await pool.query('DELETE FROM workforce_actors WHERE id = $1', [
      config.actorId,
    ]);
    await pool.query(
      'DELETE FROM patient_facility_registrations WHERE id = ANY($1::uuid[])',
      [config.patients.map((patient) => patient.registrationId)],
    );
    await pool.query(
      'DELETE FROM practitioner_facility_assignments WHERE id = ANY($1::uuid[])',
      [config.practitioners.map((practitioner) => practitioner.assignmentId)],
    );
    await pool.query('DELETE FROM patients WHERE id = ANY($1::uuid[])', [
      config.patients.map((patient) => patient.id),
    ]);
    await pool.query('DELETE FROM practitioners WHERE id = ANY($1::uuid[])', [
      config.practitioners.map((practitioner) => practitioner.id),
    ]);
    await pool.query(
      'DELETE FROM healthcare_facilities WHERE id = ANY($1::uuid[])',
      [[config.primaryFacility.id, config.otherFacility.id]],
    );
    await pool.end();
  });

  it('provisions the same logical records on repeated execution', async () => {
    firstSummary = await provisionLocalDemoData(
      pool,
      environment,
      'true',
      config,
    );
    const secondSummary = await provisionLocalDemoData(
      pool,
      environment,
      'true',
      config,
    );

    expect(secondSummary).toEqual(firstSummary);
    await expect(
      countRows('healthcare_facilities', [
        config.primaryFacility.id,
        config.otherFacility.id,
      ]),
    ).resolves.toBe('2');
    await expect(
      countRows(
        'practitioners',
        config.practitioners.map((practitioner) => practitioner.id),
      ),
    ).resolves.toBe('3');
    await expect(
      countRows(
        'patients',
        config.patients.map((patient) => patient.id),
      ),
    ).resolves.toBe('3');
    await expect(
      countRows('appointments', [config.appointment.id]),
    ).resolves.toBe('1');
    const workingHourRows = await pool.query<{ count: string }>(
      `
        SELECT COUNT(*)::text AS count
        FROM practitioner_working_hours
        WHERE practitioner_id = ANY($1::uuid[])
          AND facility_id = $2
          AND is_active = true
      `,
      [
        config.practitioners
          .filter(
            (practitioner) =>
              practitioner.facilityId === config.primaryFacility.id,
          )
          .map((practitioner) => practitioner.id),
        config.primaryFacility.id,
      ],
    );
    expect(workingHourRows.rows[0]!.count).toBe('20');

    const actorRows = await pool.query<{ count: string }>(
      `
        SELECT COUNT(*)::text AS count
        FROM workforce_actors
        WHERE oidc_issuer = $1
          AND oidc_subject = $2
      `,
      [config.oidcIssuer, config.oidcSubject],
    );
    expect(actorRows.rows[0]!.count).toBe('1');

    const schedulerRows = await pool.query<{ count: string }>(
      `
        SELECT COUNT(*)::text AS count
        FROM workforce_role_assignments
        WHERE actor_id = $1
          AND role = 'SCHEDULER'
          AND facility_id = $2
          AND is_active = true
      `,
      [config.actorId, config.primaryFacility.id],
    );
    expect(schedulerRows.rows[0]!.count).toBe('1');
  });

  it('derives actor, role, and facility scope from PostgreSQL authorization data', async () => {
    const candidate = await accessService.resolveCandidate(identity());

    expect(candidate.actorId).toBe(config.actorId);
    expect(candidate.roles).toEqual([
      { role: 'SCHEDULER', facilityId: config.primaryFacility.id },
    ]);
    expect(candidate.facilityScopes).toEqual([config.primaryFacility.id]);

    await expect(
      accessService.authorize(candidate, 'listHealthcareFacilities'),
    ).resolves.toMatchObject({
      context: {
        actorId: config.actorId,
        roles: [{ role: 'SCHEDULER', facilityId: config.primaryFacility.id }],
      },
      scope: {
        actorId: config.actorId,
        facilityIds: [config.primaryFacility.id],
        isPlatformAdmin: false,
      },
    });
  });

  it('does not expose another facility through caller-supplied filters', async () => {
    const authorization = await accessService.authorize(
      await accessService.resolveCandidate(identity()),
      'listPatients',
    );

    const patients = await patientRepository.listPatients(
      {
        page: 1,
        pageSize: 20,
        facilityId: config.otherFacility.id,
      },
      authorization.scope,
    );
    const facilities = await facilityRepository.list(
      {
        page: 1,
        pageSize: 20,
      },
      authorization.scope,
    );

    expect(patients.rows).toHaveLength(0);
    expect(facilities.data.map((facility) => facility.id)).toEqual([
      config.primaryFacility.id,
    ]);
    await expect(
      accessService.authorize(
        await accessService.resolveCandidate(identity()),
        'getHealthcareFacilityById',
        undefined,
        { facilityId: config.otherFacility.id },
      ),
    ).rejects.toMatchObject({
      code: 'FACILITY_NOT_FOUND',
      statusCode: 404,
    });
  });

  it('rejects unknown and inactive OIDC subjects through the same authorization path', async () => {
    await expect(
      accessService.resolveCandidate(identity('unknown-local-demo-subject')),
    ).rejects.toMatchObject({
      code: 'AUTHENTICATION_REQUIRED',
      statusCode: 401,
    });

    await pool.query(
      `
        UPDATE workforce_actors
        SET is_active = false,
            deactivated_at = now(),
            updated_at = now()
        WHERE id = $1
      `,
      [config.actorId],
    );
    await expect(
      accessService.resolveCandidate(identity()),
    ).rejects.toMatchObject({
      code: 'AUTHENTICATION_REQUIRED',
      statusCode: 401,
    });
    await pool.query(
      `
        UPDATE workforce_actors
        SET is_active = true,
            deactivated_at = NULL,
            updated_at = now()
        WHERE id = $1
      `,
      [config.actorId],
    );
  });
});
