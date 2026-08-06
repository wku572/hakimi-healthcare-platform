CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE appointments (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  patient_id uuid NOT NULL,
  practitioner_id uuid NOT NULL,
  facility_id uuid NOT NULL,
  scheduled_start timestamptz NOT NULL,
  scheduled_end timestamptz NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'SCHEDULED',
  cancellation_reason varchar(1000),
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT appointments_scheduled_window_check CHECK (
    scheduled_start < scheduled_end
  ),
  CONSTRAINT appointments_status_check CHECK (
    status = upper(btrim(status))
    AND status IN (
      'SCHEDULED',
      'CONFIRMED',
      'COMPLETED',
      'CANCELLED',
      'NO_SHOW'
    )
  ),
  CONSTRAINT appointments_cancellation_reason_not_blank_check CHECK (
    status <> 'CANCELLED'
    OR btrim(cancellation_reason) <> ''::text
  ),
  CONSTRAINT appointments_cancelled_at_check CHECK (
    (status = 'CANCELLED' AND cancelled_at IS NOT NULL)
    OR (status <> 'CANCELLED' AND cancelled_at IS NULL)
  )
);

ALTER TABLE appointments
  ADD CONSTRAINT appointments_patient_id_fkey
  FOREIGN KEY (patient_id)
  REFERENCES patients (id)
  ON DELETE RESTRICT;

ALTER TABLE appointments
  ADD CONSTRAINT appointments_practitioner_id_fkey
  FOREIGN KEY (practitioner_id)
  REFERENCES practitioners (id)
  ON DELETE RESTRICT;

ALTER TABLE appointments
  ADD CONSTRAINT appointments_facility_id_fkey
  FOREIGN KEY (facility_id)
  REFERENCES healthcare_facilities (id)
  ON DELETE RESTRICT;

ALTER TABLE appointments
  ADD CONSTRAINT appointments_practitioner_time_no_overlap_excl
  EXCLUDE USING gist (
    practitioner_id WITH =,
    tstzrange(scheduled_start, scheduled_end, '[)') WITH &&
  )
  WHERE (status IN ('SCHEDULED', 'CONFIRMED'));

CREATE INDEX appointments_patient_id_idx
  ON appointments (patient_id);

CREATE INDEX appointments_practitioner_id_idx
  ON appointments (practitioner_id);

CREATE INDEX appointments_facility_id_idx
  ON appointments (facility_id);

CREATE INDEX appointments_status_idx
  ON appointments (status);

CREATE INDEX appointments_scheduled_start_idx
  ON appointments (scheduled_start, id);

CREATE INDEX appointments_practitioner_time_idx
  ON appointments (practitioner_id, scheduled_start, scheduled_end, id);
