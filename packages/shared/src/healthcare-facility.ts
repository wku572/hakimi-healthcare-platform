export const facilityTypes = [
  'hospital',
  'clinic',
  'health_center',
  'diagnostic_center',
  'pharmacy',
] as const;

export type FacilityType = (typeof facilityTypes)[number];

export interface HealthcareFacility {
  id: string;
  code: string;
  name: string;
  facilityType: FacilityType;
  licenseNumber: string | null;
  phone: string | null;
  email: string | null;
  region: string;
  city: string;
  addressLine: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export function isFacilityType(value: string): value is FacilityType {
  return facilityTypes.includes(value as FacilityType);
}
