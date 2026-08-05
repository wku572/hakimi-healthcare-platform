import { describe, expect, it, vi } from 'vitest';
import { createPractitionerService } from '../src/practitioners/service.js';

function createRepositoryMock() {
  return {
    createPractitioner: vi.fn(),
    listPractitioners: vi.fn(),
    findPractitionerById: vi.fn(),
    updatePractitioner: vi.fn(),
    deletePractitioner: vi.fn(),
    withTransaction: vi.fn(),
    createAssignment: vi.fn(),
    listAssignments: vi.fn(),
    findAssignmentById: vi.fn(),
    updateAssignment: vi.fn(),
    deleteAssignment: vi.fn(),
    lockPractitionerAssignments: vi.fn(),
    clearPrimaryAssignments: vi.fn(),
    getPractitionerStatus: vi.fn(),
    getFacilityStatus: vi.fn(),
  };
}

describe('practitioner service', () => {
  it('normalizes create payloads before calling the repository', async () => {
    const repository = createRepositoryMock();
    repository.createPractitioner.mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      code: 'PRAC-001',
      firstName: 'Mekdes',
      middleName: null,
      lastName: 'Tadesse',
      profession: 'general practitioner',
      licenseNumber: 'MED-001',
      phone: null,
      email: 'mekdes@example.org',
      bio: null,
      isActive: true,
      createdAt: '2026-08-05T00:00:00.000Z',
      updatedAt: '2026-08-05T00:00:00.000Z',
    });

    const service = createPractitionerService(repository);

    await service.createPractitioner({
      code: '  prac-001  ',
      firstName: '  Mekdes  ',
      middleName: '  ',
      lastName: '  Tadesse  ',
      profession: '  general practitioner  ',
      licenseNumber: '  MED-001  ',
      phone: '  +251911111111  ',
      email: '  MEKDES@EXAMPLE.ORG  ',
      bio: '  ',
      isActive: undefined,
    });

    expect(repository.createPractitioner).toHaveBeenCalledWith({
      code: 'PRAC-001',
      firstName: 'Mekdes',
      middleName: null,
      lastName: 'Tadesse',
      profession: 'general practitioner',
      licenseNumber: 'MED-001',
      phone: '+251911111111',
      email: 'mekdes@example.org',
      bio: null,
      isActive: true,
    });
  });

  it('normalizes update payloads before calling the repository', async () => {
    const repository = createRepositoryMock();
    repository.updatePractitioner.mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      code: 'PRAC-001',
      firstName: 'Mekdes Updated',
      middleName: null,
      lastName: 'Tadesse',
      profession: 'general practitioner',
      licenseNumber: 'MED-001',
      phone: null,
      email: 'mekdes.updated@example.org',
      bio: null,
      isActive: true,
      createdAt: '2026-08-05T00:00:00.000Z',
      updatedAt: '2026-08-05T00:01:00.000Z',
    });

    const service = createPractitionerService(repository);

    await service.updatePractitioner('11111111-1111-4111-8111-111111111111', {
      code: '  prac-001  ',
      firstName: '  Mekdes Updated  ',
      email: '  MEKDES.UPDATED@EXAMPLE.ORG  ',
      bio: '  ',
    });

    expect(repository.updatePractitioner).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      {
        code: 'PRAC-001',
        firstName: 'Mekdes Updated',
        email: 'mekdes.updated@example.org',
        bio: null,
      },
    );
  });

  it('rejects inactive practitioners and facilities when creating active assignments', async () => {
    const repository = createRepositoryMock();
    const tx = { query: vi.fn() };
    repository.withTransaction.mockImplementation(async (work) => work(tx));
    repository.lockPractitionerAssignments.mockResolvedValue(undefined);
    repository.getPractitionerStatus.mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      is_active: false,
    });
    repository.getFacilityStatus.mockResolvedValue({
      id: '33333333-3333-4333-8333-333333333333',
      is_active: true,
    });

    const service = createPractitionerService(repository);

    await expect(
      service.createAssignment('11111111-1111-4111-8111-111111111111', {
        facilityId: '33333333-3333-4333-8333-333333333333',
        roleTitle: '  Physician  ',
      }),
    ).rejects.toMatchObject({
      code: 'INACTIVE_PRACTITIONER',
      statusCode: 409,
    });

    repository.getPractitionerStatus.mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      is_active: true,
    });
    repository.getFacilityStatus.mockResolvedValue({
      id: '33333333-3333-4333-8333-333333333333',
      is_active: false,
    });

    await expect(
      service.createAssignment('11111111-1111-4111-8111-111111111111', {
        facilityId: '33333333-3333-4333-8333-333333333333',
        roleTitle: '  Physician  ',
      }),
    ).rejects.toMatchObject({
      code: 'INACTIVE_FACILITY',
      statusCode: 409,
    });
  });

  it('clears the previous primary assignment before creating a new primary assignment', async () => {
    const repository = createRepositoryMock();
    const tx = { query: vi.fn() };
    repository.withTransaction.mockImplementation(async (work) => work(tx));
    repository.lockPractitionerAssignments.mockResolvedValue(undefined);
    repository.getPractitionerStatus.mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      is_active: true,
    });
    repository.getFacilityStatus.mockResolvedValue({
      id: '33333333-3333-4333-8333-333333333333',
      is_active: true,
    });
    repository.clearPrimaryAssignments.mockResolvedValue(undefined);
    repository.createAssignment.mockResolvedValue({
      id: '22222222-2222-4222-8222-222222222222',
      practitionerId: '11111111-1111-4111-8111-111111111111',
      facilityId: '33333333-3333-4333-8333-333333333333',
      roleTitle: 'Physician',
      department: null,
      isPrimary: true,
      isActive: true,
      createdAt: '2026-08-05T00:00:00.000Z',
      updatedAt: '2026-08-05T00:00:00.000Z',
      facility: {
        id: '33333333-3333-4333-8333-333333333333',
        code: 'FAC-001',
        name: 'Sunrise Clinic',
        facilityType: 'clinic',
        region: 'Addis Ababa',
        city: 'Addis Ababa',
        isActive: true,
      },
    });

    const service = createPractitionerService(repository);

    await service.createAssignment('11111111-1111-4111-8111-111111111111', {
      facilityId: '33333333-3333-4333-8333-333333333333',
      roleTitle: '  Physician  ',
      isPrimary: true,
    });

    expect(repository.lockPractitionerAssignments).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      tx,
    );
    expect(repository.clearPrimaryAssignments).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      tx,
    );
    expect(repository.createAssignment).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      {
        facilityId: '33333333-3333-4333-8333-333333333333',
        roleTitle: 'Physician',
        department: undefined,
        isPrimary: true,
        isActive: true,
      },
      tx,
    );
  });

  it('reassigns the primary assignment atomically during update', async () => {
    const repository = createRepositoryMock();
    const tx = { query: vi.fn() };
    repository.withTransaction.mockImplementation(async (work) => work(tx));
    repository.lockPractitionerAssignments.mockResolvedValue(undefined);
    repository.getPractitionerStatus.mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      is_active: true,
    });
    repository.getFacilityStatus.mockResolvedValue({
      id: '33333333-3333-4333-8333-333333333333',
      is_active: true,
    });
    repository.findAssignmentById.mockResolvedValue({
      id: '22222222-2222-4222-8222-222222222222',
      practitionerId: '11111111-1111-4111-8111-111111111111',
      facilityId: '33333333-3333-4333-8333-333333333333',
      roleTitle: 'Physician',
      department: null,
      isPrimary: false,
      isActive: true,
      createdAt: '2026-08-05T00:00:00.000Z',
      updatedAt: '2026-08-05T00:00:00.000Z',
      facility: {
        id: '33333333-3333-4333-8333-333333333333',
        code: 'FAC-001',
        name: 'Sunrise Clinic',
        facilityType: 'clinic',
        region: 'Addis Ababa',
        city: 'Addis Ababa',
        isActive: true,
      },
    });
    repository.clearPrimaryAssignments.mockResolvedValue(undefined);
    repository.updateAssignment.mockResolvedValue({
      id: '22222222-2222-4222-8222-222222222222',
      practitionerId: '11111111-1111-4111-8111-111111111111',
      facilityId: '33333333-3333-4333-8333-333333333333',
      roleTitle: 'Lead Physician',
      department: null,
      isPrimary: true,
      isActive: true,
      createdAt: '2026-08-05T00:00:00.000Z',
      updatedAt: '2026-08-05T00:01:00.000Z',
      facility: {
        id: '33333333-3333-4333-8333-333333333333',
        code: 'FAC-001',
        name: 'Sunrise Clinic',
        facilityType: 'clinic',
        region: 'Addis Ababa',
        city: 'Addis Ababa',
        isActive: true,
      },
    });

    const service = createPractitionerService(repository);

    await service.updateAssignment(
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
      {
        roleTitle: '  Lead Physician  ',
        isPrimary: true,
      },
    );

    expect(repository.clearPrimaryAssignments).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      tx,
      '22222222-2222-4222-8222-222222222222',
    );
    expect(repository.updateAssignment).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
      {
        roleTitle: 'Lead Physician',
        isPrimary: true,
        isActive: true,
      },
      tx,
    );
  });
});
