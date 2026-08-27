CREATE TABLE workforce_actors (
  id uuid NOT NULL DEFAULT uuidv7(),
  oidc_issuer varchar(500) NOT NULL,
  oidc_subject varchar(255) NOT NULL,
  practitioner_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  activated_at timestamptz NOT NULL DEFAULT now(),
  deactivated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workforce_actors_pkey PRIMARY KEY (id),
  CONSTRAINT workforce_actors_issuer_subject_key UNIQUE (oidc_issuer, oidc_subject),
  CONSTRAINT workforce_actors_practitioner_id_fkey
    FOREIGN KEY (practitioner_id) REFERENCES practitioners (id) ON DELETE RESTRICT,
  CONSTRAINT workforce_actors_issuer_not_blank_check CHECK (btrim(oidc_issuer) <> ''::text),
  CONSTRAINT workforce_actors_subject_not_blank_check CHECK (btrim(oidc_subject) <> ''::text),
  CONSTRAINT workforce_actors_state_check CHECK (
    (is_active = true AND deactivated_at IS NULL)
    OR (is_active = false AND deactivated_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX workforce_actors_practitioner_unique_idx
  ON workforce_actors (practitioner_id)
  WHERE practitioner_id IS NOT NULL;

CREATE INDEX workforce_actors_active_idx
  ON workforce_actors (id)
  WHERE is_active = true;

CREATE TABLE workforce_role_assignments (
  id uuid NOT NULL DEFAULT uuidv7(),
  actor_id uuid NOT NULL,
  role varchar(30) NOT NULL,
  facility_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  activated_at timestamptz NOT NULL DEFAULT now(),
  deactivated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workforce_role_assignments_pkey PRIMARY KEY (id),
  CONSTRAINT workforce_role_assignments_actor_id_fkey
    FOREIGN KEY (actor_id) REFERENCES workforce_actors (id) ON DELETE RESTRICT,
  CONSTRAINT workforce_role_assignments_facility_id_fkey
    FOREIGN KEY (facility_id) REFERENCES healthcare_facilities (id) ON DELETE RESTRICT,
  CONSTRAINT workforce_role_assignments_role_check CHECK (
    role = upper(btrim(role))
    AND role IN (
      'PLATFORM_ADMIN',
      'FACILITY_ADMIN',
      'SCHEDULER',
      'PRACTITIONER',
      'OPERATIONS_OPERATOR'
    )
  ),
  CONSTRAINT workforce_role_assignments_scope_check CHECK (
    (role IN ('FACILITY_ADMIN', 'SCHEDULER') AND facility_id IS NOT NULL)
    OR (role IN ('PLATFORM_ADMIN', 'PRACTITIONER', 'OPERATIONS_OPERATOR') AND facility_id IS NULL)
  ),
  CONSTRAINT workforce_role_assignments_state_check CHECK (
    (is_active = true AND deactivated_at IS NULL)
    OR (is_active = false AND deactivated_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX workforce_roles_actor_global_unique_idx
  ON workforce_role_assignments (actor_id, role)
  WHERE facility_id IS NULL;

CREATE UNIQUE INDEX workforce_roles_actor_facility_unique_idx
  ON workforce_role_assignments (actor_id, role, facility_id)
  WHERE facility_id IS NOT NULL;

CREATE INDEX workforce_roles_active_actor_idx
  ON workforce_role_assignments (actor_id, role, facility_id)
  WHERE is_active = true;

CREATE INDEX workforce_roles_active_facility_idx
  ON workforce_role_assignments (facility_id, role, actor_id)
  WHERE is_active = true AND facility_id IS NOT NULL;

CREATE TABLE workforce_sessions (
  id uuid NOT NULL DEFAULT uuidv7(),
  actor_id uuid NOT NULL,
  oidc_session_hash char(64) NOT NULL,
  started_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL,
  absolute_expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  revocation_reason varchar(40),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workforce_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT workforce_sessions_actor_id_fkey
    FOREIGN KEY (actor_id) REFERENCES workforce_actors (id) ON DELETE RESTRICT,
  CONSTRAINT workforce_sessions_actor_hash_key UNIQUE (actor_id, oidc_session_hash),
  CONSTRAINT workforce_sessions_hash_format_check CHECK (
    oidc_session_hash ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT workforce_sessions_time_order_check CHECK (
    last_seen_at >= started_at
    AND absolute_expires_at > started_at
    AND last_seen_at <= absolute_expires_at
  ),
  CONSTRAINT workforce_sessions_reason_check CHECK (
    revocation_reason IS NULL
    OR revocation_reason IN (
      'ACTOR_DEACTIVATED',
      'ROLE_CHANGED',
      'FACILITY_SCOPE_CHANGED',
      'PRACTITIONER_STATE_CHANGED',
      'PRACTITIONER_ASSIGNMENT_CHANGED',
      'PRACTITIONER_BINDING_CHANGED',
      'MANUAL_REVOCATION'
    )
  ),
  CONSTRAINT workforce_sessions_revocation_state_check CHECK (
    (revoked_at IS NULL AND revocation_reason IS NULL)
    OR (revoked_at IS NOT NULL AND revocation_reason IS NOT NULL)
  )
);

CREATE INDEX workforce_sessions_active_actor_idx
  ON workforce_sessions (actor_id, id)
  WHERE revoked_at IS NULL;

CREATE INDEX workforce_sessions_expiry_idx
  ON workforce_sessions (absolute_expires_at, id);
