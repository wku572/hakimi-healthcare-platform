import type { Pool } from 'pg';
import type { RuntimeEnvironment } from '../env.js';

export type LocalDemoProvisioningConfig = Readonly<{
  oidcIssuer: string;
  oidcSubject: string;
  actorId: string;
  primaryFacility: LocalDemoFacility;
  otherFacility: LocalDemoFacility;
  practitioners: readonly LocalDemoPractitioner[];
  patients: readonly LocalDemoPatient[];
  appointment: LocalDemoAppointment;
}>;

type LocalDemoFacility = Readonly<{
  id: string;
  code: string;
  name: string;
  facilityType: 'clinic';
  licenseNumber: string;
  phone: string;
  email: string;
  region: string;
  city: string;
  addressLine: string;
  timeZone: string;
}>;

type LocalDemoPractitioner = Readonly<{
  id: string;
  assignmentId: string;
  facilityId: string;
  code: string;
  firstName: string;
  lastName: string;
  profession: string;
  licenseNumber: string;
  roleTitle: string;
  department: string;
  isPrimary: boolean;
}>;

type LocalDemoPatient = Readonly<{
  id: string;
  registrationId: string;
  facilityId: string;
  medicalRecordNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  administrativeSex: 'female' | 'male' | 'unknown';
  city: string;
  region: string;
}>;

type LocalDemoAppointment = Readonly<{
  id: string;
  patientId: string;
  practitionerId: string;
  facilityId: string;
}>;

export type LocalDemoProvisioningSummary = Readonly<{
  actorId: string;
  oidcIssuer: string;
  oidcSubject: string;
  facilityIds: readonly string[];
  practitionerIds: readonly string[];
  patientIds: readonly string[];
  appointmentIds: readonly string[];
  role: 'SCHEDULER';
}>;

const localDemoOidcIssuer = 'http://localhost:8080/realms/hakimi-local';
const localDemoOidcSubject = '00000000-0000-4000-8000-0000000000d5';

export const defaultLocalDemoProvisioningConfig: LocalDemoProvisioningConfig =
  Object.freeze({
    oidcIssuer: localDemoOidcIssuer,
    oidcSubject: localDemoOidcSubject,
    actorId: '00000000-0000-4000-8000-000000000201',
    primaryFacility: Object.freeze({
      id: '00000000-0000-4000-8000-000000000301',
      code: 'HAKIMI-DEMO-ADDIS-FAMILY',
      name: 'Addis Family Clinic',
      facilityType: 'clinic',
      licenseNumber: 'HAKIMI-DEMO-FACILITY-001',
      phone: '+251 11 000 0101',
      email: 'addis-family-clinic@example.test',
      region: 'Addis Ababa',
      city: 'Addis Ababa',
      addressLine: 'Fictional Bole Road address',
      timeZone: 'Africa/Addis_Ababa',
    }),
    otherFacility: Object.freeze({
      id: '00000000-0000-4000-8000-000000000302',
      code: 'HAKIMI-DEMO-NORTHSIDE',
      name: 'Northside Demo Clinic',
      facilityType: 'clinic',
      licenseNumber: 'HAKIMI-DEMO-FACILITY-002',
      phone: '+251 11 000 0102',
      email: 'northside-demo-clinic@example.test',
      region: 'Amhara',
      city: 'Bahir Dar',
      addressLine: 'Fictional lakeside address',
      timeZone: 'Africa/Addis_Ababa',
    }),
    practitioners: Object.freeze([
      Object.freeze({
        id: '00000000-0000-4000-8000-000000000401',
        assignmentId: '00000000-0000-4000-8000-000000000501',
        facilityId: '00000000-0000-4000-8000-000000000301',
        code: 'HAKIMI-DEMO-PRAC-001',
        firstName: 'Selam',
        lastName: 'Bekele',
        profession: 'general practitioner',
        licenseNumber: 'HAKIMI-DEMO-LIC-001',
        roleTitle: 'General Practitioner',
        department: 'Outpatient Care',
        isPrimary: true,
      }),
      Object.freeze({
        id: '00000000-0000-4000-8000-000000000402',
        assignmentId: '00000000-0000-4000-8000-000000000502',
        facilityId: '00000000-0000-4000-8000-000000000301',
        code: 'HAKIMI-DEMO-PRAC-002',
        firstName: 'Dawit',
        lastName: 'Tesfaye',
        profession: 'family medicine',
        licenseNumber: 'HAKIMI-DEMO-LIC-002',
        roleTitle: 'Family Medicine Practitioner',
        department: 'Family Clinic',
        isPrimary: false,
      }),
      Object.freeze({
        id: '00000000-0000-4000-8000-000000000403',
        assignmentId: '00000000-0000-4000-8000-000000000503',
        facilityId: '00000000-0000-4000-8000-000000000302',
        code: 'HAKIMI-DEMO-PRAC-003',
        firstName: 'Marta',
        lastName: 'Lemma',
        profession: 'general practitioner',
        licenseNumber: 'HAKIMI-DEMO-LIC-003',
        roleTitle: 'General Practitioner',
        department: 'Demo Care',
        isPrimary: true,
      }),
    ]),
    patients: Object.freeze([
      Object.freeze({
        id: '00000000-0000-4000-8000-000000000601',
        registrationId: '00000000-0000-4000-8000-000000000701',
        facilityId: '00000000-0000-4000-8000-000000000301',
        medicalRecordNumber: 'DEMO-MRN-1001',
        firstName: 'Amina',
        lastName: 'Kebede',
        dateOfBirth: '1992-04-12',
        administrativeSex: 'female',
        city: 'Addis Ababa',
        region: 'Addis Ababa',
      }),
      Object.freeze({
        id: '00000000-0000-4000-8000-000000000602',
        registrationId: '00000000-0000-4000-8000-000000000702',
        facilityId: '00000000-0000-4000-8000-000000000301',
        medicalRecordNumber: 'DEMO-MRN-1002',
        firstName: 'Noah',
        lastName: 'Tadesse',
        dateOfBirth: '1988-09-23',
        administrativeSex: 'male',
        city: 'Addis Ababa',
        region: 'Addis Ababa',
      }),
      Object.freeze({
        id: '00000000-0000-4000-8000-000000000603',
        registrationId: '00000000-0000-4000-8000-000000000703',
        facilityId: '00000000-0000-4000-8000-000000000302',
        medicalRecordNumber: 'DEMO-MRN-2001',
        firstName: 'Liya',
        lastName: 'Abate',
        dateOfBirth: '1996-01-17',
        administrativeSex: 'female',
        city: 'Bahir Dar',
        region: 'Amhara',
      }),
    ]),
    appointment: Object.freeze({
      id: '00000000-0000-4000-8000-000000000801',
      patientId: '00000000-0000-4000-8000-000000000601',
      practitionerId: '00000000-0000-4000-8000-000000000401',
      facilityId: '00000000-0000-4000-8000-000000000301',
    }),
  });

function ensureLocalDemoProvisioningAllowed(
  environment: RuntimeEnvironment,
  enableLocalDemoProvisioning: string | undefined,
) {
  if (environment.NODE_ENV === 'production') {
    throw new Error('LOCAL_DEMO_PROVISIONING_REFUSES_PRODUCTION');
  }

  if (enableLocalDemoProvisioning !== 'true') {
    throw new Error('LOCAL_DEMO_PROVISIONING_NOT_ENABLED');
  }
}

function demoAppointmentWindow() {
  const scheduledStart = new Date();
  scheduledStart.setUTCDate(scheduledStart.getUTCDate() + 2);
  scheduledStart.setUTCHours(6, 0, 0, 0);

  const scheduledEnd = new Date(scheduledStart);
  scheduledEnd.setUTCMinutes(scheduledStart.getUTCMinutes() + 30);

  return {
    scheduledStart: scheduledStart.toISOString(),
    scheduledEnd: scheduledEnd.toISOString(),
  };
}

async function upsertFacility(
  db: Pick<Pool, 'query'>,
  facility: LocalDemoFacility,
) {
  await db.query(
    `
      INSERT INTO healthcare_facilities (
        id,
        code,
        name,
        facility_type,
        license_number,
        phone,
        email,
        region,
        city,
        address_line,
        time_zone,
        is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true)
      ON CONFLICT (id) DO UPDATE
      SET code = EXCLUDED.code,
          name = EXCLUDED.name,
          facility_type = EXCLUDED.facility_type,
          license_number = EXCLUDED.license_number,
          phone = EXCLUDED.phone,
          email = EXCLUDED.email,
          region = EXCLUDED.region,
          city = EXCLUDED.city,
          address_line = EXCLUDED.address_line,
          time_zone = EXCLUDED.time_zone,
          is_active = true,
          updated_at = now()
    `,
    [
      facility.id,
      facility.code,
      facility.name,
      facility.facilityType,
      facility.licenseNumber,
      facility.phone,
      facility.email,
      facility.region,
      facility.city,
      facility.addressLine,
      facility.timeZone,
    ],
  );
}

async function insertDemoWorkingHours(
  db: Pick<Pool, 'query'>,
  practitioner: LocalDemoPractitioner,
) {
  const workingPeriods = [
    { start: '09:00', end: '12:00' },
    { start: '13:00', end: '16:00' },
  ] as const;

  for (const weekday of [1, 2, 3, 4, 5] as const) {
    for (const period of workingPeriods) {
      await db.query(
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
          SELECT $1, $2, $3, $4::time, $5::time, 30, DATE '2026-01-01', NULL, true
          WHERE NOT EXISTS (
            SELECT 1
            FROM practitioner_working_hours existing
            WHERE existing.practitioner_id = $1
              AND existing.facility_id = $2
              AND existing.iso_weekday = $3
              AND existing.local_start_time = $4::time
              AND existing.local_end_time = $5::time
              AND existing.slot_minutes = 30
              AND existing.effective_start_date = DATE '2026-01-01'
              AND existing.effective_end_date IS NULL
              AND existing.is_active = true
          )
        `,
        [
          practitioner.id,
          practitioner.facilityId,
          weekday,
          period.start,
          period.end,
        ],
      );
    }
  }
}

async function upsertPractitioner(
  db: Pick<Pool, 'query'>,
  practitioner: LocalDemoPractitioner,
) {
  await db.query(
    `
      INSERT INTO practitioners (
        id,
        code,
        first_name,
        last_name,
        profession,
        license_number,
        is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, true)
      ON CONFLICT (id) DO UPDATE
      SET code = EXCLUDED.code,
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          profession = EXCLUDED.profession,
          license_number = EXCLUDED.license_number,
          is_active = true,
          updated_at = now()
    `,
    [
      practitioner.id,
      practitioner.code,
      practitioner.firstName,
      practitioner.lastName,
      practitioner.profession,
      practitioner.licenseNumber,
    ],
  );

  await db.query(
    `
      INSERT INTO practitioner_facility_assignments (
        id,
        practitioner_id,
        facility_id,
        role_title,
        department,
        is_primary,
        is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, true)
      ON CONFLICT (practitioner_id, facility_id) DO UPDATE
      SET role_title = EXCLUDED.role_title,
          department = EXCLUDED.department,
          is_primary = EXCLUDED.is_primary,
          is_active = true,
          updated_at = now()
    `,
    [
      practitioner.assignmentId,
      practitioner.id,
      practitioner.facilityId,
      practitioner.roleTitle,
      practitioner.department,
      practitioner.isPrimary,
    ],
  );
}

async function upsertPatient(
  db: Pick<Pool, 'query'>,
  patient: LocalDemoPatient,
) {
  await db.query(
    `
      INSERT INTO patients (
        id,
        first_name,
        last_name,
        date_of_birth,
        administrative_sex,
        city,
        region,
        is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, true)
      ON CONFLICT (id) DO UPDATE
      SET first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          date_of_birth = EXCLUDED.date_of_birth,
          administrative_sex = EXCLUDED.administrative_sex,
          city = EXCLUDED.city,
          region = EXCLUDED.region,
          is_active = true,
          updated_at = now()
    `,
    [
      patient.id,
      patient.firstName,
      patient.lastName,
      patient.dateOfBirth,
      patient.administrativeSex,
      patient.city,
      patient.region,
    ],
  );

  await db.query(
    `
      INSERT INTO patient_facility_registrations (
        id,
        patient_id,
        facility_id,
        medical_record_number
      )
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (patient_id, facility_id) DO UPDATE
      SET medical_record_number = EXCLUDED.medical_record_number,
          updated_at = now()
    `,
    [
      patient.registrationId,
      patient.id,
      patient.facilityId,
      patient.medicalRecordNumber,
    ],
  );
}

async function upsertActorAndRole(
  db: Pick<Pool, 'query'>,
  config: LocalDemoProvisioningConfig,
) {
  await db.query(
    `
      INSERT INTO workforce_actors (
        id,
        oidc_issuer,
        oidc_subject,
        practitioner_id,
        is_active
      )
      VALUES ($1, $2, $3, NULL, true)
      ON CONFLICT (oidc_issuer, oidc_subject) DO UPDATE
      SET practitioner_id = NULL,
          is_active = true,
          deactivated_at = NULL,
          activated_at = CASE
            WHEN workforce_actors.is_active = false THEN now()
            ELSE workforce_actors.activated_at
          END,
          updated_at = now()
    `,
    [config.actorId, config.oidcIssuer, config.oidcSubject],
  );

  await db.query(
    `
      INSERT INTO workforce_role_assignments (
        actor_id,
        role,
        facility_id,
        is_active
      )
      VALUES ($1, 'SCHEDULER', $2, true)
      ON CONFLICT (actor_id, role, facility_id)
        WHERE facility_id IS NOT NULL
      DO UPDATE
      SET is_active = true,
          deactivated_at = NULL,
          activated_at = CASE
            WHEN workforce_role_assignments.is_active = false THEN now()
            ELSE workforce_role_assignments.activated_at
          END,
          updated_at = now()
    `,
    [config.actorId, config.primaryFacility.id],
  );
}

async function upsertAppointment(
  db: Pick<Pool, 'query'>,
  appointment: LocalDemoAppointment,
) {
  const { scheduledStart, scheduledEnd } = demoAppointmentWindow();

  await db.query(
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
      VALUES ($1, $2, $3, $4, $5, $6, 'SCHEDULED')
      ON CONFLICT (id) DO UPDATE
      SET patient_id = EXCLUDED.patient_id,
          practitioner_id = EXCLUDED.practitioner_id,
          facility_id = EXCLUDED.facility_id,
          scheduled_start = EXCLUDED.scheduled_start,
          scheduled_end = EXCLUDED.scheduled_end,
          status = 'SCHEDULED',
          cancellation_reason = NULL,
          cancelled_at = NULL,
          updated_at = now()
    `,
    [
      appointment.id,
      appointment.patientId,
      appointment.practitionerId,
      appointment.facilityId,
      scheduledStart,
      scheduledEnd,
    ],
  );
}

export async function provisionLocalDemoData(
  pool: Pick<Pool, 'connect'>,
  environment: RuntimeEnvironment,
  enableLocalDemoProvisioning = process.env
    .HAKIMI_ENABLE_LOCAL_DEMO_PROVISIONING,
  config = defaultLocalDemoProvisioningConfig,
): Promise<LocalDemoProvisioningSummary> {
  ensureLocalDemoProvisioningAllowed(environment, enableLocalDemoProvisioning);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await upsertFacility(client, config.primaryFacility);
    await upsertFacility(client, config.otherFacility);

    for (const practitioner of config.practitioners) {
      await upsertPractitioner(client, practitioner);
      if (practitioner.facilityId === config.primaryFacility.id) {
        await insertDemoWorkingHours(client, practitioner);
      }
    }

    for (const patient of config.patients) {
      await upsertPatient(client, patient);
    }

    await upsertAppointment(client, config.appointment);
    await upsertActorAndRole(client, config);
    await client.query('COMMIT');

    return Object.freeze({
      actorId: config.actorId,
      oidcIssuer: config.oidcIssuer,
      oidcSubject: config.oidcSubject,
      facilityIds: Object.freeze([
        config.primaryFacility.id,
        config.otherFacility.id,
      ]),
      practitionerIds: Object.freeze(
        config.practitioners.map((practitioner) => practitioner.id),
      ),
      patientIds: Object.freeze(config.patients.map((patient) => patient.id)),
      appointmentIds: Object.freeze([config.appointment.id]),
      role: 'SCHEDULER',
    });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Preserve the original provisioning failure.
    }
    throw error;
  } finally {
    client.release();
  }
}
