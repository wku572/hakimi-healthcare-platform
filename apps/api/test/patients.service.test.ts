import { describe, expect, it, vi } from 'vitest';
import { createPatientService } from '../src/patients/service.js';

function createRepositoryMock() {
  return {
    withTransaction: vi.fn(),
    createPatient: vi.fn(),
    updatePatient: vi.fn(),
    deletePatient: vi.fn(),
    findPatientById: vi.fn(),
    listPatients: vi.fn(),
    findRegistrationsByPatientId: vi.fn(),
    findRegistrationsByPatientIds: vi.fn(),
    createPatientRegistration: vi.fn(),
    getFacilityStatus: vi.fn(),
  };
}

const patientId = '11111111-1111-4111-8111-111111111111';
const facilityId = '22222222-2222-4222-8222-222222222222';
const registrationId = '33333333-3333-4333-8333-333333333333';

const patientRow = {
  id: patientId,
  first_name: 'Mekdes',
  middle_name: null,
  last_name: 'Tadesse',
  date_of_birth: '1995-01-01',
  administrative_sex: 'female',
  phone: '+251911111111',
  email: 'mekdes@example.org',
  address_line: null,
  city: 'Addis Ababa',
  region: 'Addis Ababa',
  is_active: true,
  created_at: '2026-08-05T00:00:00.000Z',
  updated_at: '2026-08-05T00:00:00.000Z',
};

const registration = {
  id: registrationId,
  patientId,
  facilityId,
  medicalRecordNumber: 'MRN-001',
  createdAt: '2026-08-05T00:00:00.000Z',
  updatedAt: '2026-08-05T00:00:00.000Z',
  facility: {
    id: facilityId,
    code: 'FAC-001',
    name: 'Sunrise Clinic',
    facilityType: 'clinic' as const,
    region: 'Addis Ababa',
    city: 'Addis Ababa',
    isActive: true,
  },
};

describe('patient service', () => {
  it('normalizes create payloads before calling the repository', async () => {
    const repository = createRepositoryMock();
    const tx = { query: vi.fn() };
    repository.withTransaction.mockImplementation(async (work) => work(tx));
    repository.getFacilityStatus.mockResolvedValue({
      id: facilityId,
      is_active: true,
    });
    repository.createPatient.mockResolvedValue(patientRow);
    repository.createPatientRegistration.mockResolvedValue(registration);
    repository.findRegistrationsByPatientId.mockResolvedValue([registration]);

    const service = createPatientService(repository);
    const createInput = {
      facilityId,
      medicalRecordNumber: '  MRN-001  ',
      firstName: '  Mekdes  ',
      middleName: '  ',
      lastName: '  Tadesse  ',
      dateOfBirth: '1995-01-01',
      administrativeSex: ' female ',
      phone: '  +251911111111  ',
      email: '  MEKDES@EXAMPLE.ORG  ',
      addressLine: '  ',
      city: '  Addis Ababa  ',
      region: '  Addis Ababa  ',
    } as unknown as Parameters<typeof service.createPatient>[0];

    await service.createPatient(createInput);

    expect(repository.getFacilityStatus).toHaveBeenCalledWith(facilityId, tx);
    expect(repository.createPatient).toHaveBeenCalledWith(
      {
        facilityId,
        medicalRecordNumber: 'MRN-001',
        firstName: 'Mekdes',
        middleName: null,
        lastName: 'Tadesse',
        dateOfBirth: '1995-01-01',
        administrativeSex: 'female',
        phone: '+251911111111',
        email: 'mekdes@example.org',
        addressLine: null,
        city: 'Addis Ababa',
        region: 'Addis Ababa',
      },
      tx,
    );
    expect(repository.createPatientRegistration).toHaveBeenCalledWith(
      {
        patientId,
        facilityId,
        medicalRecordNumber: 'MRN-001',
      },
      tx,
    );
  });

  it('rejects missing and inactive facilities before creating a patient', async () => {
    const repository = createRepositoryMock();
    const tx = { query: vi.fn() };
    repository.withTransaction.mockImplementation(async (work) => work(tx));
    repository.getFacilityStatus.mockResolvedValueOnce(null);
    repository.getFacilityStatus.mockResolvedValueOnce({
      id: facilityId,
      is_active: false,
    });

    const service = createPatientService(repository);

    await expect(
      service.createPatient({
        facilityId,
        medicalRecordNumber: 'MRN-001',
        firstName: 'Mekdes',
        administrativeSex: 'female',
      }),
    ).rejects.toMatchObject({
      code: 'FACILITY_NOT_FOUND',
      statusCode: 404,
    });

    await expect(
      service.createPatient({
        facilityId,
        medicalRecordNumber: 'MRN-002',
        firstName: 'Mekdes',
        administrativeSex: 'female',
      }),
    ).rejects.toMatchObject({
      code: 'FACILITY_INACTIVE',
      statusCode: 409,
    });

    expect(repository.createPatient).not.toHaveBeenCalled();
  });

  it('lists patients with nested registrations', async () => {
    const repository = createRepositoryMock();
    repository.listPatients.mockResolvedValue({
      rows: [patientRow],
      pagination: {
        page: 1,
        pageSize: 20,
        totalItems: 1,
        totalPages: 1,
      },
    });
    repository.findRegistrationsByPatientIds.mockResolvedValue(
      new Map([[patientId, [registration]]]),
    );

    const service = createPatientService(repository);
    const response = await service.listPatients({
      page: 1,
      pageSize: 20,
    });

    expect(response).toEqual({
      data: [
        {
          id: patientId,
          firstName: 'Mekdes',
          middleName: null,
          lastName: 'Tadesse',
          dateOfBirth: '1995-01-01',
          administrativeSex: 'female',
          phone: '+251911111111',
          email: 'mekdes@example.org',
          addressLine: null,
          city: 'Addis Ababa',
          region: 'Addis Ababa',
          isActive: true,
          createdAt: '2026-08-05T00:00:00.000Z',
          updatedAt: '2026-08-05T00:00:00.000Z',
          registrations: [registration],
        },
      ],
      pagination: {
        page: 1,
        pageSize: 20,
        totalItems: 1,
        totalPages: 1,
      },
    });
  });

  it('normalizes update payloads before calling the repository', async () => {
    const repository = createRepositoryMock();
    repository.updatePatient.mockResolvedValue({
      ...patientRow,
      first_name: 'Mekdes Updated',
      email: 'mekdes.updated@example.org',
      updated_at: '2026-08-05T00:01:00.000Z',
    });
    repository.findRegistrationsByPatientId.mockResolvedValue([registration]);

    const service = createPatientService(repository);

    await service.updatePatient(patientId, {
      firstName: '  Mekdes Updated  ',
      email: '  MEKDES.UPDATED@EXAMPLE.ORG  ',
      isActive: false,
    });

    expect(repository.updatePatient).toHaveBeenCalledWith(patientId, {
      firstName: 'Mekdes Updated',
      email: 'mekdes.updated@example.org',
      isActive: false,
    });
  });

  it('throws a not found error when a patient is missing', async () => {
    const repository = createRepositoryMock();
    repository.findPatientById.mockResolvedValue(null);
    repository.updatePatient.mockResolvedValue(null);
    repository.deletePatient.mockResolvedValue(false);

    const service = createPatientService(repository);

    await expect(service.getPatientById(patientId)).rejects.toMatchObject({
      code: 'PATIENT_NOT_FOUND',
      statusCode: 404,
    });

    await expect(
      service.updatePatient(patientId, {
        firstName: 'Mekdes',
      }),
    ).rejects.toMatchObject({
      code: 'PATIENT_NOT_FOUND',
      statusCode: 404,
    });

    await expect(service.deletePatient(patientId)).rejects.toMatchObject({
      code: 'PATIENT_NOT_FOUND',
      statusCode: 404,
    });
  });
});
