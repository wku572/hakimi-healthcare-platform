import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const MIGRATION_FILENAME_PATTERN = /^(\d+)_([a-z0-9_]+)\.sql$/;

export type MigrationFileInput = {
  filename: string;
  sql: string;
};

export type ParsedMigrationFilename = {
  version: number;
  versionLabel: string;
  name: string;
};

export type MigrationDefinition = {
  version: number;
  versionLabel: string;
  name: string;
  checksum: string;
  up: MigrationFileInput;
  down: MigrationFileInput;
};

export function parseMigrationFilename(
  filename: string,
): ParsedMigrationFilename {
  const match = MIGRATION_FILENAME_PATTERN.exec(filename);

  if (!match) {
    throw new Error(
      `Invalid migration filename "${filename}". Expected a numeric prefix and a name, for example 001_create_healthcare_facilities.sql.`,
    );
  }

  const versionLabel = match[1];
  const name = match[2];

  if (!versionLabel || !name) {
    throw new Error(
      `Invalid migration filename "${filename}". Expected a numeric prefix and a name, for example 001_create_healthcare_facilities.sql.`,
    );
  }

  const version = Number.parseInt(versionLabel, 10);

  if (!Number.isInteger(version) || version < 1) {
    throw new Error(
      `Invalid migration version "${versionLabel}" in "${filename}".`,
    );
  }

  return {
    version,
    versionLabel,
    name,
  };
}

export function computeMigrationChecksum(sql: string): string {
  return createHash('sha256').update(sql, 'utf8').digest('hex');
}

function indexFilesByVersion(
  files: MigrationFileInput[],
  direction: 'up' | 'down',
): Map<number, ParsedMigrationFilename & MigrationFileInput> {
  const indexed = new Map<
    number,
    ParsedMigrationFilename & MigrationFileInput
  >();

  for (const file of files) {
    const parsed = parseMigrationFilename(file.filename);

    if (indexed.has(parsed.version)) {
      const existing = indexed.get(parsed.version);
      throw new Error(
        `Duplicate migration version ${parsed.versionLabel} found in ${existing?.filename ?? 'unknown'} and ${file.filename} for the ${direction} migrations.`,
      );
    }

    indexed.set(parsed.version, {
      ...parsed,
      ...file,
    });
  }

  return indexed;
}

export function buildMigrationCatalogFromFiles(
  upFiles: MigrationFileInput[],
  downFiles: MigrationFileInput[],
): MigrationDefinition[] {
  const upByVersion = indexFilesByVersion(upFiles, 'up');
  const downByVersion = indexFilesByVersion(downFiles, 'down');
  const versions = new Set<number>([
    ...upByVersion.keys(),
    ...downByVersion.keys(),
  ]);

  const migrations = Array.from(versions)
    .sort((left, right) => left - right)
    .map((version) => {
      const up = upByVersion.get(version);
      const down = downByVersion.get(version);

      if (!up || !down) {
        const missingDirection = up ? 'down' : 'up';
        const presentFile = up ?? down;
        throw new Error(
          `Migration version ${presentFile?.versionLabel ?? String(version)} (${presentFile?.name ?? 'unknown'}) is missing a matching ${missingDirection} migration file.`,
        );
      }

      if (up.name !== down.name) {
        throw new Error(
          `Migration version ${up.versionLabel} has mismatched names between up and down files: "${up.filename}" and "${down.filename}".`,
        );
      }

      return {
        version: up.version,
        versionLabel: up.versionLabel,
        name: up.name,
        checksum: computeMigrationChecksum(up.sql),
        up: {
          filename: up.filename,
          sql: up.sql,
        },
        down: {
          filename: down.filename,
          sql: down.sql,
        },
      };
    });

  return migrations;
}

async function readMigrationFiles(
  directory: string,
): Promise<MigrationFileInput[]> {
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isFile()) {
      throw new Error(
        `Unexpected non-file entry "${entry.name}" found in ${directory}.`,
      );
    }
  }

  const files = await Promise.all(
    entries.map(async (entry) => ({
      filename: entry.name,
      sql: await readFile(join(directory, entry.name), 'utf8'),
    })),
  );

  return files;
}

export async function loadMigrationCatalog(
  migrationsRoot: string,
): Promise<MigrationDefinition[]> {
  const [upFiles, downFiles] = await Promise.all([
    readMigrationFiles(join(migrationsRoot, 'up')),
    readMigrationFiles(join(migrationsRoot, 'down')),
  ]);

  return buildMigrationCatalogFromFiles(upFiles, downFiles);
}

export function assertMigrationChecksumMatches(
  applied: Pick<MigrationDefinition, 'version' | 'name' | 'checksum'> & {
    versionLabel?: string;
  },
  migration: MigrationDefinition,
) {
  if (
    applied.version !== migration.version ||
    applied.name !== migration.name
  ) {
    throw new Error(
      `Applied migration ${applied.versionLabel ?? String(applied.version)} (${applied.name}) does not match the migration file ${migration.versionLabel} (${migration.name}).`,
    );
  }

  if (applied.checksum !== migration.checksum) {
    throw new Error(
      `Applied migration ${migration.versionLabel} (${migration.name}) checksum does not match the current file contents. Create a new migration instead of editing an applied one.`,
    );
  }
}

export function formatMigrationLabel(
  migration: Pick<MigrationDefinition, 'versionLabel' | 'name'>,
) {
  return `${migration.versionLabel}_${migration.name}`;
}
