import type { HealthcareFacility } from './healthcare-facility.js';

export type Practitioner = {
  id: string;
  code: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  profession: string;
  licenseNumber: string;
  phone: string | null;
  email: string | null;
  bio: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreatePractitionerInput = {
  code: string;
  firstName: string;
  middleName?: string | null | undefined;
  lastName: string;
  profession: string;
  licenseNumber: string;
  phone?: string | null | undefined;
  email?: string | null | undefined;
  bio?: string | null | undefined;
  isActive?: boolean | undefined;
};

export type UpdatePractitionerInput = {
  code?: string | undefined;
  firstName?: string | undefined;
  middleName?: string | null | undefined;
  lastName?: string | undefined;
  profession?: string | undefined;
  licenseNumber?: string | undefined;
  phone?: string | null | undefined;
  email?: string | null | undefined;
  bio?: string | null | undefined;
  isActive?: boolean | undefined;
};

export type PractitionerListQuery = {
  page: number;
  pageSize: number;
  profession?: string | undefined;
  isActive?: boolean | undefined;
  facilityId?: string | undefined;
  search?: string | undefined;
};

export type PractitionerPagination = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type PractitionerListResponse = {
  data: Practitioner[];
  pagination: PractitionerPagination;
};

export type PractitionerAssignmentFacilitySummary = Pick<
  HealthcareFacility,
  'id' | 'code' | 'name' | 'facilityType' | 'region' | 'city' | 'isActive'
>;

export type PractitionerFacilityAssignment = {
  id: string;
  practitionerId: string;
  facilityId: string;
  roleTitle: string;
  department: string | null;
  isPrimary: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  facility: PractitionerAssignmentFacilitySummary;
};

export type CreatePractitionerAssignmentInput = {
  facilityId: string;
  roleTitle: string;
  department?: string | null | undefined;
  isPrimary?: boolean | undefined;
  isActive?: boolean | undefined;
};

export type UpdatePractitionerAssignmentInput = {
  roleTitle?: string | undefined;
  department?: string | null | undefined;
  isPrimary?: boolean | undefined;
  isActive?: boolean | undefined;
};

export type PractitionerAssignmentListResponse = {
  data: PractitionerFacilityAssignment[];
};
