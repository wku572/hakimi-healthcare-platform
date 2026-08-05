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
