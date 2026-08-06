import { createPostgresPool } from './database.js';
import { loadEnvironment } from './env.js';

const allowedFacilityTypes = [
  'hospital',
  'clinic',
  'health_center',
  'diagnostic_center',
  'pharmacy',
] as const;

const allowedAdministrativeSexes = [
  'female',
  'male',
  'other',
  'unknown',
] as const;

const allowedAppointmentStatuses = [
  'SCHEDULED',
  'CONFIRMED',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
] as const;

type ColumnMetadata = {
  column_name: string;
  data_type: string;
  character_maximum_length: number | null;
  is_nullable: 'YES' | 'NO';
  default_expr: string | null;
};

type ExpectedColumnMetadata = {
  column_name: string;
  data_type: string;
  character_maximum_length: number | null;
  is_nullable: 'YES' | 'NO';
  default_expr: string | null;
};

type ConstraintMetadata = {
  conname: string;
  contype: string;
  columns: string | string[] | null;
  definition: string;
};

type IndexMetadata = {
  indexname: string;
  indexdef: string;
};

function normalizeSql(sql: string) {
  return sql.replace(/\s+/g, ' ').trim().toLowerCase();
}

function includesNormalizedFragment(
  actualSql: string,
  expectedFragment: string,
) {
  return normalizeSql(actualSql)
    .replace(/\s+/g, '')
    .includes(normalizeSql(expectedFragment).replace(/\s+/g, ''));
}

function parseConstraintColumns(columns: string | string[] | null): string[] {
  if (!columns) {
    return [];
  }

  if (Array.isArray(columns)) {
    return columns;
  }

  const trimmed = columns.trim();

  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
    return [trimmed];
  }

  const body = trimmed.slice(1, -1);

  if (!body) {
    return [];
  }

  return body.split(',').map((value) => value.replace(/^"(.*)"$/, '$1'));
}

async function assertTableExists(
  client: {
    query<T extends Record<string, unknown>>(
      text: string,
      values?: unknown[],
    ): Promise<{
      rows: T[];
    }>;
  },
  tableName: string,
) {
  const tableResult = await client.query<{ exists: boolean }>(
    `
      SELECT to_regclass($1) IS NOT NULL AS exists
    `,
    [`public.${tableName}`],
  );

  if (!tableResult.rows[0]?.exists) {
    throw new Error(`Table ${tableName} does not exist.`);
  }
}

async function assertColumns(
  client: {
    query<T extends Record<string, unknown>>(
      text: string,
      values?: unknown[],
    ): Promise<{
      rows: T[];
    }>;
  },
  tableName: string,
  expectedColumns: ExpectedColumnMetadata[],
) {
  const columnsResult = await client.query<ColumnMetadata>(
    `
      SELECT
        a.attname AS column_name,
        format_type(a.atttypid, a.atttypmod) AS data_type,
        CASE
          WHEN a.atttypmod > 4 THEN a.atttypmod - 4
          ELSE NULL
        END AS character_maximum_length,
        CASE WHEN a.attnotnull THEN 'NO' ELSE 'YES' END AS is_nullable,
        pg_get_expr(ad.adbin, ad.adrelid) AS default_expr
      FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      LEFT JOIN pg_attrdef ad
        ON ad.adrelid = a.attrelid
       AND ad.adnum = a.attnum
      WHERE n.nspname = 'public'
        AND c.relname = $1
        AND a.attnum > 0
        AND NOT a.attisdropped
      ORDER BY a.attnum
    `,
    [tableName],
  );

  if (columnsResult.rows.length !== expectedColumns.length) {
    throw new Error(
      `${tableName} has ${columnsResult.rows.length} columns, expected ${expectedColumns.length}.`,
    );
  }

  for (const [index, expectedColumn] of expectedColumns.entries()) {
    const actualColumn = columnsResult.rows[index];

    if (!actualColumn) {
      throw new Error(`Missing column ${expectedColumn.column_name}.`);
    }

    const actualDefault = actualColumn.default_expr
      ? normalizeSql(actualColumn.default_expr)
      : null;
    const expectedDefault = expectedColumn.default_expr
      ? normalizeSql(expectedColumn.default_expr)
      : null;

    if (
      actualColumn.column_name !== expectedColumn.column_name ||
      actualColumn.data_type !== expectedColumn.data_type ||
      actualColumn.character_maximum_length !==
        expectedColumn.character_maximum_length ||
      actualColumn.is_nullable !== expectedColumn.is_nullable ||
      actualDefault !== expectedDefault
    ) {
      throw new Error(
        `Column ${expectedColumn.column_name} on ${tableName} does not match the expected schema.`,
      );
    }
  }
}

async function assertConstraints(
  client: {
    query<T extends Record<string, unknown>>(
      text: string,
      values?: unknown[],
    ): Promise<{
      rows: T[];
    }>;
  },
  tableName: string,
  expectedConstraints: Record<
    string,
    {
      type: string;
      columns: string[];
      definitionFragments?: string[];
    }
  >,
) {
  const constraintResult = await client.query<ConstraintMetadata>(
    `
      SELECT
        con.conname,
        con.contype,
        array_remove(array_agg(att.attname ORDER BY key.ordinality), NULL) AS columns,
        pg_get_constraintdef(con.oid, true) AS definition
      FROM pg_constraint con
      JOIN pg_class c ON c.oid = con.conrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      LEFT JOIN unnest(con.conkey) WITH ORDINALITY AS key(attnum, ordinality) ON TRUE
      LEFT JOIN pg_attribute att
        ON att.attrelid = con.conrelid
       AND att.attnum = key.attnum
      WHERE n.nspname = 'public'
        AND c.relname = $1
        AND con.contype IN ('p', 'u', 'c', 'f', 'x')
      GROUP BY con.conname, con.contype, con.oid
      ORDER BY con.conname
    `,
    [tableName],
  );

  const constraintsByName = new Map(
    constraintResult.rows.map(
      (constraint) => [constraint.conname, constraint] as const,
    ),
  );

  for (const [constraintName, expectation] of Object.entries(
    expectedConstraints,
  )) {
    const actualConstraint = constraintsByName.get(constraintName);

    if (!actualConstraint) {
      throw new Error(`Missing constraint ${constraintName} on ${tableName}.`);
    }

    if (actualConstraint.contype !== expectation.type) {
      throw new Error(`Constraint ${constraintName} has the wrong type.`);
    }

    const actualColumns = parseConstraintColumns(actualConstraint.columns);
    if (JSON.stringify(actualColumns) !== JSON.stringify(expectation.columns)) {
      throw new Error(`Constraint ${constraintName} covers the wrong columns.`);
    }

    if (
      expectation.definitionFragments &&
      !expectation.definitionFragments.every((fragment) =>
        includesNormalizedFragment(actualConstraint.definition, fragment),
      )
    ) {
      throw new Error(
        `Constraint ${constraintName} does not match the expected definition.`,
      );
    }
  }
}

async function assertIndexes(
  client: {
    query<T extends Record<string, unknown>>(
      text: string,
      values?: unknown[],
    ): Promise<{
      rows: T[];
    }>;
  },
  tableName: string,
  expectedIndexes: Record<
    string,
    {
      definitionFragments: string[];
    }
  >,
) {
  const result = await client.query<IndexMetadata>(
    `
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = $1
      ORDER BY indexname
    `,
    [tableName],
  );

  const indexesByName = new Map(
    result.rows.map((index) => [index.indexname, index] as const),
  );

  for (const [indexName, expectation] of Object.entries(expectedIndexes)) {
    const actualIndex = indexesByName.get(indexName);

    if (!actualIndex) {
      throw new Error(`Missing index ${indexName} on ${tableName}.`);
    }

    if (
      !expectation.definitionFragments.every((fragment) =>
        includesNormalizedFragment(actualIndex.indexdef, fragment),
      )
    ) {
      throw new Error(
        `Index ${indexName} on ${tableName} does not match the expected definition.`,
      );
    }
  }
}

async function verifyHealthcareFacilitySchema(client: {
  query<T extends Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<{
    rows: T[];
  }>;
}) {
  await assertTableExists(client, 'healthcare_facilities');
  await assertColumns(client, 'healthcare_facilities', [
    {
      column_name: 'id',
      data_type: 'uuid',
      character_maximum_length: null,
      is_nullable: 'NO',
      default_expr: 'uuidv7()',
    },
    {
      column_name: 'code',
      data_type: 'text',
      character_maximum_length: null,
      is_nullable: 'NO',
      default_expr: null,
    },
    {
      column_name: 'name',
      data_type: 'text',
      character_maximum_length: null,
      is_nullable: 'NO',
      default_expr: null,
    },
    {
      column_name: 'facility_type',
      data_type: 'text',
      character_maximum_length: null,
      is_nullable: 'NO',
      default_expr: null,
    },
    {
      column_name: 'license_number',
      data_type: 'text',
      character_maximum_length: null,
      is_nullable: 'YES',
      default_expr: null,
    },
    {
      column_name: 'phone',
      data_type: 'text',
      character_maximum_length: null,
      is_nullable: 'YES',
      default_expr: null,
    },
    {
      column_name: 'email',
      data_type: 'text',
      character_maximum_length: null,
      is_nullable: 'YES',
      default_expr: null,
    },
    {
      column_name: 'region',
      data_type: 'text',
      character_maximum_length: null,
      is_nullable: 'NO',
      default_expr: null,
    },
    {
      column_name: 'city',
      data_type: 'text',
      character_maximum_length: null,
      is_nullable: 'NO',
      default_expr: null,
    },
    {
      column_name: 'address_line',
      data_type: 'text',
      character_maximum_length: null,
      is_nullable: 'YES',
      default_expr: null,
    },
    {
      column_name: 'is_active',
      data_type: 'boolean',
      character_maximum_length: null,
      is_nullable: 'NO',
      default_expr: 'true',
    },
    {
      column_name: 'created_at',
      data_type: 'timestamp with time zone',
      character_maximum_length: null,
      is_nullable: 'NO',
      default_expr: 'now()',
    },
    {
      column_name: 'updated_at',
      data_type: 'timestamp with time zone',
      character_maximum_length: null,
      is_nullable: 'NO',
      default_expr: 'now()',
    },
  ]);
  await assertConstraints(client, 'healthcare_facilities', {
    healthcare_facilities_pkey: {
      type: 'p',
      columns: ['id'],
    },
    healthcare_facilities_code_key: {
      type: 'u',
      columns: ['code'],
    },
    healthcare_facilities_license_number_key: {
      type: 'u',
      columns: ['license_number'],
    },
    healthcare_facilities_code_not_blank_check: {
      type: 'c',
      columns: ['code'],
      definitionFragments: ["btrim(code)<>''::text"],
    },
    healthcare_facilities_name_not_blank_check: {
      type: 'c',
      columns: ['name'],
      definitionFragments: ["btrim(name)<>''::text"],
    },
    healthcare_facilities_region_not_blank_check: {
      type: 'c',
      columns: ['region'],
      definitionFragments: ["btrim(region)<>''::text"],
    },
    healthcare_facilities_city_not_blank_check: {
      type: 'c',
      columns: ['city'],
      definitionFragments: ["btrim(city)<>''::text"],
    },
    healthcare_facilities_facility_type_check: {
      type: 'c',
      columns: ['facility_type'],
      definitionFragments: [
        'facility_type=lower(btrim(facility_type))',
        `facility_type=any(array[${allowedFacilityTypes
          .map((facilityType) => `'${facilityType}'::text`)
          .join(',')}])`,
      ],
    },
  });
}

async function verifyPractitionerSchema(client: {
  query<T extends Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<{
    rows: T[];
  }>;
}) {
  await assertTableExists(client, 'practitioners');
  await assertColumns(client, 'practitioners', [
    {
      column_name: 'id',
      data_type: 'uuid',
      character_maximum_length: null,
      is_nullable: 'NO',
      default_expr: 'uuidv7()',
    },
    {
      column_name: 'code',
      data_type: 'character varying(50)',
      character_maximum_length: 50,
      is_nullable: 'NO',
      default_expr: null,
    },
    {
      column_name: 'first_name',
      data_type: 'character varying(100)',
      character_maximum_length: 100,
      is_nullable: 'NO',
      default_expr: null,
    },
    {
      column_name: 'middle_name',
      data_type: 'character varying(100)',
      character_maximum_length: 100,
      is_nullable: 'YES',
      default_expr: null,
    },
    {
      column_name: 'last_name',
      data_type: 'character varying(100)',
      character_maximum_length: 100,
      is_nullable: 'NO',
      default_expr: null,
    },
    {
      column_name: 'profession',
      data_type: 'character varying(100)',
      character_maximum_length: 100,
      is_nullable: 'NO',
      default_expr: null,
    },
    {
      column_name: 'license_number',
      data_type: 'character varying(100)',
      character_maximum_length: 100,
      is_nullable: 'NO',
      default_expr: null,
    },
    {
      column_name: 'phone',
      data_type: 'character varying(30)',
      character_maximum_length: 30,
      is_nullable: 'YES',
      default_expr: null,
    },
    {
      column_name: 'email',
      data_type: 'character varying(254)',
      character_maximum_length: 254,
      is_nullable: 'YES',
      default_expr: null,
    },
    {
      column_name: 'bio',
      data_type: 'character varying(2000)',
      character_maximum_length: 2000,
      is_nullable: 'YES',
      default_expr: null,
    },
    {
      column_name: 'is_active',
      data_type: 'boolean',
      character_maximum_length: null,
      is_nullable: 'NO',
      default_expr: 'true',
    },
    {
      column_name: 'created_at',
      data_type: 'timestamp with time zone',
      character_maximum_length: null,
      is_nullable: 'NO',
      default_expr: 'now()',
    },
    {
      column_name: 'updated_at',
      data_type: 'timestamp with time zone',
      character_maximum_length: null,
      is_nullable: 'NO',
      default_expr: 'now()',
    },
  ]);
  await assertConstraints(client, 'practitioners', {
    practitioners_pkey: {
      type: 'p',
      columns: ['id'],
    },
    practitioners_code_key: {
      type: 'u',
      columns: ['code'],
    },
    practitioners_license_number_key: {
      type: 'u',
      columns: ['license_number'],
    },
    practitioners_code_not_blank_check: {
      type: 'c',
      columns: ['code'],
      definitionFragments: ["btrim(code::text)<>''::text"],
    },
    practitioners_first_name_not_blank_check: {
      type: 'c',
      columns: ['first_name'],
      definitionFragments: ["btrim(first_name::text)<>''::text"],
    },
    practitioners_last_name_not_blank_check: {
      type: 'c',
      columns: ['last_name'],
      definitionFragments: ["btrim(last_name::text)<>''::text"],
    },
    practitioners_profession_not_blank_check: {
      type: 'c',
      columns: ['profession'],
      definitionFragments: ["btrim(profession::text)<>''::text"],
    },
    practitioners_license_number_not_blank_check: {
      type: 'c',
      columns: ['license_number'],
      definitionFragments: ["btrim(license_number::text)<>''::text"],
    },
  });
  await assertIndexes(client, 'practitioners', {
    practitioners_last_name_first_name_id_idx: {
      definitionFragments: [
        'create index practitioners_last_name_first_name_id_idx',
        '(last_name, first_name, id)',
      ],
    },
  });
}

async function verifyAssignmentSchema(client: {
  query<T extends Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<{
    rows: T[];
  }>;
}) {
  await assertTableExists(client, 'practitioner_facility_assignments');
  await assertColumns(client, 'practitioner_facility_assignments', [
    {
      column_name: 'id',
      data_type: 'uuid',
      character_maximum_length: null,
      is_nullable: 'NO',
      default_expr: 'uuidv7()',
    },
    {
      column_name: 'practitioner_id',
      data_type: 'uuid',
      character_maximum_length: null,
      is_nullable: 'NO',
      default_expr: null,
    },
    {
      column_name: 'facility_id',
      data_type: 'uuid',
      character_maximum_length: null,
      is_nullable: 'NO',
      default_expr: null,
    },
    {
      column_name: 'role_title',
      data_type: 'character varying(100)',
      character_maximum_length: 100,
      is_nullable: 'NO',
      default_expr: null,
    },
    {
      column_name: 'department',
      data_type: 'character varying(100)',
      character_maximum_length: 100,
      is_nullable: 'YES',
      default_expr: null,
    },
    {
      column_name: 'is_primary',
      data_type: 'boolean',
      character_maximum_length: null,
      is_nullable: 'NO',
      default_expr: 'false',
    },
    {
      column_name: 'is_active',
      data_type: 'boolean',
      character_maximum_length: null,
      is_nullable: 'NO',
      default_expr: 'true',
    },
    {
      column_name: 'created_at',
      data_type: 'timestamp with time zone',
      character_maximum_length: null,
      is_nullable: 'NO',
      default_expr: 'now()',
    },
    {
      column_name: 'updated_at',
      data_type: 'timestamp with time zone',
      character_maximum_length: null,
      is_nullable: 'NO',
      default_expr: 'now()',
    },
  ]);
  await assertConstraints(client, 'practitioner_facility_assignments', {
    practitioner_facility_assignments_pkey: {
      type: 'p',
      columns: ['id'],
    },
    practitioner_facility_assignments_practitioner_facility_key: {
      type: 'u',
      columns: ['practitioner_id', 'facility_id'],
    },
    practitioner_facility_assignments_practitioner_id_fkey: {
      type: 'f',
      columns: ['practitioner_id'],
      definitionFragments: [
        'references practitioners(id)',
        'on delete restrict',
      ],
    },
    practitioner_facility_assignments_facility_id_fkey: {
      type: 'f',
      columns: ['facility_id'],
      definitionFragments: [
        'references healthcare_facilities(id)',
        'on delete restrict',
      ],
    },
    practitioner_facility_assignments_role_title_not_blank_check: {
      type: 'c',
      columns: ['role_title'],
      definitionFragments: ["btrim(role_title::text)<>''::text"],
    },
    practitioner_facility_assignments_department_not_blank_check: {
      type: 'c',
      columns: ['department'],
      definitionFragments: [
        "department is null or btrim(department::text)<>''::text",
      ],
    },
  });
  await assertIndexes(client, 'practitioner_facility_assignments', {
    practitioner_facility_assignments_active_primary_unique_idx: {
      definitionFragments: [
        'create unique index practitioner_facility_assignments_active_primary_unique_idx',
        'where ((is_primary = true) and (is_active = true))',
      ],
    },
    practitioner_facility_assignments_practitioner_id_idx: {
      definitionFragments: [
        'create index practitioner_facility_assignments_practitioner_id_idx',
        '(practitioner_id)',
      ],
    },
    practitioner_facility_assignments_facility_id_idx: {
      definitionFragments: [
        'create index practitioner_facility_assignments_facility_id_idx',
        '(facility_id)',
      ],
    },
    practitioner_facility_assignments_active_practitioner_id_idx: {
      definitionFragments: [
        'create index practitioner_facility_assignments_active_practitioner_id_idx',
        'where (is_active = true)',
      ],
    },
    practitioner_facility_assignments_active_facility_id_idx: {
      definitionFragments: [
        'create index practitioner_facility_assignments_active_facility_id_idx',
        'where (is_active = true)',
      ],
    },
  });
}

async function verifyPatientSchema(client: {
  query<T extends Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<{
    rows: T[];
  }>;
}) {
  await assertTableExists(client, 'patients');
  await assertColumns(client, 'patients', [
    {
      column_name: 'id',
      data_type: 'uuid',
      character_maximum_length: null,
      is_nullable: 'NO',
      default_expr: 'uuidv7()',
    },
    {
      column_name: 'first_name',
      data_type: 'character varying(100)',
      character_maximum_length: 100,
      is_nullable: 'NO',
      default_expr: null,
    },
    {
      column_name: 'middle_name',
      data_type: 'character varying(100)',
      character_maximum_length: 100,
      is_nullable: 'YES',
      default_expr: null,
    },
    {
      column_name: 'last_name',
      data_type: 'character varying(100)',
      character_maximum_length: 100,
      is_nullable: 'YES',
      default_expr: null,
    },
    {
      column_name: 'date_of_birth',
      data_type: 'date',
      character_maximum_length: null,
      is_nullable: 'YES',
      default_expr: null,
    },
    {
      column_name: 'administrative_sex',
      data_type: 'character varying(20)',
      character_maximum_length: 20,
      is_nullable: 'NO',
      default_expr: null,
    },
    {
      column_name: 'phone',
      data_type: 'character varying(30)',
      character_maximum_length: 30,
      is_nullable: 'YES',
      default_expr: null,
    },
    {
      column_name: 'email',
      data_type: 'character varying(254)',
      character_maximum_length: 254,
      is_nullable: 'YES',
      default_expr: null,
    },
    {
      column_name: 'address_line',
      data_type: 'character varying(200)',
      character_maximum_length: 200,
      is_nullable: 'YES',
      default_expr: null,
    },
    {
      column_name: 'city',
      data_type: 'character varying(100)',
      character_maximum_length: 100,
      is_nullable: 'YES',
      default_expr: null,
    },
    {
      column_name: 'region',
      data_type: 'character varying(100)',
      character_maximum_length: 100,
      is_nullable: 'YES',
      default_expr: null,
    },
    {
      column_name: 'is_active',
      data_type: 'boolean',
      character_maximum_length: null,
      is_nullable: 'NO',
      default_expr: 'true',
    },
    {
      column_name: 'created_at',
      data_type: 'timestamp with time zone',
      character_maximum_length: null,
      is_nullable: 'NO',
      default_expr: 'now()',
    },
    {
      column_name: 'updated_at',
      data_type: 'timestamp with time zone',
      character_maximum_length: null,
      is_nullable: 'NO',
      default_expr: 'now()',
    },
  ]);
  await assertConstraints(client, 'patients', {
    patients_pkey: {
      type: 'p',
      columns: ['id'],
    },
    patients_first_name_not_blank_check: {
      type: 'c',
      columns: ['first_name'],
      definitionFragments: ["btrim(first_name::text)<>''::text"],
    },
    patients_middle_name_not_blank_check: {
      type: 'c',
      columns: ['middle_name'],
      definitionFragments: [
        "middle_name is null or btrim(middle_name::text)<>''::text",
      ],
    },
    patients_last_name_not_blank_check: {
      type: 'c',
      columns: ['last_name'],
      definitionFragments: [
        "last_name is null or btrim(last_name::text)<>''::text",
      ],
    },
    patients_administrative_sex_check: {
      type: 'c',
      columns: ['administrative_sex'],
      definitionFragments: [
        'administrative_sex::text = lower(btrim(administrative_sex::text))',
        `administrative_sex::text = any(array[${allowedAdministrativeSexes
          .map((value) => `'${value}'::character varying`)
          .join(', ')}]::text[])`,
      ],
    },
    patients_phone_not_blank_check: {
      type: 'c',
      columns: ['phone'],
      definitionFragments: ["phone is null or btrim(phone::text)<>''::text"],
    },
    patients_email_not_blank_check: {
      type: 'c',
      columns: ['email'],
      definitionFragments: ["email is null or btrim(email::text)<>''::text"],
    },
    patients_address_line_not_blank_check: {
      type: 'c',
      columns: ['address_line'],
      definitionFragments: [
        "address_line is null or btrim(address_line::text)<>''::text",
      ],
    },
    patients_city_not_blank_check: {
      type: 'c',
      columns: ['city'],
      definitionFragments: ["city is null or btrim(city::text)<>''::text"],
    },
    patients_region_not_blank_check: {
      type: 'c',
      columns: ['region'],
      definitionFragments: ["region is null or btrim(region::text)<>''::text"],
    },
  });
  await assertIndexes(client, 'patients', {
    patients_name_search_idx: {
      definitionFragments: [
        'create index patients_name_search_idx',
        '(first_name, middle_name, last_name, id)',
      ],
    },
    patients_last_name_first_name_id_idx: {
      definitionFragments: [
        'create index patients_last_name_first_name_id_idx',
        '(last_name, first_name, id)',
      ],
    },
  });
}

async function verifyPatientRegistrationSchema(client: {
  query<T extends Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<{
    rows: T[];
  }>;
}) {
  await assertTableExists(client, 'patient_facility_registrations');
  await assertColumns(client, 'patient_facility_registrations', [
    {
      column_name: 'id',
      data_type: 'uuid',
      character_maximum_length: null,
      is_nullable: 'NO',
      default_expr: 'uuidv7()',
    },
    {
      column_name: 'patient_id',
      data_type: 'uuid',
      character_maximum_length: null,
      is_nullable: 'NO',
      default_expr: null,
    },
    {
      column_name: 'facility_id',
      data_type: 'uuid',
      character_maximum_length: null,
      is_nullable: 'NO',
      default_expr: null,
    },
    {
      column_name: 'medical_record_number',
      data_type: 'character varying(50)',
      character_maximum_length: 50,
      is_nullable: 'NO',
      default_expr: null,
    },
    {
      column_name: 'created_at',
      data_type: 'timestamp with time zone',
      character_maximum_length: null,
      is_nullable: 'NO',
      default_expr: 'now()',
    },
    {
      column_name: 'updated_at',
      data_type: 'timestamp with time zone',
      character_maximum_length: null,
      is_nullable: 'NO',
      default_expr: 'now()',
    },
  ]);
  await assertConstraints(client, 'patient_facility_registrations', {
    patient_facility_registrations_pkey: {
      type: 'p',
      columns: ['id'],
    },
    patient_facility_registrations_patient_id_fkey: {
      type: 'f',
      columns: ['patient_id'],
      definitionFragments: ['references patients(id)', 'on delete restrict'],
    },
    patient_facility_registrations_facility_id_fkey: {
      type: 'f',
      columns: ['facility_id'],
      definitionFragments: [
        'references healthcare_facilities(id)',
        'on delete restrict',
      ],
    },
    patient_facility_registrations_mrn_not_blank_check: {
      type: 'c',
      columns: ['medical_record_number'],
      definitionFragments: ["btrim(medical_record_number::text)<>''::text"],
    },
    patient_facility_registrations_facility_mrn_key: {
      type: 'u',
      columns: ['facility_id', 'medical_record_number'],
    },
    patient_facility_registrations_patient_facility_key: {
      type: 'u',
      columns: ['patient_id', 'facility_id'],
    },
  });
  await assertIndexes(client, 'patient_facility_registrations', {
    patient_facility_registrations_patient_id_idx: {
      definitionFragments: [
        'create index patient_facility_registrations_patient_id_idx',
        '(patient_id)',
      ],
    },
    patient_facility_registrations_facility_id_idx: {
      definitionFragments: [
        'create index patient_facility_registrations_facility_id_idx',
        '(facility_id)',
      ],
    },
  });
}

async function verifyAppointmentSchema(client: {
  query<T extends Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<{
    rows: T[];
  }>;
}) {
  await assertTableExists(client, 'appointments');
  await assertColumns(client, 'appointments', [
    {
      column_name: 'id',
      data_type: 'uuid',
      character_maximum_length: null,
      is_nullable: 'NO',
      default_expr: 'uuidv7()',
    },
    {
      column_name: 'patient_id',
      data_type: 'uuid',
      character_maximum_length: null,
      is_nullable: 'NO',
      default_expr: null,
    },
    {
      column_name: 'practitioner_id',
      data_type: 'uuid',
      character_maximum_length: null,
      is_nullable: 'NO',
      default_expr: null,
    },
    {
      column_name: 'facility_id',
      data_type: 'uuid',
      character_maximum_length: null,
      is_nullable: 'NO',
      default_expr: null,
    },
    {
      column_name: 'scheduled_start',
      data_type: 'timestamp with time zone',
      character_maximum_length: null,
      is_nullable: 'NO',
      default_expr: null,
    },
    {
      column_name: 'scheduled_end',
      data_type: 'timestamp with time zone',
      character_maximum_length: null,
      is_nullable: 'NO',
      default_expr: null,
    },
    {
      column_name: 'status',
      data_type: 'character varying(20)',
      character_maximum_length: 20,
      is_nullable: 'NO',
      default_expr: "'SCHEDULED'::character varying",
    },
    {
      column_name: 'cancellation_reason',
      data_type: 'character varying(1000)',
      character_maximum_length: 1000,
      is_nullable: 'YES',
      default_expr: null,
    },
    {
      column_name: 'cancelled_at',
      data_type: 'timestamp with time zone',
      character_maximum_length: null,
      is_nullable: 'YES',
      default_expr: null,
    },
    {
      column_name: 'created_at',
      data_type: 'timestamp with time zone',
      character_maximum_length: null,
      is_nullable: 'NO',
      default_expr: 'now()',
    },
    {
      column_name: 'updated_at',
      data_type: 'timestamp with time zone',
      character_maximum_length: null,
      is_nullable: 'NO',
      default_expr: 'now()',
    },
  ]);
  await assertConstraints(client, 'appointments', {
    appointments_pkey: {
      type: 'p',
      columns: ['id'],
    },
    appointments_patient_id_fkey: {
      type: 'f',
      columns: ['patient_id'],
      definitionFragments: ['references patients(id)', 'on delete restrict'],
    },
    appointments_practitioner_id_fkey: {
      type: 'f',
      columns: ['practitioner_id'],
      definitionFragments: [
        'references practitioners(id)',
        'on delete restrict',
      ],
    },
    appointments_facility_id_fkey: {
      type: 'f',
      columns: ['facility_id'],
      definitionFragments: [
        'references healthcare_facilities(id)',
        'on delete restrict',
      ],
    },
    appointments_scheduled_window_check: {
      type: 'c',
      columns: ['scheduled_start', 'scheduled_end'],
      definitionFragments: ['scheduled_start < scheduled_end'],
    },
    appointments_status_check: {
      type: 'c',
      columns: ['status'],
      definitionFragments: [
        'status::text = upper(btrim(status::text))',
        `(status::text = any (array[${allowedAppointmentStatuses
          .map((value) => `'${value}'::character varying`)
          .join(', ')}]::text[]))`,
      ],
    },
    appointments_cancellation_reason_not_blank_check: {
      type: 'c',
      columns: ['status', 'cancellation_reason'],
      definitionFragments: [
        "status::text <> 'CANCELLED'::text OR btrim(cancellation_reason::text) <> ''::text",
      ],
    },
    appointments_cancelled_at_check: {
      type: 'c',
      columns: ['status', 'cancelled_at'],
      definitionFragments: [
        "status::text = 'CANCELLED'::text AND cancelled_at IS NOT NULL OR status::text <> 'CANCELLED'::text AND cancelled_at IS NULL",
      ],
    },
    appointments_practitioner_time_no_overlap_excl: {
      type: 'x',
      columns: ['practitioner_id'],
      definitionFragments: [
        'exclude using gist',
        'practitioner_id with =',
        "tstzrange(scheduled_start, scheduled_end, '[)'::text) with &&",
        `where (status::text = any (array[${allowedAppointmentStatuses
          .filter((value) => value === 'SCHEDULED' || value === 'CONFIRMED')
          .map((value) => `'${value}'::character varying`)
          .join(', ')}]::text[]))`,
      ],
    },
  });
  await assertIndexes(client, 'appointments', {
    appointments_patient_id_idx: {
      definitionFragments: [
        'create index appointments_patient_id_idx',
        '(patient_id)',
      ],
    },
    appointments_practitioner_id_idx: {
      definitionFragments: [
        'create index appointments_practitioner_id_idx',
        '(practitioner_id)',
      ],
    },
    appointments_facility_id_idx: {
      definitionFragments: [
        'create index appointments_facility_id_idx',
        '(facility_id)',
      ],
    },
    appointments_status_idx: {
      definitionFragments: ['create index appointments_status_idx', '(status)'],
    },
    appointments_scheduled_start_idx: {
      definitionFragments: [
        'create index appointments_scheduled_start_idx',
        '(scheduled_start, id)',
      ],
    },
    appointments_practitioner_time_idx: {
      definitionFragments: [
        'create index appointments_practitioner_time_idx',
        '(practitioner_id, scheduled_start, scheduled_end, id)',
      ],
    },
  });
}

async function verifySchema() {
  const env = loadEnvironment();
  const pool = createPostgresPool(env.DATABASE_URL);

  try {
    const client = await pool.connect();

    try {
      await verifyHealthcareFacilitySchema(client);
      await verifyPractitionerSchema(client);
      await verifyPatientSchema(client);
      await verifyPatientRegistrationSchema(client);
      await verifyAssignmentSchema(client);
      await verifyAppointmentSchema(client);
      console.log(
        'Schema verification passed for healthcare_facilities, practitioners, patients, patient_facility_registrations, practitioner_facility_assignments, and appointments.',
      );
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

async function main() {
  await verifySchema();
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
