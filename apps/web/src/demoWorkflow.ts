import type {
  Appointment,
  AppointmentPatientSummary,
  AppointmentPractitionerSummary,
} from '@hakimi/shared';
import type {
  SyntheticAppointmentSlot,
  SyntheticDemoData,
} from './demoDataAdapter';

export type DemoAppointment = Appointment & {
  reason: string;
  reminderStatus: SyntheticAppointmentSlot['reminderStatus'];
};

export type DemoState = {
  selectedPatientId: string;
  selectedPractitionerId: string;
  selectedSlotId: string;
  scheduledAppointment: DemoAppointment | null;
  announcement: string;
};

export type DemoSelection = {
  patient: AppointmentPatientSummary;
  practitioner: AppointmentPractitionerSummary;
  slot: SyntheticAppointmentSlot;
};

export function createInitialDemoState(data: SyntheticDemoData): DemoState {
  const firstPatient = data.patients[0];
  const firstPractitioner = data.practitioners[0];

  if (!firstPatient || !firstPractitioner) {
    throw new Error(
      'Synthetic demo data must include one patient, practitioner, and slot.',
    );
  }

  const firstSlot = data.slots.find(
    (slot) => slot.practitionerId === firstPractitioner.id,
  );

  if (!firstSlot) {
    throw new Error(
      'Synthetic demo data must include one patient, practitioner, and slot.',
    );
  }

  return {
    selectedPatientId: firstPatient.id,
    selectedPractitionerId: firstPractitioner.id,
    selectedSlotId: firstSlot.id,
    scheduledAppointment: null,
    announcement: 'Synthetic appointment demo loaded.',
  };
}

export function selectPatient(state: DemoState, patientId: string): DemoState {
  return {
    ...state,
    selectedPatientId: patientId,
    scheduledAppointment: null,
    announcement:
      'Synthetic patient selected. Review the available appointment details.',
  };
}

export function selectPractitioner(
  data: SyntheticDemoData,
  state: DemoState,
  practitionerId: string,
): DemoState {
  const firstSlot = data.slots.find(
    (slot) => slot.practitionerId === practitionerId,
  );

  return {
    ...state,
    selectedPractitionerId: practitionerId,
    selectedSlotId: firstSlot?.id ?? '',
    scheduledAppointment: null,
    announcement:
      'Synthetic practitioner selected. Choose an available time slot.',
  };
}

export function selectSlot(state: DemoState, slotId: string): DemoState {
  return {
    ...state,
    selectedSlotId: slotId,
    scheduledAppointment: null,
    announcement:
      'Synthetic appointment slot selected. Review and schedule when ready.',
  };
}

export function getCurrentSelection(
  data: SyntheticDemoData,
  state: DemoState,
): DemoSelection {
  const patient = data.patients.find(
    (candidate) => candidate.id === state.selectedPatientId,
  );
  const practitioner = data.practitioners.find(
    (candidate) => candidate.id === state.selectedPractitionerId,
  );
  const slot = data.slots.find(
    (candidate) => candidate.id === state.selectedSlotId,
  );

  if (!patient || !practitioner || !slot) {
    throw new Error('Synthetic demo selection is incomplete.');
  }

  return {
    patient,
    practitioner,
    slot,
  };
}

export function scheduleSelectedAppointment(
  data: SyntheticDemoData,
  state: DemoState,
): DemoState {
  const selection = getCurrentSelection(data, state);
  const now = '2026-09-15T09:00:00+03:00';
  const scheduledAppointment: DemoAppointment = {
    id: `demo-appointment-${selection.slot.id}`,
    patientId: selection.patient.id,
    practitionerId: selection.practitioner.id,
    facilityId: data.facility.id,
    scheduledStart: selection.slot.scheduledStart,
    scheduledEnd: selection.slot.scheduledEnd,
    status: 'SCHEDULED',
    cancellationReason: null,
    cancelledAt: null,
    createdAt: now,
    updatedAt: now,
    patient: selection.patient,
    practitioner: selection.practitioner,
    facility: data.facility,
    reason: selection.slot.reason,
    reminderStatus: selection.slot.reminderStatus,
  };

  return {
    ...state,
    scheduledAppointment,
    announcement:
      'Synthetic appointment scheduled for this demo session only. Reminder status is queued in demo state.',
  };
}

export function getAvailableSlots(
  data: SyntheticDemoData,
  practitionerId: string,
) {
  return data.slots.filter((slot) => slot.practitionerId === practitionerId);
}

export function formatPersonName(person: {
  firstName: string;
  middleName?: string | null;
  lastName: string | null;
}) {
  return [person.firstName, person.middleName, person.lastName]
    .filter(Boolean)
    .join(' ');
}
