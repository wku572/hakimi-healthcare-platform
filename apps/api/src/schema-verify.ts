import { createPostgresPool } from './database.js';
import { loadEnvironment } from './env.js';

const allowedFacilityTypes = [
  'hospital',
  'clinic',
  'health_center',
  'diagnostic_center',
  'pharmacy',
] as const;

type ColumnMetadata = {
  column_name: string;
  data_type: string;
  is_nullable: 'YES' | 'NO';
  default_expr: string | null;
};

type ConstraintMetadata = {
  conname: string;
  contype: string;
  columns: string | string[] | null;
  definition: string;
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

async function verifyHealthcareFacilitySchema() {
  const env = loadEnvironment();
  const pool = createPostgresPool(env.DATABASE_URL);

  try {
    const client = await pool.connect();

    try {
      const tableResult = await client.query<{ exists: boolean }>(`
        SELECT to_regclass('public.healthcare_facilities') IS NOT NULL AS exists
      `);

      if (!tableResult.rows[0]?.exists) {
        throw new Error('Table healthcare_facilities does not exist.');
      }

      const columnsResult = await client.query<ColumnMetadata>(`
        SELECT
          a.attname AS column_name,
          format_type(a.atttypid, a.atttypmod) AS data_type,
          CASE WHEN a.attnotnull THEN 'NO' ELSE 'YES' END AS is_nullable,
          pg_get_expr(ad.adbin, ad.adrelid) AS default_expr
        FROM pg_attribute a
        JOIN pg_class c ON c.oid = a.attrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        LEFT JOIN pg_attrdef ad
          ON ad.adrelid = a.attrelid
         AND ad.adnum = a.attnum
        WHERE n.nspname = 'public'
          AND c.relname = 'healthcare_facilities'
          AND a.attnum > 0
          AND NOT a.attisdropped
        ORDER BY a.attnum
      `);

      const expectedColumns: ColumnMetadata[] = [
        {
          column_name: 'id',
          data_type: 'uuid',
          is_nullable: 'NO',
          default_expr: 'uuidv7()',
        },
        {
          column_name: 'code',
          data_type: 'text',
          is_nullable: 'NO',
          default_expr: null,
        },
        {
          column_name: 'name',
          data_type: 'text',
          is_nullable: 'NO',
          default_expr: null,
        },
        {
          column_name: 'facility_type',
          data_type: 'text',
          is_nullable: 'NO',
          default_expr: null,
        },
        {
          column_name: 'license_number',
          data_type: 'text',
          is_nullable: 'YES',
          default_expr: null,
        },
        {
          column_name: 'phone',
          data_type: 'text',
          is_nullable: 'YES',
          default_expr: null,
        },
        {
          column_name: 'email',
          data_type: 'text',
          is_nullable: 'YES',
          default_expr: null,
        },
        {
          column_name: 'region',
          data_type: 'text',
          is_nullable: 'NO',
          default_expr: null,
        },
        {
          column_name: 'city',
          data_type: 'text',
          is_nullable: 'NO',
          default_expr: null,
        },
        {
          column_name: 'address_line',
          data_type: 'text',
          is_nullable: 'YES',
          default_expr: null,
        },
        {
          column_name: 'is_active',
          data_type: 'boolean',
          is_nullable: 'NO',
          default_expr: 'true',
        },
        {
          column_name: 'created_at',
          data_type: 'timestamp with time zone',
          is_nullable: 'NO',
          default_expr: 'now()',
        },
        {
          column_name: 'updated_at',
          data_type: 'timestamp with time zone',
          is_nullable: 'NO',
          default_expr: 'now()',
        },
      ];

      if (columnsResult.rows.length !== expectedColumns.length) {
        throw new Error(
          `healthcare_facilities has ${columnsResult.rows.length} columns, expected ${expectedColumns.length}.`,
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
          actualColumn.is_nullable !== expectedColumn.is_nullable ||
          actualDefault !== expectedDefault
        ) {
          throw new Error(
            `Column ${expectedColumn.column_name} does not match the expected schema.`,
          );
        }
      }

      const constraintResult = await client.query<ConstraintMetadata>(`
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
          AND c.relname = 'healthcare_facilities'
          AND con.contype IN ('p', 'u', 'c')
        GROUP BY con.conname, con.contype, con.oid
        ORDER BY con.conname
      `);

      const constraintsByName = new Map(
        constraintResult.rows.map(
          (constraint) => [constraint.conname, constraint] as const,
        ),
      );

      const expectedConstraintDefinitions = {
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
      } as const;

      for (const [constraintName, expectation] of Object.entries(
        expectedConstraintDefinitions,
      )) {
        const actualConstraint = constraintsByName.get(constraintName);

        if (!actualConstraint) {
          throw new Error(`Missing constraint ${constraintName}.`);
        }

        if (actualConstraint.contype !== expectation.type) {
          throw new Error(`Constraint ${constraintName} has the wrong type.`);
        }

        const actualColumns = parseConstraintColumns(actualConstraint.columns);
        if (
          JSON.stringify(actualColumns) !== JSON.stringify(expectation.columns)
        ) {
          throw new Error(
            `Constraint ${constraintName} covers the wrong columns.`,
          );
        }

        if (
          'definitionFragments' in expectation &&
          !expectation.definitionFragments.every((fragment) =>
            includesNormalizedFragment(actualConstraint.definition, fragment),
          )
        ) {
          throw new Error(
            `Constraint ${constraintName} does not match the expected definition.`,
          );
        }
      }

      console.log('Schema verification passed for healthcare_facilities.');
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

async function main() {
  await verifyHealthcareFacilitySchema();
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
