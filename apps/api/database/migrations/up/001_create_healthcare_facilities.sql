CREATE TABLE healthcare_facilities (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  facility_type text NOT NULL,
  license_number text UNIQUE,
  phone text,
  email text,
  region text NOT NULL,
  city text NOT NULL,
  address_line text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT healthcare_facilities_code_not_blank_check CHECK (btrim(code) <> ''),
  CONSTRAINT healthcare_facilities_name_not_blank_check CHECK (btrim(name) <> ''),
  CONSTRAINT healthcare_facilities_region_not_blank_check CHECK (btrim(region) <> ''),
  CONSTRAINT healthcare_facilities_city_not_blank_check CHECK (btrim(city) <> ''),
  CONSTRAINT healthcare_facilities_facility_type_check CHECK (
    facility_type = lower(btrim(facility_type))
    AND facility_type IN (
      'hospital',
      'clinic',
      'health_center',
      'diagnostic_center',
      'pharmacy'
    )
  )
);
