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
const createdWorkingHourIds: string[] = [];

function uniqueSuffix() {
  return crypto.randomUUID().slice(0, 8).toUpperCase();
}

function appointmentDateIso() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 2);
  return tomorrow.toISOString().slice(0, 10);
}

function nextWeekdayDateIso(targetIsoWeekday: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 2);
  while ((date.getUTCDay() === 0 ? 7 : date.getUTCDay()) !== targetIsoWeekday) {
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return date.toISOString().slice(0, 10);
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

function trackWorkingHourId(id: string) {
  createdWorkingHourIds.push(id);
}

async function insertWorkingHours(input: {
  pool: ReturnType<typeof createPostgresPool>;
  practitionerId: string;
  facilityId: string;
  isoWeekday: number;
  localStartTime: string;
  localEndTime: string;
  slotMinutes?: number;
  effectiveStartDate?: string;
  effectiveEndDate?: string | null;
  isActive?: boolean;
}) {
  const result = await input.pool.query<{ id: string }>(
    `
      INSERT INTO practitioner_working_hours (
        practitioner_id,
        facility_id,
        iso_weekday,
        local_start_time,
        local_end_time,
        slot_minutes,
        effective_start_date,
        effective_end_date,
        is_active
      )
      VALUES ($1, $2, $3, $4::time, $5::time, $6, $7::date, $8::date, $9)
      RETURNING id
    `,
    [
      input.practitionerId,
      input.facilityId,
      input.isoWeekday,
      input.localStartTime,
      input.localEndTime,
      input.slotMinutes ?? 30,
      input.effectiveStartDate ?? '2026-01-01',
      input.effectiveEndDate ?? null,
      input.isActive ?? true,
    ],
  );
  const id = result.rows[0]!.id;
  trackWorkingHourId(id);
  return id;
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

  if (createdWorkingHourIds.length > 0) {
    await pool.query(
      'DELETE FROM practitioner_working_hours WHERE id = ANY($1::uuid[])',
      [createdWorkingHourIds],
    );
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

describe('PostgreSQL appointment integration', () => {
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

  it('lists advisory availability from working hours and non-terminal appointments only', async () => {
    const facilityCode = `avl-fac-${uniqueSuffix()}`;
    const practitionerCode = `avl-prac-${uniqueSuffix()}`;
    const mrn = `AVAIL-MRN-${uniqueSuffix()}`;
    const dayIso = nextWeekdayDateIso(1);

    const createFacilityResponse = await request(app)
      .post('/api/v1/facilities')
      .send({
        code: facilityCode,
        name: 'Integration Availability Clinic',
        facilityType: 'clinic',
        licenseNumber: `AVAIL-LIC-${uniqueSuffix()}`,
        region: 'Addis Ababa',
        city: 'Addis Ababa',
        timeZone: 'Africa/Addis_Ababa',
        isActive: true,
      });
    expect(createFacilityResponse.status).toBe(201);
    const facility = createFacilityResponse.body;
    trackFacilityId(facility.id);

    const createPractitionerResponse = await request(app)
      .post('/api/v1/practitioners')
      .send({
        code: practitionerCode,
        firstName: 'Selam',
        lastName: 'Bekele',
        profession: 'general practitioner',
        licenseNumber: `AVAIL-LIC-${uniqueSuffix()}`,
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
        firstName: 'Amina',
        lastName: 'Kebede',
        dateOfBirth: '1992-04-12',
        administrativeSex: 'female',
        city: 'Addis Ababa',
        region: 'Addis Ababa',
      });
    expect(createPatientResponse.status).toBe(201);
    const patient = createPatientResponse.body;
    trackPatientId(patient.id);
    trackRegistrationId(patient.registrations[0].id);

    await insertWorkingHours({
      pool,
      facilityId: facility.id,
      practitionerId: practitioner.id,
      isoWeekday: 1,
      localStartTime: '09:00',
      localEndTime: '10:00',
    });
    await insertWorkingHours({
      pool,
      facilityId: facility.id,
      practitionerId: practitioner.id,
      isoWeekday: 1,
      localStartTime: '10:30',
      localEndTime: '11:30',
    });
    await insertWorkingHours({
      pool,
      facilityId: facility.id,
      practitionerId: practitioner.id,
      isoWeekday: 1,
      localStartTime: '13:00',
      localEndTime: '13:45',
    });
    await insertWorkingHours({
      pool,
      facilityId: facility.id,
      practitionerId: practitioner.id,
      isoWeekday: 1,
      localStartTime: '12:00',
      localEndTime: '12:30',
      isActive: false,
    });
    await insertWorkingHours({
      pool,
      facilityId: facility.id,
      practitionerId: practitioner.id,
      isoWeekday: 1,
      localStartTime: '12:30',
      localEndTime: '13:00',
      effectiveEndDate: '2026-01-02',
    });
    await insertWorkingHours({
      pool,
      facilityId: facility.id,
      practitionerId: practitioner.id,
      isoWeekday: 1,
      localStartTime: '13:30',
      localEndTime: '14:00',
      effectiveStartDate: '2027-12-31',
    });

    const blockingScheduled = await request(app)
      .post('/api/v1/appointments')
      .send({
        patientId: patient.id,
        practitionerId: practitioner.id,
        facilityId: facility.id,
        scheduledStart: isoAt(dayIso, '09:00'),
        scheduledEnd: isoAt(dayIso, '09:30'),
      });
    expect(blockingScheduled.status).toBe(201);
    trackAppointmentId(blockingScheduled.body.id);

    const blockingConfirmed = await request(app)
      .post('/api/v1/appointments')
      .send({
        patientId: patient.id,
        practitionerId: practitioner.id,
        facilityId: facility.id,
        scheduledStart: isoAt(dayIso, '10:30'),
        scheduledEnd: isoAt(dayIso, '11:00'),
      });
    expect(blockingConfirmed.status).toBe(201);
    trackAppointmentId(blockingConfirmed.body.id);
    const confirmResponse = await request(app)
      .patch(`/api/v1/appointments/${blockingConfirmed.body.id}`)
      .send({ status: 'CONFIRMED' });
    expect(confirmResponse.status).toBe(200);

    const cancelledAppointment = await request(app)
      .post('/api/v1/appointments')
      .send({
        patientId: patient.id,
        practitionerId: practitioner.id,
        facilityId: facility.id,
        scheduledStart: isoAt(dayIso, '09:30'),
        scheduledEnd: isoAt(dayIso, '10:00'),
      });
    expect(cancelledAppointment.status).toBe(201);
    trackAppointmentId(cancelledAppointment.body.id);
    const cancelResponse = await request(app)
      .post(`/api/v1/appointments/${cancelledAppointment.body.id}/cancel`)
      .send({ cancellationReason: 'Synthetic schedule change' });
    expect(cancelResponse.status).toBe(200);

    const completedAppointmentId = crypto.randomUUID();
    const noShowAppointmentId = crypto.randomUUID();
    createdAppointmentIds.push(completedAppointmentId, noShowAppointmentId);
    await pool.query(
      `
        INSERT INTO appointments (
          id,
          patient_id,
          practitioner_id,
          facility_id,
          scheduled_start,
          scheduled_end,
          status
        )
        VALUES
          ($1, $3, $4, $5, $6::timestamptz, $7::timestamptz, 'COMPLETED'),
          ($2, $3, $4, $5, $8::timestamptz, $9::timestamptz, 'NO_SHOW')
      `,
      [
        completedAppointmentId,
        noShowAppointmentId,
        patient.id,
        practitioner.id,
        facility.id,
        isoAt(dayIso, '11:00'),
        isoAt(dayIso, '11:30'),
        isoAt(dayIso, '13:00'),
        isoAt(dayIso, '13:30'),
      ],
    );

    const availabilityResponse = await request(app)
      .get('/api/v1/appointments/availability')
      .query({
        facilityId: facility.id,
        practitionerId: practitioner.id,
        from: isoAt(dayIso, '09:00'),
        to: isoAt(dayIso, '14:00'),
      });

    expect(availabilityResponse.status).toBe(200);
    expect(availabilityResponse.body).toMatchObject({
      facilityId: facility.id,
      practitionerId: practitioner.id,
      timeZone: 'Africa/Addis_Ababa',
      from: `${dayIso}T06:00:00.000Z`,
      to: `${dayIso}T11:00:00.000Z`,
    });
    expect(availabilityResponse.body.slots).toEqual([
      {
        start: `${dayIso}T06:30:00.000Z`,
        end: `${dayIso}T07:00:00.000Z`,
        slotMinutes: 30,
      },
      {
        start: `${dayIso}T08:00:00.000Z`,
        end: `${dayIso}T08:30:00.000Z`,
        slotMinutes: 30,
      },
      {
        start: `${dayIso}T10:00:00.000Z`,
        end: `${dayIso}T10:30:00.000Z`,
        slotMinutes: 30,
      },
    ]);
    expect(JSON.stringify(availabilityResponse.body)).not.toContain(
      patient.firstName,
    );
    expect(JSON.stringify(availabilityResponse.body)).not.toContain(
      blockingScheduled.body.id,
    );
  });

  it('generates slots across DST gap and overlap in a synthetic observing zone', async () => {
    const facilityCode = `dst-fac-${uniqueSuffix()}`;
    const practitionerCode = `dst-prac-${uniqueSuffix()}`;

    const createFacilityResponse = await request(app)
      .post('/api/v1/facilities')
      .send({
        code: facilityCode,
        name: 'Integration DST Clinic',
        facilityType: 'clinic',
        licenseNumber: `DST-LIC-${uniqueSuffix()}`,
        region: 'Synthetic Region',
        city: 'Synthetic City',
        timeZone: 'America/New_York',
        isActive: true,
      });
    expect(createFacilityResponse.status).toBe(201);
    const facility = createFacilityResponse.body;
    trackFacilityId(facility.id);

    const createPractitionerResponse = await request(app)
      .post('/api/v1/practitioners')
      .send({
        code: practitionerCode,
        firstName: 'Maya',
        lastName: 'Rivera',
        profession: 'general practitioner',
        licenseNumber: `DST-LIC-${uniqueSuffix()}`,
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

    await insertWorkingHours({
      pool,
      facilityId: facility.id,
      practitionerId: practitioner.id,
      isoWeekday: 7,
      localStartTime: '01:30',
      localEndTime: '03:30',
      effectiveStartDate: '2027-03-14',
      effectiveEndDate: '2027-03-14',
    });
    await insertWorkingHours({
      pool,
      facilityId: facility.id,
      practitionerId: practitioner.id,
      isoWeekday: 7,
      localStartTime: '01:00',
      localEndTime: '02:30',
      effectiveStartDate: '2027-11-07',
      effectiveEndDate: '2027-11-07',
    });

    const springGapResponse = await request(app)
      .get('/api/v1/appointments/availability')
      .query({
        facilityId: facility.id,
        practitionerId: practitioner.id,
        from: '2027-03-14T01:00:00-05:00',
        to: '2027-03-14T04:00:00-04:00',
      });

    expect(springGapResponse.status).toBe(200);
    expect(springGapResponse.body.timeZone).toBe('America/New_York');
    expect(springGapResponse.body.slots).toEqual([
      {
        start: '2027-03-14T06:30:00.000Z',
        end: '2027-03-14T07:00:00.000Z',
        slotMinutes: 30,
      },
      {
        start: '2027-03-14T07:00:00.000Z',
        end: '2027-03-14T07:30:00.000Z',
        slotMinutes: 30,
      },
    ]);

    const fallOverlapResponse = await request(app)
      .get('/api/v1/appointments/availability')
      .query({
        facilityId: facility.id,
        practitionerId: practitioner.id,
        from: '2027-11-07T00:30:00-04:00',
        to: '2027-11-07T03:00:00-05:00',
      });

    expect(fallOverlapResponse.status).toBe(200);
    expect(fallOverlapResponse.body.timeZone).toBe('America/New_York');
    expect(fallOverlapResponse.body.slots).toEqual([
      {
        start: '2027-11-07T05:00:00.000Z',
        end: '2027-11-07T05:30:00.000Z',
        slotMinutes: 30,
      },
      {
        start: '2027-11-07T05:30:00.000Z',
        end: '2027-11-07T06:00:00.000Z',
        slotMinutes: 30,
      },
      {
        start: '2027-11-07T06:00:00.000Z',
        end: '2027-11-07T06:30:00.000Z',
        slotMinutes: 30,
      },
      {
        start: '2027-11-07T06:30:00.000Z',
        end: '2027-11-07T07:00:00.000Z',
        slotMinutes: 30,
      },
      {
        start: '2027-11-07T07:00:00.000Z',
        end: '2027-11-07T07:30:00.000Z',
        slotMinutes: 30,
      },
    ]);
  });
});
