import { describe, expect, it, vi } from 'vitest';
import { createHealthcareFacilityService } from '../src/facilities/service.js';

function createRepositoryMock() {
  return {
    create: vi.fn(),
    list: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
    deactivate: vi.fn(),
  };
}

describe('healthcare facility service', () => {
  it('normalizes create payloads before calling the repository', async () => {
    const repository = createRepositoryMock();
    repository.create.mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      code: 'ABC-001',
      name: 'Alpha Clinic',
      facilityType: 'clinic',
      licenseNumber: null,
      phone: null,
      email: 'alpha@example.org',
      region: 'Addis Ababa',
      city: 'Addis Ababa',
      addressLine: null,
      isActive: true,
      createdAt: '2026-08-05T00:00:00.000Z',
      updatedAt: '2026-08-05T00:00:00.000Z',
    });

    const service = createHealthcareFacilityService(repository);

    await service.createFacility({
      code: '  abc-001  ',
      name: '  Alpha Clinic  ',
      facilityType: 'clinic',
      licenseNumber: '  ',
      phone: '  +251911111111  ',
      email: '  ALPHA@EXAMPLE.ORG  ',
      region: '  Addis Ababa  ',
      city: '  Addis Ababa  ',
      addressLine: '  ',
      isActive: undefined,
    });

    expect(repository.create).toHaveBeenCalledWith({
      code: 'ABC-001',
      name: 'Alpha Clinic',
      facilityType: 'clinic',
      licenseNumber: null,
      phone: '+251911111111',
      email: 'alpha@example.org',
      region: 'Addis Ababa',
      city: 'Addis Ababa',
      addressLine: null,
      isActive: true,
    });
  });

  it('normalizes update payloads before calling the repository', async () => {
    const repository = createRepositoryMock();
    repository.update.mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      code: 'ABC-001',
      name: 'Alpha Clinic Updated',
      facilityType: 'clinic',
      licenseNumber: 'LN-001',
      phone: null,
      email: null,
      region: 'Addis Ababa',
      city: 'Addis Ababa',
      addressLine: null,
      isActive: false,
      createdAt: '2026-08-05T00:00:00.000Z',
      updatedAt: '2026-08-05T00:01:00.000Z',
    });

    const service = createHealthcareFacilityService(repository);

    await service.updateFacility('11111111-1111-4111-8111-111111111111', {
      code: '  abc-001  ',
      name: '  Alpha Clinic Updated  ',
      facilityType: 'clinic',
      licenseNumber: '  LN-001  ',
      phone: '  ',
      email: '  ',
      region: '  Addis Ababa  ',
      city: '  Addis Ababa  ',
      addressLine: '  ',
      isActive: false,
    });

    expect(repository.update).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      {
        code: 'ABC-001',
        name: 'Alpha Clinic Updated',
        facilityType: 'clinic',
        licenseNumber: 'LN-001',
        phone: null,
        email: null,
        region: 'Addis Ababa',
        city: 'Addis Ababa',
        addressLine: null,
        isActive: false,
      },
    );
  });

  it('throws a not found error when a facility is missing', async () => {
    const repository = createRepositoryMock();
    repository.findById.mockResolvedValue(null);
    repository.update.mockResolvedValue(null);
    repository.deactivate.mockResolvedValue(false);

    const service = createHealthcareFacilityService(repository);

    await expect(
      service.getFacilityById('11111111-1111-4111-8111-111111111111'),
    ).rejects.toMatchObject({
      code: 'FACILITY_NOT_FOUND',
      statusCode: 404,
    });

    await expect(
      service.updateFacility('11111111-1111-4111-8111-111111111111', {
        name: 'Alpha',
      }),
    ).rejects.toMatchObject({
      code: 'FACILITY_NOT_FOUND',
      statusCode: 404,
    });

    await expect(
      service.deleteFacility('11111111-1111-4111-8111-111111111111'),
    ).rejects.toMatchObject({
      code: 'FACILITY_NOT_FOUND',
      statusCode: 404,
    });

    expect(repository.findById).toHaveBeenCalledTimes(1);
  });
});
