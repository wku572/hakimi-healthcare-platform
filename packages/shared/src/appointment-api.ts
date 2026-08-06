import type { HealthcareFacility } from './healthcare-facility.js';
import type { Patient } from './patient-api.js';
import type { Practitioner } from './practitioner-api.js';

export const appointmentStatuses = [
  'SCHEDULED',
  'CONFIRMED',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
] as const;

export type AppointmentStatus = (typeof appointmentStatuses)[number];

export type AppointmentFacilitySummary = Pick<
  HealthcareFacility,
  'id' | 'code' | 'name' | 'facilityType' | 'region' | 'city' | 'isActive'
>;

export type AppointmentPatientSummary = Pick<
  Patient,
  | 'id'
  | 'firstName'
  | 'middleName'
  | 'lastName'
  | 'dateOfBirth'
  | 'administrativeSex'
  | 'isActive'
> & {
  medicalRecordNumber: string;
};

export type AppointmentPractitionerSummary = Pick<
  Practitioner,
  | 'id'
  | 'code'
  | 'firstName'
  | 'middleName'
  | 'lastName'
  | 'profession'
  | 'isActive'
>;

export type Appointment = {
  id: string;
  patientId: string;
  practitionerId: string;
  facilityId: string;
  scheduledStart: string;
  scheduledEnd: string;
  status: AppointmentStatus;
  cancellationReason: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  patient: AppointmentPatientSummary;
  practitioner: AppointmentPractitionerSummary;
  facility: AppointmentFacilitySummary;
};

export type CreateAppointmentInput = {
  patientId: string;
  practitionerId: string;
  facilityId: string;
  scheduledStart: string;
  scheduledEnd: string;
};

export type UpdateAppointmentInput = {
  scheduledStart?: string | undefined;
  scheduledEnd?: string | undefined;
  status?: AppointmentStatus | undefined;
};

export type CancelAppointmentInput = {
  cancellationReason: string;
};

export type AppointmentListQuery = {
  page: number;
  pageSize: number;
  facilityId?: string | undefined;
  practitionerId?: string | undefined;
  patientId?: string | undefined;
  status?: AppointmentStatus | undefined;
  from?: string | undefined;
  to?: string | undefined;
};

export type AppointmentPagination = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type AppointmentListResponse = {
  data: Appointment[];
  pagination: AppointmentPagination;
};
