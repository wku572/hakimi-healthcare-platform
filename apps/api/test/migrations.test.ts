import { describe, expect, it } from 'vitest';
import {
  assertMigrationChecksumMatches,
  buildMigrationCatalogFromFiles,
  computeMigrationChecksum,
  parseMigrationFilename,
} from '../src/migrations/catalog.js';

describe('migration catalog', () => {
  it('orders migration files by numeric version', () => {
    const catalog = buildMigrationCatalogFromFiles(
      [
        {
          filename: '003_create_patients_and_registrations.sql',
          sql: '-- up 3',
        },
        { filename: '002_add_locations.sql', sql: '-- up 2' },
        { filename: '001_create_healthcare_facilities.sql', sql: '-- up 1' },
      ],
      [
        {
          filename: '003_create_patients_and_registrations.sql',
          sql: '-- down 3',
        },
        { filename: '001_create_healthcare_facilities.sql', sql: '-- down 1' },
        { filename: '002_add_locations.sql', sql: '-- down 2' },
      ],
    );

    expect(catalog.map((migration) => migration.versionLabel)).toEqual([
      '001',
      '002',
      '003',
    ]);
  });

  it('rejects duplicate migration versions', () => {
    expect(() =>
      buildMigrationCatalogFromFiles(
        [
          { filename: '001_create_healthcare_facilities.sql', sql: '-- up 1' },
          { filename: '001_add_facility_notes.sql', sql: '-- duplicate up' },
        ],
        [
          {
            filename: '001_create_healthcare_facilities.sql',
            sql: '-- down 1',
          },
        ],
      ),
    ).toThrow(/Duplicate migration version 001/i);
  });

  it('rejects malformed filenames', () => {
    expect(() =>
      parseMigrationFilename('create_healthcare_facilities.sql'),
    ).toThrow(/Invalid migration filename/i);
  });

  it('detects checksum mismatches', () => {
    const checksum = computeMigrationChecksum('SELECT 1;');

    expect(checksum).toHaveLength(64);

    expect(() =>
      assertMigrationChecksumMatches(
        {
          version: 1,
          versionLabel: '001',
          name: 'create_healthcare_facilities',
          checksum: 'deadbeef',
        },
        {
          version: 1,
          versionLabel: '001',
          name: 'create_healthcare_facilities',
          checksum,
          up: {
            filename: '001_create_healthcare_facilities.sql',
            sql: 'SELECT 1;',
          },
          down: {
            filename: '001_create_healthcare_facilities.sql',
            sql: 'DROP TABLE x;',
          },
        },
      ),
    ).toThrow(/checksum/i);
  });
});
