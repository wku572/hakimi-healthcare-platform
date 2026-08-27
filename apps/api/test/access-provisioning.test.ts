import type { PoolClient } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import {
  createProvisioningService,
  provisioningCommandSchema,
} from '../src/access/provisioning.js';

const ACTOR_ID = '00000000-0000-4000-8000-0000000000a1';
const FACILITY_ID = '00000000-0000-4000-8000-0000000000a2';
const PRACTITIONER_ID = '00000000-0000-4000-8000-0000000000a3';

describe('controlled workforce provisioning', () => {
  it('rejects patient roles, unknown fields, and invalid facility scope shapes', () => {
    expect(() =>
      provisioningCommandSchema.parse({
        action: 'ASSIGN_ROLE',
        actorId: ACTOR_ID,
        role: 'PATIENT',
      }),
    ).toThrow();
    expect(() =>
      provisioningCommandSchema.parse({
        action: 'ASSIGN_ROLE',
        actorId: ACTOR_ID,
        role: 'PLATFORM_ADMIN',
        facilityId: FACILITY_ID,
      }),
    ).toThrow();
    expect(() =>
      provisioningCommandSchema.parse({
        action: 'REVOKE_SESSIONS',
        actorId: ACTOR_ID,
        suppliedAuthority: 'PLATFORM_ADMIN',
      }),
    ).toThrow();
  });

  it('accepts only strict target-specific revocation recovery actions', () => {
    expect(
      provisioningCommandSchema.parse({
        action: 'REVOKE_FACILITY_SESSIONS',
        facilityId: FACILITY_ID,
      }),
    ).toEqual({
      action: 'REVOKE_FACILITY_SESSIONS',
      facilityId: FACILITY_ID,
    });
    expect(
      provisioningCommandSchema.parse({
        action: 'REVOKE_PRACTITIONER_SESSIONS',
        practitionerId: PRACTITIONER_ID,
      }),
    ).toEqual({
      action: 'REVOKE_PRACTITIONER_SESSIONS',
      practitionerId: PRACTITIONER_ID,
    });
    expect(
      provisioningCommandSchema.parse({
        action: 'REVOKE_ASSIGNMENT_SESSIONS',
        assignmentId: PRACTITIONER_ID,
      }),
    ).toEqual({
      action: 'REVOKE_ASSIGNMENT_SESSIONS',
      assignmentId: PRACTITIONER_ID,
    });

    expect(() =>
      provisioningCommandSchema.parse({
        action: 'REVOKE_FACILITY_SESSIONS',
        facilityId: FACILITY_ID,
        oidcSubject: 'prohibited',
      }),
    ).toThrow();
  });

  it('rolls back and releases the database client on every failure path', async () => {
    const query = vi
      .fn<PoolClient['query']>()
      .mockResolvedValueOnce({ rows: [], rowCount: null } as never)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as never)
      .mockResolvedValueOnce({ rows: [], rowCount: null } as never);
    const release = vi.fn();
    const pool = {
      connect: vi.fn().mockResolvedValue({ query, release }),
    };
    const provision = createProvisioningService(pool);

    await expect(
      provision(
        provisioningCommandSchema.parse({
          action: 'ACTIVATE_ACTOR',
          actorId: ACTOR_ID,
        }),
      ),
    ).rejects.toThrow('PROVISIONING_TARGET_NOT_FOUND');

    expect(query).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(query).toHaveBeenLastCalledWith('ROLLBACK');
    expect(release).toHaveBeenCalledOnce();
  });
});
