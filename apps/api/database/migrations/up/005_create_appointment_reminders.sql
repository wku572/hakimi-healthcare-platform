ALTER TABLE appointments
  ADD COLUMN schedule_version integer NOT NULL DEFAULT 1;

ALTER TABLE appointments
  ADD CONSTRAINT appointments_schedule_version_positive_check
  CHECK (schedule_version > 0);

CREATE TABLE appointment_reminders (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  appointment_id uuid NOT NULL,
  reminder_kind varchar(30) NOT NULL,
  schedule_version integer NOT NULL,
  idempotency_key varchar(200) NOT NULL,
  available_at timestamptz NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'PENDING',
  attempt_count integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  locked_at timestamptz,
  locked_until timestamptz,
  locked_by varchar(100),
  lease_token uuid,
  last_error_category varchar(50),
  delivered_at timestamptz,
  cancelled_at timestamptz,
  superseded_at timestamptz,
  dead_lettered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT appointment_reminders_kind_check CHECK (
    reminder_kind = 'APPOINTMENT_24H'
  ),
  CONSTRAINT appointment_reminders_status_check CHECK (
    status = upper(btrim(status))
    AND status IN (
      'PENDING',
      'PROCESSING',
      'DELIVERED',
      'CANCELLED',
      'SUPERSEDED',
      'DEAD_LETTER'
    )
  ),
  CONSTRAINT appointment_reminders_schedule_version_positive_check CHECK (
    schedule_version > 0
  ),
  CONSTRAINT appointment_reminders_attempt_count_nonnegative_check CHECK (
    attempt_count >= 0
  ),
  CONSTRAINT appointment_reminders_max_attempts_positive_check CHECK (
    max_attempts > 0
  ),
  CONSTRAINT appointment_reminders_state_consistency_check CHECK (
    (
      status = 'PENDING'
      AND locked_at IS NULL
      AND locked_until IS NULL
      AND locked_by IS NULL
      AND lease_token IS NULL
      AND delivered_at IS NULL
      AND cancelled_at IS NULL
      AND superseded_at IS NULL
      AND dead_lettered_at IS NULL
    )
    OR (
      status = 'PROCESSING'
      AND locked_at IS NOT NULL
      AND locked_until IS NOT NULL
      AND locked_by IS NOT NULL
      AND lease_token IS NOT NULL
      AND delivered_at IS NULL
      AND cancelled_at IS NULL
      AND superseded_at IS NULL
      AND dead_lettered_at IS NULL
    )
    OR (
      status = 'DELIVERED'
      AND delivered_at IS NOT NULL
      AND locked_at IS NULL
      AND locked_until IS NULL
      AND locked_by IS NULL
      AND lease_token IS NULL
      AND cancelled_at IS NULL
      AND superseded_at IS NULL
      AND dead_lettered_at IS NULL
    )
    OR (
      status = 'CANCELLED'
      AND cancelled_at IS NOT NULL
      AND locked_at IS NULL
      AND locked_until IS NULL
      AND locked_by IS NULL
      AND lease_token IS NULL
      AND delivered_at IS NULL
      AND superseded_at IS NULL
      AND dead_lettered_at IS NULL
    )
    OR (
      status = 'SUPERSEDED'
      AND superseded_at IS NOT NULL
      AND locked_at IS NULL
      AND locked_until IS NULL
      AND locked_by IS NULL
      AND lease_token IS NULL
      AND delivered_at IS NULL
      AND cancelled_at IS NULL
      AND dead_lettered_at IS NULL
    )
    OR (
      status = 'DEAD_LETTER'
      AND dead_lettered_at IS NOT NULL
      AND locked_at IS NULL
      AND locked_until IS NULL
      AND locked_by IS NULL
      AND lease_token IS NULL
      AND delivered_at IS NULL
      AND cancelled_at IS NULL
      AND superseded_at IS NULL
    )
  )
);

ALTER TABLE appointment_reminders
  ADD CONSTRAINT appointment_reminders_appointment_id_fkey
  FOREIGN KEY (appointment_id)
  REFERENCES appointments (id)
  ON DELETE RESTRICT;

ALTER TABLE appointment_reminders
  ADD CONSTRAINT appointment_reminders_appointment_kind_version_key
  UNIQUE (appointment_id, reminder_kind, schedule_version);

ALTER TABLE appointment_reminders
  ADD CONSTRAINT appointment_reminders_idempotency_key_key
  UNIQUE (idempotency_key);

CREATE INDEX appointment_reminders_appointment_id_idx
  ON appointment_reminders (appointment_id);

CREATE INDEX appointment_reminders_due_idx
  ON appointment_reminders (available_at, id)
  WHERE status = 'PENDING';

CREATE INDEX appointment_reminders_expired_processing_idx
  ON appointment_reminders (locked_until, id)
  WHERE status = 'PROCESSING';

CREATE INDEX appointment_reminders_dead_letter_backlog_idx
  ON appointment_reminders (dead_lettered_at, id)
  WHERE status = 'DEAD_LETTER';
