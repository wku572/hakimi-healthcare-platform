CREATE OR REPLACE FUNCTION is_valid_iana_time_zone(zone_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_timezone_names
    WHERE name = zone_name
      AND name = btrim(zone_name)
      AND name LIKE '%/%'
  );
$$;

ALTER TABLE healthcare_facilities
  ADD COLUMN time_zone varchar(100);

UPDATE healthcare_facilities
SET time_zone = 'Africa/Addis_Ababa'
WHERE time_zone IS NULL;

ALTER TABLE healthcare_facilities
  ALTER COLUMN time_zone SET NOT NULL;

ALTER TABLE healthcare_facilities
  ADD CONSTRAINT healthcare_facilities_time_zone_check
  CHECK (
    time_zone = btrim(time_zone)
    AND btrim(time_zone) <> ''
    AND is_valid_iana_time_zone(time_zone)
  );

CREATE TABLE practitioner_working_hours (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  practitioner_id uuid NOT NULL,
  facility_id uuid NOT NULL,
  iso_weekday integer NOT NULL,
  local_start_time time NOT NULL,
  local_end_time time NOT NULL,
  slot_minutes integer NOT NULL,
  effective_start_date date NOT NULL,
  effective_end_date date,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT practitioner_working_hours_weekday_check CHECK (
    iso_weekday BETWEEN 1 AND 7
  ),
  CONSTRAINT practitioner_working_hours_window_check CHECK (
    local_start_time < local_end_time
  ),
  CONSTRAINT practitioner_working_hours_slot_minutes_check CHECK (
    slot_minutes IN (15, 20, 30, 45, 60)
  ),
  CONSTRAINT practitioner_working_hours_effective_dates_check CHECK (
    effective_end_date IS NULL
    OR effective_end_date >= effective_start_date
  )
);

ALTER TABLE practitioner_working_hours
  ADD CONSTRAINT practitioner_working_hours_practitioner_id_fkey
  FOREIGN KEY (practitioner_id)
  REFERENCES practitioners (id)
  ON DELETE RESTRICT;

ALTER TABLE practitioner_working_hours
  ADD CONSTRAINT practitioner_working_hours_facility_id_fkey
  FOREIGN KEY (facility_id)
  REFERENCES healthcare_facilities (id)
  ON DELETE RESTRICT;

CREATE UNIQUE INDEX practitioner_working_hours_active_definition_key
  ON practitioner_working_hours (
    practitioner_id,
    facility_id,
    iso_weekday,
    local_start_time,
    local_end_time,
    slot_minutes,
    effective_start_date,
    COALESCE(effective_end_date, DATE '9999-12-31')
  )
  WHERE is_active = true;

CREATE INDEX practitioner_working_hours_lookup_idx
  ON practitioner_working_hours (
    facility_id,
    practitioner_id,
    iso_weekday,
    effective_start_date,
    effective_end_date
  )
  WHERE is_active = true;

CREATE INDEX practitioner_working_hours_practitioner_facility_idx
  ON practitioner_working_hours (practitioner_id, facility_id);
