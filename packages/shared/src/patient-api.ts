import type { HealthcareFacility } from './healthcare-facility.js';

export const administrativeSexes = [
  'female',
  'male',
  'other',
  'unknown',
] as const;

export type AdministrativeSex = (typeof administrativeSexes)[number];

export type PatientFacilityRegistrationFacilitySummary = Pick<
  HealthcareFacility,
  'id' | 'code' | 'name' | 'facilityType' | 'region' | 'city' | 'isActive'
>;

export type PatientFacilityRegistration = {
  id: string;
  patientId: string;
  facilityId: string;
  medicalRecordNumber: string;
  createdAt: string;
  updatedAt: string;
  facility: PatientFacilityRegistrationFacilitySummary;
};

export type Patient = {
  id: string;
  firstName: string;
  middleName: string | null;
  lastName: string | null;
  dateOfBirth: string | null;
  administrativeSex: AdministrativeSex;
  phone: string | null;
  email: string | null;
  addressLine: string | null;
  city: string | null;
  region: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  registrations: PatientFacilityRegistration[];
};

export type CreatePatientInput = {
  facilityId: string;
  medicalRecordNumber: string;
  firstName: string;
  middleName?: string | null | undefined;
  lastName?: string | null | undefined;
  dateOfBirth?: string | null | undefined;
  administrativeSex: AdministrativeSex;
  phone?: string | null | undefined;
  email?: string | null | undefined;
  addressLine?: string | null | undefined;
  city?: string | null | undefined;
  region?: string | null | undefined;
};

export type UpdatePatientInput = {
  firstName?: string | undefined;
  middleName?: string | null | undefined;
  lastName?: string | null | undefined;
  dateOfBirth?: string | null | undefined;
  administrativeSex?: AdministrativeSex | undefined;
  phone?: string | null | undefined;
  email?: string | null | undefined;
  addressLine?: string | null | undefined;
  city?: string | null | undefined;
  region?: string | null | undefined;
  isActive?: boolean | undefined;
};

export type PatientListQuery = {
  page: number;
  pageSize: number;
  search?: string | undefined;
  facilityId?: string | undefined;
  medicalRecordNumber?: string | undefined;
  administrativeSex?: AdministrativeSex | undefined;
  isActive?: boolean | undefined;
};

export type PatientPagination = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type PatientListResponse = {
  data: Patient[];
  pagination: PatientPagination;
};
