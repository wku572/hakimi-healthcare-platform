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
          filename: '006_create_workforce_access_control.sql',
          sql: '-- up 6',
        },
        {
          filename: '005_create_appointment_reminders.sql',
          sql: '-- up 5',
        },
        {
          filename: '004_create_appointments.sql',
          sql: '-- up 4',
        },
        {
          filename: '003_create_patients_and_registrations.sql',
          sql: '-- up 3',
        },
        { filename: '002_add_locations.sql', sql: '-- up 2' },
        { filename: '001_create_healthcare_facilities.sql', sql: '-- up 1' },
      ],
      [
        {
          filename: '006_create_workforce_access_control.sql',
          sql: '-- down 6',
        },
        {
          filename: '004_create_appointments.sql',
          sql: '-- down 4',
        },
        {
          filename: '005_create_appointment_reminders.sql',
          sql: '-- down 5',
        },
        {
          filename: '003_create_patients_and_registrations.sql',
          sql: '-- down 3',
        },
        {
          filename: '002_add_locations.sql',
          sql: '-- down 2',
        },
        { filename: '001_create_healthcare_facilities.sql', sql: '-- down 1' },
      ],
    );

    expect(catalog.map((migration) => migration.versionLabel)).toEqual([
      '001',
      '002',
      '003',
      '004',
      '005',
      '006',
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

  it('defines and rolls back the workforce authority tables in dependency order', () => {
    const migrationDirectory = fileURLToPath(
      new URL('../database/migrations/', import.meta.url),
    );
    const up = readFileSync(
      `${migrationDirectory}/up/006_create_workforce_access_control.sql`,
      'utf8',
    );
    const down = readFileSync(
      `${migrationDirectory}/down/006_create_workforce_access_control.sql`,
      'utf8',
    );

    expect(up).toContain('CREATE TABLE workforce_actors');
    expect(up).toContain('CREATE TABLE workforce_role_assignments');
    expect(up).toContain('CREATE TABLE workforce_sessions');
    expect(up).toContain("'OPERATIONS_OPERATOR'");
    expect(up).not.toContain("'PATIENT'");
    expect(up).toContain('ON DELETE RESTRICT');
    const identifiers = [
      ...up.matchAll(/\bCONSTRAINT\s+([a-z0-9_]+)/g),
      ...up.matchAll(/\bCREATE (?:UNIQUE )?INDEX\s+([a-z0-9_]+)/g),
    ].map((match) => match[1]!);
    expect(identifiers.length).toBeGreaterThan(0);
    expect(
      identifiers.every(
        (identifier) => Buffer.byteLength(identifier, 'utf8') <= 63,
      ),
    ).toBe(true);
    expect(down.indexOf('workforce_sessions')).toBeLessThan(
      down.indexOf('workforce_role_assignments'),
    );
    expect(down.indexOf('workforce_role_assignments')).toBeLessThan(
      down.indexOf('workforce_actors'),
    );
  });
});
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
