import type {
  FacilityType,
  HealthcareFacility,
} from './healthcare-facility.js';

export type CreateHealthcareFacilityInput = {
  code: string;
  name: string;
  facilityType: FacilityType;
  licenseNumber?: string | null | undefined;
  phone?: string | null | undefined;
  email?: string | null | undefined;
  region: string;
  city: string;
  addressLine?: string | null | undefined;
  isActive?: boolean | undefined;
};

export type UpdateHealthcareFacilityInput = {
  code?: string | undefined;
  name?: string | undefined;
  facilityType?: FacilityType | undefined;
  licenseNumber?: string | null | undefined;
  phone?: string | null | undefined;
  email?: string | null | undefined;
  region?: string | undefined;
  city?: string | undefined;
  addressLine?: string | null | undefined;
  isActive?: boolean | undefined;
};

export type HealthcareFacilityListQuery = {
  page: number;
  pageSize: number;
  facilityType?: FacilityType | undefined;
  region?: string | undefined;
  city?: string | undefined;
  isActive?: boolean | undefined;
  search?: string | undefined;
};

export type HealthcareFacilityPagination = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type HealthcareFacilityListResponse = {
  data: HealthcareFacility[];
  pagination: HealthcareFacilityPagination;
};

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'INVALID_JSON'
  | 'FACILITY_NOT_FOUND'
  | 'FACILITY_CODE_CONFLICT'
  | 'FACILITY_LICENSE_CONFLICT'
  | 'PRACTITIONER_NOT_FOUND'
  | 'PRACTITIONER_CODE_CONFLICT'
  | 'PRACTITIONER_LICENSE_CONFLICT'
  | 'INACTIVE_PRACTITIONER'
  | 'INACTIVE_FACILITY'
  | 'ASSIGNMENT_NOT_FOUND'
  | 'ASSIGNMENT_CONFLICT'
  | 'INTERNAL_ERROR';

export type ApiErrorDetail = {
  field: string;
  message: string;
};

export type ApiErrorResponse = {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: ApiErrorDetail[] | undefined;
  };
};
