DROP TABLE IF EXISTS appointment_reminders;

ALTER TABLE appointments
  DROP CONSTRAINT IF EXISTS appointments_schedule_version_positive_check;

ALTER TABLE appointments
  DROP COLUMN IF EXISTS schedule_version;
