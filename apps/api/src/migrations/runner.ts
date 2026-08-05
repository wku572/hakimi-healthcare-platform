import { fileURLToPath } from 'node:url';
import type { PoolClient } from 'pg';
import { createPostgresPool } from '../database.js';
import { loadEnvironment } from '../env.js';
import {
  assertMigrationChecksumMatches,
  formatMigrationLabel,
  loadMigrationCatalog,
  type MigrationDefinition,
} from './catalog.js';

export type MigrationCommand = 'up' | 'down' | 'status';

type AppliedMigrationRow = {
  version: number;
  name: string;
  checksum: string;
  applied_at: string;
};

const MIGRATION_LOCK_KEY = 20260805;
const SCHEMA_MIGRATIONS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version integer PRIMARY KEY,
    name text NOT NULL,
    checksum text NOT NULL,
    applied_at timestamptz NOT NULL DEFAULT now()
  )
`;

const defaultMigrationsRoot = fileURLToPath(
  new URL('../../database/migrations', import.meta.url),
);

function isSchemaMigrationsTablePresent(client: PoolClient) {
  return client.query<{ exists: boolean }>(`
    SELECT to_regclass('public.schema_migrations') IS NOT NULL AS exists
  `);
}

async function loadAppliedMigrations(
  client: PoolClient,
): Promise<AppliedMigrationRow[]> {
  const tablePresent = await isSchemaMigrationsTablePresent(client);

  if (!tablePresent.rows[0]?.exists) {
    return [];
  }

  const result = await client.query<AppliedMigrationRow>(`
    SELECT version, name, checksum, applied_at
    FROM schema_migrations
    ORDER BY version ASC
  `);

  return result.rows;
}

function validateAppliedMigrations(
  catalog: MigrationDefinition[],
  appliedMigrations: AppliedMigrationRow[],
) {
  const catalogByVersion = new Map(
    catalog.map((migration) => [migration.version, migration] as const),
  );

  for (const appliedMigration of appliedMigrations) {
    const migration = catalogByVersion.get(appliedMigration.version);

    if (!migration) {
      throw new Error(
        `Applied migration ${appliedMigration.version} (${appliedMigration.name}) is missing from the migration files.`,
      );
    }

    assertMigrationChecksumMatches(appliedMigration, migration);
  }
}

function printMigrationStatus(
  catalog: MigrationDefinition[],
  appliedMigrations: AppliedMigrationRow[],
) {
  const appliedByVersion = new Map(
    appliedMigrations.map(
      (migration) => [migration.version, migration] as const,
    ),
  );
  const applied = catalog.filter((migration) =>
    appliedByVersion.has(migration.version),
  );
  const pending = catalog.filter(
    (migration) => !appliedByVersion.has(migration.version),
  );

  console.log('Applied migrations:');
  if (applied.length === 0) {
    console.log('- (none)');
  } else {
    for (const migration of applied) {
      const row = appliedByVersion.get(migration.version);
      console.log(
        `- ${formatMigrationLabel(migration)} (${row?.applied_at ?? 'unknown'})`,
      );
    }
  }

  console.log('Pending migrations:');
  if (pending.length === 0) {
    console.log('- (none)');
  } else {
    for (const migration of pending) {
      console.log(`- ${formatMigrationLabel(migration)}`);
    }
  }
}

async function runInTransaction(
  client: PoolClient,
  work: () => Promise<void>,
): Promise<void> {
  await client.query('BEGIN');

  try {
    await work();
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function ensureMigrationsTable(client: PoolClient) {
  await client.query(SCHEMA_MIGRATIONS_TABLE_SQL);
}

async function applyPendingMigrations(
  client: PoolClient,
  catalog: MigrationDefinition[],
  appliedMigrations: AppliedMigrationRow[],
) {
  const appliedVersions = new Map(
    appliedMigrations.map(
      (migration) => [migration.version, migration] as const,
    ),
  );

  for (const migration of catalog) {
    const appliedMigration = appliedVersions.get(migration.version);

    if (appliedMigration) {
      assertMigrationChecksumMatches(appliedMigration, migration);
      continue;
    }

    await runInTransaction(client, async () => {
      await client.query(migration.up.sql);
      await client.query(
        `
          INSERT INTO schema_migrations (version, name, checksum)
          VALUES ($1, $2, $3)
        `,
        [migration.version, migration.name, migration.checksum],
      );
    });

    console.log(`Applied ${formatMigrationLabel(migration)}`);
  }
}

async function rollbackLatestMigration(
  client: PoolClient,
  catalog: MigrationDefinition[],
  appliedMigrations: AppliedMigrationRow[],
) {
  const latestAppliedMigration = appliedMigrations.at(-1);

  if (!latestAppliedMigration) {
    console.log('No applied migrations to roll back.');
    return;
  }

  const migration = catalog.find(
    (item) => item.version === latestAppliedMigration.version,
  );

  if (!migration) {
    throw new Error(
      `Applied migration ${latestAppliedMigration.version} (${latestAppliedMigration.name}) is missing from the migration files.`,
    );
  }

  assertMigrationChecksumMatches(latestAppliedMigration, migration);

  await runInTransaction(client, async () => {
    await client.query(migration.down.sql);
    await client.query('DELETE FROM schema_migrations WHERE version = $1', [
      migration.version,
    ]);
  });

  console.log(`Rolled back ${formatMigrationLabel(migration)}`);
}

async function withMigrationClient<T>(
  command: MigrationCommand,
  task: (client: PoolClient, catalog: MigrationDefinition[]) => Promise<T>,
): Promise<T> {
  const env = loadEnvironment();
  const catalog = await loadMigrationCatalog(defaultMigrationsRoot);
  const pool = createPostgresPool(env.DATABASE_URL);
  let client: PoolClient | null = null;

  try {
    client = await pool.connect();
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_KEY]);

    if (command !== 'status') {
      await ensureMigrationsTable(client);
    }

    return await task(client, catalog);
  } finally {
    if (client) {
      try {
        await client.query('SELECT pg_advisory_unlock($1)', [
          MIGRATION_LOCK_KEY,
        ]);
      } catch {
        // If the connection is already broken, the pool is about to close anyway.
      }

      client.release();
    }

    await pool.end();
  }
}

export async function runMigrationCommand(
  command: MigrationCommand,
): Promise<void> {
  await withMigrationClient(command, async (client, catalog) => {
    const appliedMigrations = await loadAppliedMigrations(client);
    validateAppliedMigrations(catalog, appliedMigrations);

    if (command === 'up') {
      await applyPendingMigrations(client, catalog, appliedMigrations);
      return;
    }

    if (command === 'down') {
      await rollbackLatestMigration(client, catalog, appliedMigrations);
      return;
    }

    printMigrationStatus(catalog, appliedMigrations);
  });
}
