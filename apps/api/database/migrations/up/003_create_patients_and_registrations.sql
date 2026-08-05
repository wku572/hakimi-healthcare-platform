CREATE TABLE patients (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  first_name varchar(100) NOT NULL,
  middle_name varchar(100),
  last_name varchar(100),
  date_of_birth date,
  administrative_sex varchar(20) NOT NULL,
  phone varchar(30),
  email varchar(254),
  address_line varchar(200),
  city varchar(100),
  region varchar(100),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT patients_first_name_not_blank_check CHECK (btrim(first_name) <> ''::text),
  CONSTRAINT patients_middle_name_not_blank_check CHECK (
    middle_name IS NULL OR btrim(middle_name) <> ''::text
  ),
  CONSTRAINT patients_last_name_not_blank_check CHECK (
    last_name IS NULL OR btrim(last_name) <> ''::text
  ),
  CONSTRAINT patients_administrative_sex_check CHECK (
    administrative_sex = lower(btrim(administrative_sex))
    AND administrative_sex IN ('female', 'male', 'other', 'unknown')
  ),
  CONSTRAINT patients_phone_not_blank_check CHECK (
    phone IS NULL OR btrim(phone) <> ''::text
  ),
  CONSTRAINT patients_email_not_blank_check CHECK (
    email IS NULL OR btrim(email) <> ''::text
  ),
  CONSTRAINT patients_address_line_not_blank_check CHECK (
    address_line IS NULL OR btrim(address_line) <> ''::text
  ),
  CONSTRAINT patients_city_not_blank_check CHECK (
    city IS NULL OR btrim(city) <> ''::text
  ),
  CONSTRAINT patients_region_not_blank_check CHECK (
    region IS NULL OR btrim(region) <> ''::text
  )
);

CREATE INDEX patients_name_search_idx
  ON patients (first_name, middle_name, last_name, id);

CREATE INDEX patients_last_name_first_name_id_idx
  ON patients (last_name, first_name, id);

CREATE TABLE patient_facility_registrations (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  patient_id uuid NOT NULL,
  facility_id uuid NOT NULL,
  medical_record_number varchar(50) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT patient_facility_registrations_mrn_not_blank_check CHECK (
    btrim(medical_record_number) <> ''::text
  )
);

ALTER TABLE patient_facility_registrations
  ADD CONSTRAINT patient_facility_registrations_patient_id_fkey
  FOREIGN KEY (patient_id)
  REFERENCES patients (id)
  ON DELETE RESTRICT;

ALTER TABLE patient_facility_registrations
  ADD CONSTRAINT patient_facility_registrations_facility_id_fkey
  FOREIGN KEY (facility_id)
  REFERENCES healthcare_facilities (id)
  ON DELETE RESTRICT;

ALTER TABLE patient_facility_registrations
  ADD CONSTRAINT patient_facility_registrations_facility_mrn_key
  UNIQUE (facility_id, medical_record_number);

ALTER TABLE patient_facility_registrations
  ADD CONSTRAINT patient_facility_registrations_patient_facility_key
  UNIQUE (patient_id, facility_id);

CREATE INDEX patient_facility_registrations_patient_id_idx
  ON patient_facility_registrations (patient_id);

CREATE INDEX patient_facility_registrations_facility_id_idx
  ON patient_facility_registrations (facility_id);
