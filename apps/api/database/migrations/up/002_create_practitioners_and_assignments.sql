CREATE TABLE practitioners (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  code varchar(50) NOT NULL,
  first_name varchar(100) NOT NULL,
  middle_name varchar(100),
  last_name varchar(100) NOT NULL,
  profession varchar(100) NOT NULL,
  license_number varchar(100) NOT NULL,
  phone varchar(30),
  email varchar(254),
  bio varchar(2000),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT practitioners_code_not_blank_check CHECK (btrim(code) <> ''::text),
  CONSTRAINT practitioners_first_name_not_blank_check CHECK (btrim(first_name) <> ''::text),
  CONSTRAINT practitioners_last_name_not_blank_check CHECK (btrim(last_name) <> ''::text),
  CONSTRAINT practitioners_profession_not_blank_check CHECK (btrim(profession) <> ''::text),
  CONSTRAINT practitioners_license_number_not_blank_check CHECK (btrim(license_number) <> ''::text)
);

ALTER TABLE practitioners
  ADD CONSTRAINT practitioners_code_key UNIQUE (code);

ALTER TABLE practitioners
  ADD CONSTRAINT practitioners_license_number_key UNIQUE (license_number);

CREATE INDEX practitioners_last_name_first_name_id_idx
  ON practitioners (last_name, first_name, id);

CREATE TABLE practitioner_facility_assignments (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  practitioner_id uuid NOT NULL,
  facility_id uuid NOT NULL,
  role_title varchar(100) NOT NULL,
  department varchar(100),
  is_primary boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT practitioner_facility_assignments_role_title_not_blank_check CHECK (btrim(role_title) <> ''::text),
  CONSTRAINT practitioner_facility_assignments_department_not_blank_check CHECK (department IS NULL OR btrim(department) <> ''::text)
);

ALTER TABLE practitioner_facility_assignments
  ADD CONSTRAINT practitioner_facility_assignments_practitioner_id_fkey
  FOREIGN KEY (practitioner_id)
  REFERENCES practitioners (id)
  ON DELETE RESTRICT;

ALTER TABLE practitioner_facility_assignments
  ADD CONSTRAINT practitioner_facility_assignments_facility_id_fkey
  FOREIGN KEY (facility_id)
  REFERENCES healthcare_facilities (id)
  ON DELETE RESTRICT;

ALTER TABLE practitioner_facility_assignments
  ADD CONSTRAINT practitioner_facility_assignments_practitioner_facility_key
  UNIQUE (practitioner_id, facility_id);

CREATE UNIQUE INDEX practitioner_facility_assignments_active_primary_unique_idx
  ON practitioner_facility_assignments (practitioner_id)
  WHERE is_primary = true AND is_active = true;

CREATE INDEX practitioner_facility_assignments_practitioner_id_idx
  ON practitioner_facility_assignments (practitioner_id);

CREATE INDEX practitioner_facility_assignments_facility_id_idx
  ON practitioner_facility_assignments (facility_id);

CREATE INDEX practitioner_facility_assignments_active_practitioner_id_idx
  ON practitioner_facility_assignments (practitioner_id)
  WHERE is_active = true;

CREATE INDEX practitioner_facility_assignments_active_facility_id_idx
  ON practitioner_facility_assignments (facility_id)
  WHERE is_active = true;
