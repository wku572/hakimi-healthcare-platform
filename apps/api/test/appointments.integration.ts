import crypto from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import {
  createDatabaseReadinessCheck,
  createPostgresPool,
} from '../src/database.js';
import { loadEnvironment } from '../src/env.js';
import { createAppointmentsModule } from '../src/appointments/module.js';
import { createHealthcareFacilitiesModule } from '../src/facilities/module.js';
import { createPatientsModule } from '../src/patients/module.js';
import { createPractitionersModule } from '../src/practitioners/module.js';
import { runMigrationCommand } from '../src/migrations/runner.js';
import {
  allowAllAccessMiddleware,
  allowAllRouteAuthorizer,
} from './helpers/access.js';

if (process.env.NODE_ENV === 'production') {
  throw new Error('test:integration:db refuses to run in production.');
}

const createdFacilityIds: string[] = [];
const createdPractitionerIds: string[] = [];
const createdAssignmentIds: string[] = [];
const createdPatientIds: string[] = [];
const createdRegistrationIds: string[] = [];
const createdAppointmentIds: string[] = [];

function uniqueSuffix() {
  return crypto.randomUUID().slice(0, 8).toUpperCase();
}

function appointmentDateIso() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 2);
  return tomorrow.toISOString().slice(0, 10);
}

function isoAt(dayIso: string, time: string) {
  return `${dayIso}T${time}:00+03:00`;
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

function trackPatientId(id: string) {
  createdPatientIds.push(id);
}

function trackRegistrationId(id: string) {
  createdRegistrationIds.push(id);
}

function trackAppointmentId(id: string) {
  createdAppointmentIds.push(id);
}

async function deleteTrackedRows(pool: ReturnType<typeof createPostgresPool>) {
  if (createdAppointmentIds.length > 0) {
    await pool.query(
      'DELETE FROM appointment_reminders WHERE appointment_id = ANY($1::uuid[])',
      [createdAppointmentIds],
    );
  }

  if (createdAppointmentIds.length > 0) {
    await pool.query('DELETE FROM appointments WHERE id = ANY($1::uuid[])', [
      createdAppointmentIds,
    ]);
  }

  if (createdRegistrationIds.length > 0) {
    await pool.query(
      'DELETE FROM patient_facility_registrations WHERE id = ANY($1::uuid[])',
      [createdRegistrationIds],
    );
  }

  if (createdAssignmentIds.length > 0) {
    await pool.query(
      'DELETE FROM practitioner_facility_assignments WHERE id = ANY($1::uuid[])',
      [createdAssignmentIds],
    );
  }

  if (createdPatientIds.length > 0) {
    await pool.query('DELETE FROM patients WHERE id = ANY($1::uuid[])', [
      createdPatientIds,
    ]);
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
}

describe.sequential('PostgreSQL appointment integration', () => {
  const env = loadEnvironment();
  const pool = createPostgresPool(env.DATABASE_URL);
  const readinessCheck = createDatabaseReadinessCheck(pool);
  const facilitiesModule = createHealthcareFacilitiesModule(
    pool,
    allowAllRouteAuthorizer,
  );
  const practitionersModule = createPractitionersModule(
    pool,
    allowAllRouteAuthorizer,
  );
  const patientsModule = createPatientsModule(pool, allowAllRouteAuthorizer);
  const appointmentsModule = createAppointmentsModule(
    pool,
    allowAllRouteAuthorizer,
  );
  const app = createApp({
    readinessCheck,
    facilitiesRouter: facilitiesModule.router,
    practitionersRouter: practitionersModule.router,
    patientsRouter: patientsModule.router,
    appointmentsRouter: appointmentsModule.router,
    accessAuthenticationMiddleware: allowAllAccessMiddleware,
  });

  beforeAll(async () => {
    await runMigrationCommand('up');
  });

  afterAll(async () => {
    await deleteTrackedRows(pool);
    await pool.end();
  });

  it('schedules appointments, enforces overlap safety, and preserves history', async () => {
    const facilityCode = `fac-${uniqueSuffix()}`;
    const practitionerCode = `prac-${uniqueSuffix()}`;
    const mrn = `MRN-${uniqueSuffix()}`;
    const dayIso = appointmentDateIso();

    const createFacilityResponse = await request(app)
      .post('/api/v1/facilities')
      .send({
        code: facilityCode,
        name: 'Integration Sunrise Clinic',
        facilityType: 'clinic',
        licenseNumber: `LIC-${uniqueSuffix()}`,
        region: 'Addis Ababa',
        city: 'Addis Ababa',
        isActive: true,
      });
    expect(createFacilityResponse.status).toBe(201);
    const facility = createFacilityResponse.body;
    trackFacilityId(facility.id);

    const createPractitionerResponse = await request(app)
      .post('/api/v1/practitioners')
      .send({
        code: practitionerCode,
        firstName: 'Abebe',
        lastName: 'Kebede',
        profession: 'general practitioner',
        licenseNumber: `LIC-${uniqueSuffix()}`,
        phone: '+251911111111',
        email: 'abebe.integration@example.org',
        bio: 'Integration test practitioner',
        isActive: true,
      });
    expect(createPractitionerResponse.status).toBe(201);
    const practitioner = createPractitionerResponse.body;
    trackPractitionerId(practitioner.id);

    const createAssignmentResponse = await request(app)
      .post(`/api/v1/practitioners/${practitioner.id}/facilities`)
      .send({
        facilityId: facility.id,
        roleTitle: 'Physician',
        isPrimary: true,
        isActive: true,
      });
    expect(createAssignmentResponse.status).toBe(201);
    trackAssignmentId(createAssignmentResponse.body.id);

    const createPatientResponse = await request(app)
      .post('/api/v1/patients')
      .send({
        facilityId: facility.id,
        medicalRecordNumber: mrn,
        firstName: 'Mekdes',
        lastName: 'Tadesse',
        dateOfBirth: '1995-01-01',
        administrativeSex: 'female',
        phone: '+251911111111',
        email: 'mekdes.integration@example.org',
        city: 'Addis Ababa',
        region: 'Addis Ababa',
      });
    expect(createPatientResponse.status).toBe(201);
    const patient = createPatientResponse.body;
    trackPatientId(patient.id);
    trackRegistrationId(patient.registrations[0].id);

    const appointmentAResponse = await request(app)
      .post('/api/v1/appointments')
      .send({
        patientId: patient.id,
        practitionerId: practitioner.id,
        facilityId: facility.id,
        scheduledStart: isoAt(dayIso, '09:00'),
        scheduledEnd: isoAt(dayIso, '09:30'),
      });
    expect(appointmentAResponse.status).toBe(201);
    expect(appointmentAResponse.body.status).toBe('SCHEDULED');
    trackAppointmentId(appointmentAResponse.body.id);

    const appointmentBResponse = await request(app)
      .post('/api/v1/appointments')
      .send({
        patientId: patient.id,
        practitionerId: practitioner.id,
        facilityId: facility.id,
        scheduledStart: isoAt(dayIso, '09:30'),
        scheduledEnd: isoAt(dayIso, '10:00'),
      });
    expect(appointmentBResponse.status).toBe(201);
    trackAppointmentId(appointmentBResponse.body.id);

    const [concurrentOne, concurrentTwo] = await Promise.all([
      request(app)
        .post('/api/v1/appointments')
        .send({
          patientId: patient.id,
          practitionerId: practitioner.id,
          facilityId: facility.id,
          scheduledStart: isoAt(dayIso, '10:00'),
          scheduledEnd: isoAt(dayIso, '10:30'),
        }),
      request(app)
        .post('/api/v1/appointments')
        .send({
          patientId: patient.id,
          practitionerId: practitioner.id,
          facilityId: facility.id,
          scheduledStart: isoAt(dayIso, '10:00'),
          scheduledEnd: isoAt(dayIso, '10:30'),
        }),
    ]);

    const concurrentStatuses = [
      concurrentOne.status,
      concurrentTwo.status,
    ].sort();
    expect(concurrentStatuses).toEqual([201, 409]);

    const successfulConcurrentResponse =
      concurrentOne.status === 201 ? concurrentOne : concurrentTwo;
    const conflictConcurrentResponse =
      concurrentOne.status === 409 ? concurrentOne : concurrentTwo;

    expect(conflictConcurrentResponse.body.error.code).toBe(
      'APPOINTMENT_CONFLICT',
    );
    trackAppointmentId(successfulConcurrentResponse.body.id);

    const confirmAppointmentAResponse = await request(app)
      .patch(`/api/v1/appointments/${appointmentAResponse.body.id}`)
      .send({
        status: 'confirmed',
      });
    expect(confirmAppointmentAResponse.status).toBe(200);
    expect(confirmAppointmentAResponse.body.status).toBe('CONFIRMED');

    const appointmentARemindersAfterConfirm = await pool.query<{
      schedule_version: number;
      status: string;
    }>(
      `
        SELECT schedule_version, status
        FROM appointment_reminders
        WHERE appointment_id = $1
        ORDER BY schedule_version ASC
      `,
      [appointmentAResponse.body.id],
    );
    expect(appointmentARemindersAfterConfirm.rows).toEqual([
      {
        schedule_version: 1,
        status: 'PENDING',
      },
    ]);

    const rescheduleAppointmentAResponse = await request(app)
      .patch(`/api/v1/appointments/${appointmentAResponse.body.id}`)
      .send({
        scheduledStart: isoAt(dayIso, '08:45'),
        scheduledEnd: isoAt(dayIso, '09:15'),
      });
    expect(rescheduleAppointmentAResponse.status).toBe(200);
    expect(rescheduleAppointmentAResponse.body.scheduledStart).toBe(
      `${dayIso}T05:45:00.000Z`,
    );

    const appointmentARemindersAfterReschedule = await pool.query<{
      schedule_version: number;
      status: string;
    }>(
      `
        SELECT schedule_version, status
        FROM appointment_reminders
        WHERE appointment_id = $1
        ORDER BY schedule_version ASC
      `,
      [appointmentAResponse.body.id],
    );
    expect(appointmentARemindersAfterReschedule.rows).toEqual([
      {
        schedule_version: 1,
        status: 'SUPERSEDED',
      },
      {
        schedule_version: 2,
        status: 'PENDING',
      },
    ]);

    const confirmAppointmentBResponse = await request(app)
      .patch(`/api/v1/appointments/${appointmentBResponse.body.id}`)
      .send({
        status: 'confirmed',
      });
    expect(confirmAppointmentBResponse.status).toBe(200);

    const appointmentBRemindersBeforeCancel = await pool.query<{
      schedule_version: number;
      status: string;
    }>(
      `
        SELECT schedule_version, status
        FROM appointment_reminders
        WHERE appointment_id = $1
        ORDER BY schedule_version ASC
      `,
      [appointmentBResponse.body.id],
    );
    expect(appointmentBRemindersBeforeCancel.rows).toEqual([
      {
        schedule_version: 1,
        status: 'PENDING',
      },
    ]);

    const cancelAppointmentBResponse = await request(app)
      .post(`/api/v1/appointments/${appointmentBResponse.body.id}/cancel`)
      .send({
        cancellationReason: 'Patient requested a later time',
      });
    const repeatCancelAppointmentBResponse = await request(app)
      .post(`/api/v1/appointments/${appointmentBResponse.body.id}/cancel`)
      .send({
        cancellationReason: 'Patient requested a later time',
      });
    expect(cancelAppointmentBResponse.status).toBe(200);
    expect(repeatCancelAppointmentBResponse.status).toBe(200);
    expect(repeatCancelAppointmentBResponse.body).toEqual(
      cancelAppointmentBResponse.body,
    );

    const appointmentBRemindersAfterCancel = await pool.query<{
      schedule_version: number;
      status: string;
    }>(
      `
        SELECT schedule_version, status
        FROM appointment_reminders
        WHERE appointment_id = $1
        ORDER BY schedule_version ASC
      `,
      [appointmentBResponse.body.id],
    );
    expect(appointmentBRemindersAfterCancel.rows).toEqual([
      {
        schedule_version: 1,
        status: 'CANCELLED',
      },
    ]);

    const listAppointmentsResponse = await request(app)
      .get('/api/v1/appointments')
      .query({
        facilityId: facility.id,
        from: isoAt(dayIso, '09:00'),
        to: isoAt(dayIso, '11:00'),
      });
    expect(listAppointmentsResponse.status).toBe(200);
    expect(listAppointmentsResponse.body.data).toHaveLength(3);
    expect(
      listAppointmentsResponse.body.data.map((item: { id: string }) => item.id),
    ).toEqual([
      appointmentAResponse.body.id,
      appointmentBResponse.body.id,
      successfulConcurrentResponse.body.id,
    ]);

    const confirmedOnlyResponse = await request(app)
      .get('/api/v1/appointments')
      .query({
        status: 'CONFIRMED',
      });
    expect(confirmedOnlyResponse.status).toBe(200);
    expect(
      confirmedOnlyResponse.body.data.some(
        (item: { id: string }) => item.id === appointmentAResponse.body.id,
      ),
    ).toBe(true);

    const cancelledOnlyResponse = await request(app)
      .get('/api/v1/appointments')
      .query({
        status: 'CANCELLED',
      });
    expect(cancelledOnlyResponse.status).toBe(200);
    expect(
      cancelledOnlyResponse.body.data.some(
        (item: { id: string }) => item.id === appointmentBResponse.body.id,
      ),
    ).toBe(true);
  });
});
