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
import { runMigrationCommand } from '../src/migrations/runner.js';

if (process.env.NODE_ENV === 'production') {
  throw new Error('test:integration:db refuses to run in production.');
}

const createdFacilityIds: string[] = [];

function uniqueSuffix() {
  return crypto.randomUUID().slice(0, 8).toUpperCase();
}

function trackFacilityId(id: string) {
  createdFacilityIds.push(id);
}

describe.sequential('PostgreSQL facility integration', () => {
  const env = loadEnvironment();
  const pool = createPostgresPool(env.DATABASE_URL);
  const readinessCheck = createDatabaseReadinessCheck(pool);
  const facilitiesModule = createHealthcareFacilitiesModule(pool);
  const app = createApp({
    readinessCheck,
    facilitiesRouter: facilitiesModule.router,
  });

  beforeAll(async () => {
    await runMigrationCommand('up');
  });

  afterAll(async () => {
    if (createdFacilityIds.length > 0) {
      await pool.query(
        'DELETE FROM healthcare_facilities WHERE id = ANY($1::uuid[])',
        [createdFacilityIds],
      );
    }

    await pool.end();
  });

  it('supports the full facility lifecycle and expected conflicts', async () => {
    const primaryCode = `int-${uniqueSuffix()}`;
    const primaryLicense = `LN-${uniqueSuffix()}`;
    const secondaryCode = `alt-${uniqueSuffix()}`;
    const secondaryLicense = `ALT-${uniqueSuffix()}`;

    const createPrimaryResponse = await request(app)
      .post('/api/v1/facilities')
      .send({
        code: primaryCode,
        name: 'Integration Alpha Clinic',
        facilityType: 'clinic',
        licenseNumber: primaryLicense,
        phone: '+251911100100',
        email: 'alpha.integration@example.org',
        region: 'Addis Ababa',
        city: 'Addis Ababa',
        addressLine: 'Bole Road',
        isActive: true,
      });

    expect(createPrimaryResponse.status).toBe(201);
    expect(createPrimaryResponse.headers.location).toBeDefined();

    const primary = createPrimaryResponse.body;
    trackFacilityId(primary.id);

    const getPrimaryResponse = await request(app).get(
      `/api/v1/facilities/${primary.id}`,
    );
    expect(getPrimaryResponse.status).toBe(200);
    expect(getPrimaryResponse.body.code).toBe(primaryCode.toUpperCase());

    const listActiveResponse = await request(app)
      .get('/api/v1/facilities')
      .query({
        facilityType: 'clinic',
        region: 'Addis Ababa',
        city: 'Addis Ababa',
        isActive: 'true',
        search: 'alpha',
      });
    expect(listActiveResponse.status).toBe(200);
    expect(
      listActiveResponse.body.pagination.totalItems,
    ).toBeGreaterThanOrEqual(1);
    expect(
      listActiveResponse.body.data.some(
        (item: { id: string }) => item.id === primary.id,
      ),
    ).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 25));

    const patchPrimaryResponse = await request(app)
      .patch(`/api/v1/facilities/${primary.id}`)
      .send({
        name: 'Integration Alpha Clinic Updated',
      });
    expect(patchPrimaryResponse.status).toBe(200);
    expect(patchPrimaryResponse.body.name).toBe(
      'Integration Alpha Clinic Updated',
    );
    expect(patchPrimaryResponse.body.updatedAt).not.toBe(primary.updatedAt);

    const createConflictResponse = await request(app)
      .post('/api/v1/facilities')
      .send({
        code: primaryCode.toLowerCase(),
        name: 'Integration Duplicate Code Clinic',
        facilityType: 'clinic',
        licenseNumber: `LN-${uniqueSuffix()}`,
        region: 'Oromia',
        city: 'Adama',
      });
    expect(createConflictResponse.status).toBe(409);
    expect(createConflictResponse.body.error.code).toBe(
      'FACILITY_CODE_CONFLICT',
    );

    const createSecondaryResponse = await request(app)
      .post('/api/v1/facilities')
      .send({
        code: secondaryCode,
        name: 'Integration Beta Clinic',
        facilityType: 'clinic',
        licenseNumber: secondaryLicense,
        region: 'Oromia',
        city: 'Adama',
        isActive: true,
      });

    expect(createSecondaryResponse.status).toBe(201);
    const secondary = createSecondaryResponse.body;
    trackFacilityId(secondary.id);

    const patchLicenseConflictResponse = await request(app)
      .patch(`/api/v1/facilities/${primary.id}`)
      .send({
        licenseNumber: secondaryLicense,
      });
    expect(patchLicenseConflictResponse.status).toBe(409);
    expect(patchLicenseConflictResponse.body.error.code).toBe(
      'FACILITY_LICENSE_CONFLICT',
    );

    const deletePrimaryResponse = await request(app).delete(
      `/api/v1/facilities/${primary.id}`,
    );
    expect(deletePrimaryResponse.status).toBe(204);
    expect(deletePrimaryResponse.text).toBe('');

    const repeatDeleteResponse = await request(app).delete(
      `/api/v1/facilities/${primary.id}`,
    );
    expect(repeatDeleteResponse.status).toBe(204);

    const getAfterDeleteResponse = await request(app).get(
      `/api/v1/facilities/${primary.id}`,
    );
    expect(getAfterDeleteResponse.status).toBe(200);
    expect(getAfterDeleteResponse.body.isActive).toBe(false);

    const listInactiveResponse = await request(app)
      .get('/api/v1/facilities')
      .query({
        isActive: 'false',
        city: 'Addis Ababa',
      });
    expect(listInactiveResponse.status).toBe(200);
    expect(
      listInactiveResponse.body.data.some(
        (item: { id: string }) => item.id === primary.id,
      ),
    ).toBe(true);

    const reactivateResponse = await request(app)
      .patch(`/api/v1/facilities/${primary.id}`)
      .send({
        isActive: true,
      });
    expect(reactivateResponse.status).toBe(200);
    expect(reactivateResponse.body.isActive).toBe(true);
  });
});
