import { describe, expect, it } from 'vitest';
import {
  branding,
  demoBoundaryMessages,
  demoConfirmation,
  demoDisclaimer,
} from './demoContent';
import { localSyntheticDemoAdapter } from './demoDataAdapter';
import {
  createInitialDemoState,
  getAvailableSlots,
  scheduleSelectedAppointment,
  selectPatient,
  selectPractitioner,
  selectSlot,
} from './demoWorkflow';

function expectDefined<T>(value: T | undefined): asserts value is T {
  expect(value).toBeDefined();
}

describe('synthetic appointment demo', () => {
  it('loads the React client renderer used by the browser entry point', async () => {
    const reactDomClient = await import('react-dom/client');

    expect(reactDomClient.createRoot).toEqual(expect.any(Function));
  });

  it('defines the initial portfolio demo experience', () => {
    const data = localSyntheticDemoAdapter.loadDemoData();

    expect(branding.appName).toBe('Hakimi / ሀኪሜ');
    expect(branding.message).toContain('Synthetic appointment scheduling demo');
    expect(data.facility.name).toBe('Addis Family Clinic');
    expect(data.practitioners).toHaveLength(3);
  });

  it('keeps the synthetic-data and non-production warning available to the UI', () => {
    expect(demoBoundaryMessages).toContain('Synthetic data only');
    expect(demoBoundaryMessages).toContain('Portfolio demonstration');
    expect(demoBoundaryMessages).toContain(
      'Not connected to a production healthcare service',
    );
    expect(demoDisclaimer).toContain(
      'not persisted to the Hakimi API or any database',
    );
  });

  it('supports selecting a patient, practitioner, and appointment slot in demo state', () => {
    const data = localSyntheticDemoAdapter.loadDemoData();
    const practitioner = data.practitioners[1];
    const patient = data.patients[1];
    expectDefined(practitioner);
    expectDefined(patient);
    const slot = getAvailableSlots(data, practitioner.id)[0];
    expectDefined(slot);

    const selectedState = selectSlot(
      selectPractitioner(
        data,
        selectPatient(createInitialDemoState(data), patient.id),
        practitioner.id,
      ),
      slot.id,
    );

    expect(selectedState.selectedPatientId).toBe(patient.id);
    expect(selectedState.selectedPractitionerId).toBe(practitioner.id);
    expect(selectedState.selectedSlotId).toBe(slot.id);
  });

  it('schedules an appointment only in frontend demo state', () => {
    const data = localSyntheticDemoAdapter.loadDemoData();
    const scheduledState = scheduleSelectedAppointment(
      data,
      createInitialDemoState(data),
    );

    expect(scheduledState.scheduledAppointment?.status).toBe('SCHEDULED');
    expect(scheduledState.scheduledAppointment?.facility.name).toBe(
      'Addis Family Clinic',
    );
    expect(scheduledState.announcement).toContain('demo session only');
  });

  it('displays confirmation and reminder status after scheduling', () => {
    const data = localSyntheticDemoAdapter.loadDemoData();
    const scheduledState = scheduleSelectedAppointment(
      data,
      createInitialDemoState(data),
    );

    expect(scheduledState.scheduledAppointment?.reminderStatus).toBe(
      'Queued in demo session',
    );
    expect(demoConfirmation).toContain(
      'No API request was sent and no database record was created.',
    );
  });
});
