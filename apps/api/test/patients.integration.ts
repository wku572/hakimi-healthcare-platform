import crypto from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import {
  createDatabaseReadinessCheck,
  createPostgresPool,
} from '../src/database.js';
import { loadEnvironment } from '../src/env.js';
import { createHealthcareFacilitiesModule } from '../src/facilities/module.js';
import { createPatientsModule } from '../src/patients/module.js';
import { runMigrationCommand } from '../src/migrations/runner.js';

if (process.env.NODE_ENV === 'production') {
  throw new Error('test:integration:db refuses to run in production.');
}

const createdFacilityIds: string[] = [];
const createdPatientIds: string[] = [];
const createdRegistrationIds: string[] = [];

function uniqueSuffix() {
  return crypto.randomUUID().slice(0, 8).toUpperCase();
}

function trackFacilityId(id: string) {
  createdFacilityIds.push(id);
}

function trackPatientId(id: string) {
  createdPatientIds.push(id);
}

function trackRegistrationId(id: string) {
  createdRegistrationIds.push(id);
}

async function deleteTrackedRows(pool: ReturnType<typeof createPostgresPool>) {
  if (createdRegistrationIds.length > 0) {
    await pool.query(
      'DELETE FROM patient_facility_registrations WHERE id = ANY($1::uuid[])',
      [createdRegistrationIds],
    );
  }

  if (createdPatientIds.length > 0) {
    await pool.query('DELETE FROM patients WHERE id = ANY($1::uuid[])', [
      createdPatientIds,
    ]);
  }

  if (createdFacilityIds.length > 0) {
    await pool.query(
      'DELETE FROM healthcare_facilities WHERE id = ANY($1::uuid[])',
      [createdFacilityIds],
    );
  }
}

describe.sequential('PostgreSQL patient integration', () => {
  const env = loadEnvironment();
  const pool = createPostgresPool(env.DATABASE_URL);
  const readinessCheck = createDatabaseReadinessCheck(pool);
  const facilitiesModule = createHealthcareFacilitiesModule(pool);
  const patientsModule = createPatientsModule(pool);
  const app = createApp({
    readinessCheck,
    facilitiesRouter: facilitiesModule.router,
    patientsRouter: patientsModule.router,
  });

  beforeAll(async () => {
    await runMigrationCommand('up');
  });

  afterAll(async () => {
    await deleteTrackedRows(pool);
    await pool.end();
  });

  it('supports patient CRUD, facility-scoped MRNs, and registration hydration', async () => {
    const facilityCodeA = `fac-${uniqueSuffix()}`;
    const facilityCodeB = `alt-${uniqueSuffix()}`;
    const primaryMrn = `MRN-${uniqueSuffix()}`;
    const secondaryMrn = `MRN-${uniqueSuffix()}`;

    const createFacilityAResponse = await request(app)
      .post('/api/v1/facilities')
      .send({
        code: facilityCodeA,
        name: 'Integration Sunrise Clinic',
        facilityType: 'clinic',
        licenseNumber: `LIC-${uniqueSuffix()}`,
        region: 'Addis Ababa',
        city: 'Addis Ababa',
        isActive: true,
      });

    const createFacilityBResponse = await request(app)
      .post('/api/v1/facilities')
      .send({
        code: facilityCodeB,
        name: 'Integration Horizon Clinic',
        facilityType: 'clinic',
        licenseNumber: `LIC-${uniqueSuffix()}`,
        region: 'Oromia',
        city: 'Adama',
        isActive: true,
      });

    expect(createFacilityAResponse.status).toBe(201);
    expect(createFacilityBResponse.status).toBe(201);

    const facilityA = createFacilityAResponse.body;
    const facilityB = createFacilityBResponse.body;
    trackFacilityId(facilityA.id);
    trackFacilityId(facilityB.id);

    const createPatientAResponse = await request(app)
      .post('/api/v1/patients')
      .send({
        facilityId: facilityA.id,
        medicalRecordNumber: primaryMrn,
        firstName: 'Mekdes',
        lastName: 'Tadesse',
        dateOfBirth: '1995-01-01',
        administrativeSex: 'female',
        phone: '+251911111111',
        email: 'mekdes.integration@example.org',
        city: 'Addis Ababa',
        region: 'Addis Ababa',
      });

    expect(createPatientAResponse.status).toBe(201);
    const patientA = createPatientAResponse.body;
    trackPatientId(patientA.id);
    trackRegistrationId(patientA.registrations[0].id);

    const secondRegistrationInsert = await pool.query<{ id: string }>(
      `
        INSERT INTO patient_facility_registrations (
          patient_id,
          facility_id,
          medical_record_number
        )
        VALUES ($1, $2, $3)
        RETURNING id
      `,
      [patientA.id, facilityB.id, secondaryMrn],
    );
    const secondRegistrationId = secondRegistrationInsert.rows[0]?.id;

    if (!secondRegistrationId) {
      throw new Error(
        'Failed to create the second registration for patient A.',
      );
    }

    trackRegistrationId(secondRegistrationId);

    const createPatientBResponse = await request(app)
      .post('/api/v1/patients')
      .send({
        facilityId: facilityB.id,
        medicalRecordNumber: primaryMrn,
        firstName: 'Aster',
        lastName: 'Adane',
        dateOfBirth: '1992-02-02',
        administrativeSex: 'female',
        phone: '+251911111111',
        email: 'mekdes.integration@example.org',
        city: 'Adama',
        region: 'Oromia',
      });

    expect(createPatientBResponse.status).toBe(201);
    const patientB = createPatientBResponse.body;
    trackPatientId(patientB.id);
    trackRegistrationId(patientB.registrations[0].id);

    const getPatientAResponse = await request(app).get(
      `/api/v1/patients/${patientA.id}`,
    );
    expect(getPatientAResponse.status).toBe(200);
    expect(getPatientAResponse.body.registrations).toHaveLength(2);
    expect(
      getPatientAResponse.body.registrations.map(
        (registration: { medicalRecordNumber: string }) =>
          registration.medicalRecordNumber,
      ),
    ).toEqual([primaryMrn, secondaryMrn]);

    const facilityFilteredResponse = await request(app)
      .get('/api/v1/patients')
      .query({
        facilityId: facilityB.id,
      });
    expect(facilityFilteredResponse.status).toBe(200);
    expect(facilityFilteredResponse.body.data).toHaveLength(2);
    expect(
      facilityFilteredResponse.body.data.some(
        (item: { id: string }) => item.id === patientA.id,
      ),
    ).toBe(true);
    expect(
      facilityFilteredResponse.body.data.some(
        (item: { id: string }) => item.id === patientB.id,
      ),
    ).toBe(true);

    const mrnFilteredResponse = await request(app)
      .get('/api/v1/patients')
      .query({
        medicalRecordNumber: primaryMrn,
      });
    expect(mrnFilteredResponse.status).toBe(200);
    expect(mrnFilteredResponse.body.data).toHaveLength(2);
    expect(mrnFilteredResponse.body.data[0].lastName).toBe('Adane');
    expect(mrnFilteredResponse.body.data[1].lastName).toBe('Tadesse');

    const duplicatePhoneEmailResponse = await request(app)
      .post('/api/v1/patients')
      .send({
        facilityId: facilityA.id,
        medicalRecordNumber: `MRN-${uniqueSuffix()}`,
        firstName: 'Same Contact',
        lastName: 'Example',
        dateOfBirth: '1990-03-03',
        administrativeSex: 'other',
        phone: '+251911111111',
        email: 'mekdes.integration@example.org',
      });
    expect(duplicatePhoneEmailResponse.status).toBe(201);
    trackPatientId(duplicatePhoneEmailResponse.body.id);
    trackRegistrationId(duplicatePhoneEmailResponse.body.registrations[0].id);

    const patchPatientAResponse = await request(app)
      .patch(`/api/v1/patients/${patientA.id}`)
      .send({
        firstName: '  Mekdes Updated  ',
        email: '  MEKDES.UPDATED@EXAMPLE.ORG  ',
      });

    expect(patchPatientAResponse.status).toBe(200);
    expect(patchPatientAResponse.body.firstName).toBe('Mekdes Updated');
    expect(patchPatientAResponse.body.email).toBe('mekdes.updated@example.org');

    const deletePatientAResponse = await request(app).delete(
      `/api/v1/patients/${patientA.id}`,
    );
    const repeatDeletePatientAResponse = await request(app).delete(
      `/api/v1/patients/${patientA.id}`,
    );

    expect(deletePatientAResponse.status).toBe(204);
    expect(deletePatientAResponse.text).toBe('');
    expect(repeatDeletePatientAResponse.status).toBe(204);

    const inactivePatientResponse = await request(app).get(
      `/api/v1/patients/${patientA.id}`,
    );
    expect(inactivePatientResponse.status).toBe(200);
    expect(inactivePatientResponse.body.isActive).toBe(false);

    const registrationCountResult = await pool.query<{ total_items: number }>(
      `
        SELECT COUNT(*)::int AS total_items
        FROM patient_facility_registrations
        WHERE patient_id = $1
      `,
      [patientA.id],
    );
    expect(registrationCountResult.rows[0]?.total_items).toBe(2);
  });

  it('rejects duplicate same-facility MRNs and rolls back concurrent duplicates', async () => {
    const facilityCode = `dup-${uniqueSuffix()}`;
    const mrn = `MRN-${uniqueSuffix()}`;

    const facilityResponse = await request(app)
      .post('/api/v1/facilities')
      .send({
        code: facilityCode,
        name: 'Integration Duplicate Clinic',
        facilityType: 'clinic',
        licenseNumber: `LIC-${uniqueSuffix()}`,
        region: 'Amhara',
        city: 'Bahir Dar',
        isActive: true,
      });
    expect(facilityResponse.status).toBe(201);

    const facility = facilityResponse.body;
    trackFacilityId(facility.id);

    const firstCreateResponse = await request(app)
      .post('/api/v1/patients')
      .send({
        facilityId: facility.id,
        medicalRecordNumber: mrn,
        firstName: 'Duplicate',
        lastName: 'Patient',
        administrativeSex: 'female',
      });
    expect(firstCreateResponse.status).toBe(201);
    trackPatientId(firstCreateResponse.body.id);
    trackRegistrationId(firstCreateResponse.body.registrations[0].id);

    const sameFacilityConflictResponse = await request(app)
      .post('/api/v1/patients')
      .send({
        facilityId: facility.id,
        medicalRecordNumber: mrn,
        firstName: 'Duplicate Two',
        lastName: 'Patient',
        administrativeSex: 'female',
      });
    expect(sameFacilityConflictResponse.status).toBe(409);
    expect(sameFacilityConflictResponse.body.error.code).toBe(
      'PATIENT_REGISTRATION_CONFLICT',
    );

    const concurrentMrn = `MRN-${uniqueSuffix()}`;
    const concurrentPayload = {
      facilityId: facility.id,
      medicalRecordNumber: concurrentMrn,
      firstName: 'Concurrent',
      lastName: 'Rollback',
      administrativeSex: 'female',
    };

    const [firstConcurrentResponse, secondConcurrentResponse] =
      await Promise.all([
        request(app).post('/api/v1/patients').send(concurrentPayload),
        request(app).post('/api/v1/patients').send(concurrentPayload),
      ]);

    const concurrentStatuses = [
      firstConcurrentResponse.status,
      secondConcurrentResponse.status,
    ].sort();
    expect(concurrentStatuses).toEqual([201, 409]);

    const successfulConcurrentResponse =
      firstConcurrentResponse.status === 201
        ? firstConcurrentResponse
        : secondConcurrentResponse;

    trackPatientId(successfulConcurrentResponse.body.id);
    trackRegistrationId(successfulConcurrentResponse.body.registrations[0].id);

    expect(
      [firstConcurrentResponse, secondConcurrentResponse].find(
        (response) => response.status === 409,
      )?.body.error.code,
    ).toBe('PATIENT_REGISTRATION_CONFLICT');

    const rollbackLeakCheck = await pool.query<{ total_items: number }>(
      `
        SELECT COUNT(*)::int AS total_items
        FROM patients
        WHERE first_name = $1
      `,
      ['Concurrent'],
    );
    expect(rollbackLeakCheck.rows[0]?.total_items).toBe(1);
  });
});
