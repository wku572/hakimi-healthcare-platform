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
import { createPractitionersModule } from '../src/practitioners/module.js';
import { runMigrationCommand } from '../src/migrations/runner.js';

if (process.env.NODE_ENV === 'production') {
  throw new Error('test:integration:db refuses to run in production.');
}

const createdFacilityIds: string[] = [];
const createdPractitionerIds: string[] = [];
const createdAssignmentIds: string[] = [];

function uniqueSuffix() {
  return crypto.randomUUID().slice(0, 8).toUpperCase();
}

function trackFacilityId(id: string) {
  createdFacilityIds.push(id);
}

function trackPractitionerId(id: string) {
  createdPractitionerIds.push(id);
}

function trackAssignmentId(id: string) {
  createdAssignmentIds.push(id);
}

describe.sequential('PostgreSQL practitioner integration', () => {
  const env = loadEnvironment();
  const pool = createPostgresPool(env.DATABASE_URL);
  const readinessCheck = createDatabaseReadinessCheck(pool);
  const facilitiesModule = createHealthcareFacilitiesModule(pool);
  const practitionersModule = createPractitionersModule(pool);
  const app = createApp({
    readinessCheck,
    facilitiesRouter: facilitiesModule.router,
    practitionersRouter: practitionersModule.router,
  });

  beforeAll(async () => {
    await runMigrationCommand('up');
  });

  afterAll(async () => {
    if (createdAssignmentIds.length > 0) {
      await pool.query(
        'DELETE FROM practitioner_facility_assignments WHERE id = ANY($1::uuid[])',
        [createdAssignmentIds],
      );
    }

    if (createdPractitionerIds.length > 0) {
      await pool.query('DELETE FROM practitioners WHERE id = ANY($1::uuid[])', [
        createdPractitionerIds,
      ]);
    }

    if (createdFacilityIds.length > 0) {
      await pool.query(
        'DELETE FROM healthcare_facilities WHERE id = ANY($1::uuid[])',
        [createdFacilityIds],
      );
    }

    await pool.end();
  });

  it('supports practitioner CRUD, conflicts, facility filtering, and assignment primary reassignment', async () => {
    const facilityCodeA = `fac-${uniqueSuffix()}`;
    const facilityCodeB = `alt-${uniqueSuffix()}`;
    const practitionerCode = `prac-${uniqueSuffix()}`;
    const duplicateLicense = `MED-${uniqueSuffix()}`;

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

    const healthLiveResponse = await request(app).get('/health/live');
    const healthReadyResponse = await request(app).get('/health/ready');
    expect(healthLiveResponse.status).toBe(200);
    expect(healthLiveResponse.body.status).toBe('ok');
    expect(healthReadyResponse.status).toBe(200);
    expect(healthReadyResponse.body.status).toBe('ready');

    const createPractitionerResponse = await request(app)
      .post('/api/v1/practitioners')
      .send({
        code: practitionerCode,
        firstName: 'Mekdes',
        middleName: 'A.',
        lastName: 'Tadesse',
        profession: 'general practitioner',
        licenseNumber: duplicateLicense,
        phone: '+251911111111',
        email: 'Mekdes.Integration@Example.ORG',
        bio: 'Integration test practitioner',
        isActive: true,
      });

    expect(createPractitionerResponse.status).toBe(201);
    expect(createPractitionerResponse.headers.location).toBeDefined();

    const practitioner = createPractitionerResponse.body;
    trackPractitionerId(practitioner.id);

    const getPractitionerResponse = await request(app).get(
      `/api/v1/practitioners/${practitioner.id}`,
    );
    expect(getPractitionerResponse.status).toBe(200);
    expect(getPractitionerResponse.body.code).toBe(
      practitionerCode.toUpperCase(),
    );
    expect(getPractitionerResponse.body.email).toBe(
      'mekdes.integration@example.org',
    );

    const createDuplicateCodeResponse = await request(app)
      .post('/api/v1/practitioners')
      .send({
        code: practitionerCode.toLowerCase(),
        firstName: 'Duplicate',
        lastName: 'Person',
        profession: 'general practitioner',
        licenseNumber: `MED-${uniqueSuffix()}`,
      });
    expect(createDuplicateCodeResponse.status).toBe(409);
    expect(createDuplicateCodeResponse.body.error.code).toBe(
      'PRACTITIONER_CODE_CONFLICT',
    );

    const createDuplicateLicenseResponse = await request(app)
      .post('/api/v1/practitioners')
      .send({
        code: `OTHER-${uniqueSuffix()}`,
        firstName: 'Duplicate',
        lastName: 'Person',
        profession: 'general practitioner',
        licenseNumber: duplicateLicense,
      });
    expect(createDuplicateLicenseResponse.status).toBe(409);
    expect(createDuplicateLicenseResponse.body.error.code).toBe(
      'PRACTITIONER_LICENSE_CONFLICT',
    );

    const patchPractitionerResponse = await request(app)
      .patch(`/api/v1/practitioners/${practitioner.id}`)
      .send({
        firstName: 'Mekdes Updated',
        email: 'Mekdes.Updated@Example.ORG',
      });

    expect(patchPractitionerResponse.status).toBe(200);
    expect(patchPractitionerResponse.body.firstName).toBe('Mekdes Updated');
    expect(patchPractitionerResponse.body.email).toBe(
      'mekdes.updated@example.org',
    );
    expect(patchPractitionerResponse.body.updatedAt).not.toBe(
      practitioner.updatedAt,
    );

    await new Promise((resolve) => setTimeout(resolve, 25));

    const createAssignmentAResponse = await request(app)
      .post(`/api/v1/practitioners/${practitioner.id}/facilities`)
      .send({
        facilityId: facilityA.id,
        roleTitle: 'Primary Physician',
        isPrimary: true,
      });
    expect(createAssignmentAResponse.status).toBe(201);
    trackAssignmentId(createAssignmentAResponse.body.id);

    const createAssignmentBResponse = await request(app)
      .post(`/api/v1/practitioners/${practitioner.id}/facilities`)
      .send({
        facilityId: facilityB.id,
        roleTitle: 'Secondary Physician',
      });
    expect(createAssignmentBResponse.status).toBe(201);
    trackAssignmentId(createAssignmentBResponse.body.id);

    const duplicateAssignmentResponse = await request(app)
      .post(`/api/v1/practitioners/${practitioner.id}/facilities`)
      .send({
        facilityId: facilityB.id,
        roleTitle: 'Duplicate Assignment',
      });
    expect(duplicateAssignmentResponse.status).toBe(409);
    expect(duplicateAssignmentResponse.body.error.code).toBe(
      'ASSIGNMENT_CONFLICT',
    );

    const listAssignmentsBeforePatchResponse = await request(app).get(
      `/api/v1/practitioners/${practitioner.id}/facilities`,
    );
    expect(listAssignmentsBeforePatchResponse.status).toBe(200);
    expect(listAssignmentsBeforePatchResponse.body.data).toHaveLength(2);
    expect(
      listAssignmentsBeforePatchResponse.body.data.find(
        (item: { id: string }) => item.id === createAssignmentAResponse.body.id,
      ).isPrimary,
    ).toBe(true);

    const patchAssignmentBResponse = await request(app)
      .patch(
        `/api/v1/practitioners/${practitioner.id}/facilities/${createAssignmentBResponse.body.id}`,
      )
      .send({
        isPrimary: true,
      });
    expect(patchAssignmentBResponse.status).toBe(200);
    expect(patchAssignmentBResponse.body.isPrimary).toBe(true);

    const listAssignmentsAfterPatchResponse = await request(app).get(
      `/api/v1/practitioners/${practitioner.id}/facilities`,
    );
    expect(listAssignmentsAfterPatchResponse.status).toBe(200);
    expect(listAssignmentsAfterPatchResponse.body.data).toHaveLength(2);
    expect(
      listAssignmentsAfterPatchResponse.body.data.find(
        (item: { id: string }) => item.id === createAssignmentAResponse.body.id,
      ).isPrimary,
    ).toBe(false);
    expect(
      listAssignmentsAfterPatchResponse.body.data.find(
        (item: { id: string }) => item.id === createAssignmentBResponse.body.id,
      ).isPrimary,
    ).toBe(true);

    const facilityFilteredResponse = await request(app)
      .get('/api/v1/practitioners')
      .query({
        facilityId: facilityA.id,
      });
    expect(facilityFilteredResponse.status).toBe(200);
    expect(
      facilityFilteredResponse.body.data.some(
        (item: { id: string }) => item.id === practitioner.id,
      ),
    ).toBe(true);

    const duplicateFacilityFilterResponse = await request(app)
      .get('/api/v1/practitioners')
      .query({
        facilityId: facilityB.id,
      });
    expect(duplicateFacilityFilterResponse.status).toBe(200);
    expect(
      duplicateFacilityFilterResponse.body.data.some(
        (item: { id: string }) => item.id === practitioner.id,
      ),
    ).toBe(true);

    const duplicateAssignmentPatchResponse = await request(app)
      .patch(
        `/api/v1/practitioners/${practitioner.id}/facilities/${createAssignmentBResponse.body.id}`,
      )
      .send({
        isPrimary: true,
      });
    expect(duplicateAssignmentPatchResponse.status).toBe(200);

    const deleteAssignmentResponse = await request(app).delete(
      `/api/v1/practitioners/${practitioner.id}/facilities/${createAssignmentAResponse.body.id}`,
    );
    const repeatDeleteAssignmentResponse = await request(app).delete(
      `/api/v1/practitioners/${practitioner.id}/facilities/${createAssignmentAResponse.body.id}`,
    );
    expect(deleteAssignmentResponse.status).toBe(204);
    expect(deleteAssignmentResponse.text).toBe('');
    expect(repeatDeleteAssignmentResponse.status).toBe(204);

    const inactiveAssignmentsResponse = await request(app).get(
      `/api/v1/practitioners/${practitioner.id}/facilities`,
    );
    expect(
      inactiveAssignmentsResponse.body.data.find(
        (item: { id: string }) => item.id === createAssignmentAResponse.body.id,
      ).isActive,
    ).toBe(false);
    expect(
      inactiveAssignmentsResponse.body.data.find(
        (item: { id: string }) => item.id === createAssignmentAResponse.body.id,
      ).isPrimary,
    ).toBe(false);

    const deletePractitionerResponse = await request(app).delete(
      `/api/v1/practitioners/${practitioner.id}`,
    );
    expect(deletePractitionerResponse.status).toBe(204);

    const getInactivePractitionerResponse = await request(app).get(
      `/api/v1/practitioners/${practitioner.id}`,
    );
    expect(getInactivePractitionerResponse.status).toBe(200);
    expect(getInactivePractitionerResponse.body.isActive).toBe(false);

    const inactiveFilterResponse = await request(app)
      .get('/api/v1/practitioners')
      .query({
        isActive: 'false',
      });
    expect(
      inactiveFilterResponse.body.data.some(
        (item: { id: string }) => item.id === practitioner.id,
      ),
    ).toBe(true);
  });
});
