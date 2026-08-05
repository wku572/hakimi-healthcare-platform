export type AppBranding = {
  appName: string;
  tagline: string;
  message: string;
};

export type HealthResponse = {
  status: 'ok';
};

export { facilityTypes, isFacilityType } from './healthcare-facility.js';
export type {
  FacilityType,
  HealthcareFacility,
} from './healthcare-facility.js';
export type {
  ApiErrorCode,
  ApiErrorDetail,
  ApiErrorResponse,
  CreateHealthcareFacilityInput,
  HealthcareFacilityListQuery,
  HealthcareFacilityListResponse,
  HealthcareFacilityPagination,
  UpdateHealthcareFacilityInput,
} from './facility-api.js';

export type {
  CreatePractitionerAssignmentInput,
  CreatePractitionerInput,
  Practitioner,
  PractitionerAssignmentListResponse,
  PractitionerAssignmentFacilitySummary,
  PractitionerFacilityAssignment,
  PractitionerListQuery,
  PractitionerListResponse,
  PractitionerPagination,
  UpdatePractitionerAssignmentInput,
  UpdatePractitionerInput,
} from './practitioner-api.js';
export type {
  AdministrativeSex,
  CreatePatientInput,
  Patient,
  PatientFacilityRegistration,
  PatientFacilityRegistrationFacilitySummary,
  PatientListQuery,
  PatientListResponse,
  PatientPagination,
  UpdatePatientInput,
} from './patient-api.js';
export { administrativeSexes } from './patient-api.js';
