import type {
  AppointmentFacilitySummary,
  AppointmentPatientSummary,
  AppointmentPractitionerSummary,
} from '@hakimi/shared';

export type SyntheticAppointmentSlot = {
  id: string;
  practitionerId: string;
  scheduledStart: string;
  scheduledEnd: string;
  label: string;
  reason: string;
  reminderStatus: 'Queued in demo session';
};

export type SyntheticDemoData = {
  facility: AppointmentFacilitySummary;
  practitioners: AppointmentPractitionerSummary[];
  patients: AppointmentPatientSummary[];
  slots: SyntheticAppointmentSlot[];
};

export type DemoDataAdapter = {
  loadDemoData(): SyntheticDemoData;
};

const facility: AppointmentFacilitySummary = {
  id: 'demo-facility-addis-family-clinic',
  code: 'DEMO-AFC',
  name: 'Addis Family Clinic',
  facilityType: 'clinic',
  region: 'Addis Ababa',
  city: 'Addis Ababa',
  isActive: true,
};

const practitioners: AppointmentPractitionerSummary[] = [
  {
    id: 'demo-practitioner-lensa-bekele',
    code: 'DEMO-PR-001',
    firstName: 'Lensa',
    middleName: null,
    lastName: 'Bekele',
    profession: 'Family Medicine',
    isActive: true,
  },
  {
    id: 'demo-practitioner-samuel-tadesse',
    code: 'DEMO-PR-002',
    firstName: 'Samuel',
    middleName: 'A.',
    lastName: 'Tadesse',
    profession: 'Pediatrics',
    isActive: true,
  },
  {
    id: 'demo-practitioner-maya-abebe',
    code: 'DEMO-PR-003',
    firstName: 'Maya',
    middleName: null,
    lastName: 'Abebe',
    profession: 'Internal Medicine',
    isActive: true,
  },
];

const patients: AppointmentPatientSummary[] = [
  {
    id: 'demo-patient-hana-mekonnen',
    firstName: 'Hana',
    middleName: null,
    lastName: 'Mekonnen',
    dateOfBirth: '1991-04-12',
    administrativeSex: 'female',
    medicalRecordNumber: 'AFC-DEMO-1001',
    isActive: true,
  },
  {
    id: 'demo-patient-dawit-tesfaye',
    firstName: 'Dawit',
    middleName: null,
    lastName: 'Tesfaye',
    dateOfBirth: '1986-11-03',
    administrativeSex: 'male',
    medicalRecordNumber: 'AFC-DEMO-1002',
    isActive: true,
  },
  {
    id: 'demo-patient-selam-ali',
    firstName: 'Selam',
    middleName: null,
    lastName: 'Ali',
    dateOfBirth: '2000-07-24',
    administrativeSex: 'unknown',
    medicalRecordNumber: 'AFC-DEMO-1003',
    isActive: true,
  },
];

const slots: SyntheticAppointmentSlot[] = [
  {
    id: 'demo-slot-1',
    practitionerId: 'demo-practitioner-lensa-bekele',
    scheduledStart: '2026-09-21T09:00:00+03:00',
    scheduledEnd: '2026-09-21T09:30:00+03:00',
    label: 'Mon, Sep 21 at 9:00 AM',
    reason: 'General appointment',
    reminderStatus: 'Queued in demo session',
  },
  {
    id: 'demo-slot-2',
    practitionerId: 'demo-practitioner-lensa-bekele',
    scheduledStart: '2026-09-21T10:30:00+03:00',
    scheduledEnd: '2026-09-21T11:00:00+03:00',
    label: 'Mon, Sep 21 at 10:30 AM',
    reason: 'Follow-up scheduling',
    reminderStatus: 'Queued in demo session',
  },
  {
    id: 'demo-slot-3',
    practitionerId: 'demo-practitioner-samuel-tadesse',
    scheduledStart: '2026-09-22T14:00:00+03:00',
    scheduledEnd: '2026-09-22T14:30:00+03:00',
    label: 'Tue, Sep 22 at 2:00 PM',
    reason: 'Family consultation',
    reminderStatus: 'Queued in demo session',
  },
  {
    id: 'demo-slot-4',
    practitionerId: 'demo-practitioner-maya-abebe',
    scheduledStart: '2026-09-23T11:00:00+03:00',
    scheduledEnd: '2026-09-23T11:30:00+03:00',
    label: 'Wed, Sep 23 at 11:00 AM',
    reason: 'General appointment',
    reminderStatus: 'Queued in demo session',
  },
];

const syntheticDemoData: SyntheticDemoData = {
  facility,
  practitioners,
  patients,
  slots,
};

export const localSyntheticDemoAdapter: DemoDataAdapter = {
  loadDemoData() {
    return syntheticDemoData;
  },
};
