DROP TABLE IF EXISTS practitioner_working_hours;

ALTER TABLE healthcare_facilities
  DROP CONSTRAINT IF EXISTS healthcare_facilities_time_zone_check;

ALTER TABLE healthcare_facilities
  DROP COLUMN IF EXISTS time_zone;

DROP FUNCTION IF EXISTS is_valid_iana_time_zone(text);
