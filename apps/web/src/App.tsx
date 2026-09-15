import { useState } from 'react';
import {
  branding,
  demoBoundaryMessages,
  demoConfirmation,
  demoDisclaimer,
} from './demoContent';
import {
  localSyntheticDemoAdapter,
  type SyntheticDemoData,
} from './demoDataAdapter';
import {
  createInitialDemoState,
  formatPersonName,
  getAvailableSlots,
  getCurrentSelection,
  scheduleSelectedAppointment,
  selectPatient,
  selectPractitioner,
  selectSlot,
  type DemoState,
} from './demoWorkflow';

type AppProps = {
  data?: SyntheticDemoData;
  initialState?: DemoState;
};

export default function App({
  data = localSyntheticDemoAdapter.loadDemoData(),
  initialState,
}: AppProps) {
  const [demoState, setDemoState] = useState(
    initialState ?? createInitialDemoState(data),
  );
  const selection = getCurrentSelection(data, demoState);
  const availableSlots = getAvailableSlots(
    data,
    demoState.selectedPractitionerId,
  );
  const dashboardAppointment = demoState.scheduledAppointment;

  return (
    <main className="page-shell">
      <section className="hero" aria-labelledby="demo-title">
        <div className="hero-copy">
          <p className="eyebrow">Synthetic Demo</p>
          <h1 id="demo-title">{branding.appName}</h1>
          <h2>{branding.tagline}</h2>
          <p className="message">{branding.message}</p>
        </div>
        <div className="boundary-card" aria-label="Demo safety boundaries">
          <strong>{demoBoundaryMessages[0]}</strong>
          {demoBoundaryMessages.slice(1).map((message) => (
            <span key={message}>{message}</span>
          ))}
        </div>
      </section>

      <section className="notice" aria-labelledby="notice-title">
        <div>
          <h2 id="notice-title">What this demo does</h2>
          <p>{demoDisclaimer}</p>
        </div>
      </section>

      <div className="demo-grid">
        <section className="workflow-card" aria-labelledby="workflow-title">
          <div className="section-heading">
            <p className="eyebrow">Appointment workflow</p>
            <h2 id="workflow-title">Schedule a fictional visit</h2>
          </div>

          <article className="facility-panel" aria-labelledby="facility-title">
            <p className="step-label">1. View facility</p>
            <h3 id="facility-title">{data.facility.name}</h3>
            <p>
              {data.facility.facilityType.replace('_', ' ')} in{' '}
              {data.facility.city}, {data.facility.region}
            </p>
            <span className="pill">Active synthetic facility</span>
          </article>

          <fieldset className="choice-group">
            <legend>2. View available practitioners</legend>
            <div className="choice-list practitioner-list">
              {data.practitioners.map((practitioner) => (
                <label
                  className="choice-card"
                  key={practitioner.id}
                  htmlFor={`practitioner-${practitioner.id}`}
                >
                  <input
                    checked={
                      demoState.selectedPractitionerId === practitioner.id
                    }
                    id={`practitioner-${practitioner.id}`}
                    name="practitioner"
                    onChange={() =>
                      setDemoState((current) =>
                        selectPractitioner(data, current, practitioner.id),
                      )
                    }
                    type="radio"
                  />
                  <span>
                    <strong>{formatPersonName(practitioner)}</strong>
                    <small>{practitioner.profession}</small>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="choice-group">
            <legend>3. Select a synthetic patient</legend>
            <div className="choice-list">
              {data.patients.map((patient) => (
                <label
                  className="choice-card"
                  key={patient.id}
                  htmlFor={`patient-${patient.id}`}
                >
                  <input
                    checked={demoState.selectedPatientId === patient.id}
                    id={`patient-${patient.id}`}
                    name="patient"
                    onChange={() =>
                      setDemoState((current) =>
                        selectPatient(current, patient.id),
                      )
                    }
                    type="radio"
                  />
                  <span>
                    <strong>{formatPersonName(patient)}</strong>
                    <small>MRN {patient.medicalRecordNumber}</small>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="choice-group">
            <legend>4. Select an appointment slot</legend>
            <div className="choice-list">
              {availableSlots.map((slot) => (
                <label
                  className="choice-card"
                  key={slot.id}
                  htmlFor={`slot-${slot.id}`}
                >
                  <input
                    checked={demoState.selectedSlotId === slot.id}
                    id={`slot-${slot.id}`}
                    name="slot"
                    onChange={() =>
                      setDemoState((current) => selectSlot(current, slot.id))
                    }
                    type="radio"
                  />
                  <span>
                    <strong>{slot.label}</strong>
                    <small>{slot.reason}</small>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <article className="review-panel" aria-labelledby="review-title">
            <p className="step-label">5. Review appointment details</p>
            <h3 id="review-title">Ready to schedule</h3>
            <dl>
              <div>
                <dt>Patient</dt>
                <dd>{formatPersonName(selection.patient)}</dd>
              </div>
              <div>
                <dt>Practitioner</dt>
                <dd>{formatPersonName(selection.practitioner)}</dd>
              </div>
              <div>
                <dt>Time</dt>
                <dd>{selection.slot.label}</dd>
              </div>
              <div>
                <dt>Reason</dt>
                <dd>{selection.slot.reason}</dd>
              </div>
            </dl>
            <button
              className="primary-action"
              onClick={() =>
                setDemoState((current) =>
                  scheduleSelectedAppointment(data, current),
                )
              }
              type="button"
            >
              Schedule synthetic appointment
            </button>
          </article>
        </section>

        <aside className="dashboard" aria-labelledby="dashboard-title">
          <div className="section-heading">
            <p className="eyebrow">Compact dashboard</p>
            <h2 id="dashboard-title">Demo appointment state</h2>
          </div>
          <dl className="dashboard-list">
            <div>
              <dt>Facility</dt>
              <dd>{data.facility.name}</dd>
            </div>
            <div>
              <dt>Practitioner</dt>
              <dd>{formatPersonName(selection.practitioner)}</dd>
            </div>
            <div>
              <dt>Patient</dt>
              <dd>{formatPersonName(selection.patient)}</dd>
            </div>
            <div>
              <dt>Appointment date/time</dt>
              <dd>
                {dashboardAppointment
                  ? selection.slot.label
                  : 'Not scheduled yet'}
              </dd>
            </div>
            <div>
              <dt>Appointment status</dt>
              <dd>
                <span className="status-chip">
                  {dashboardAppointment?.status ?? 'DRAFT'}
                </span>
              </dd>
            </div>
            <div>
              <dt>Reminder status</dt>
              <dd>
                {dashboardAppointment?.reminderStatus ??
                  'Waiting for scheduling'}
              </dd>
            </div>
          </dl>

          {dashboardAppointment ? (
            <div className="confirmation" role="status">
              <strong>Appointment scheduled in demo state.</strong>
              <span>{demoConfirmation}</span>
            </div>
          ) : (
            <div className="empty-state" role="status">
              Choose a synthetic patient, practitioner, and slot to preview the
              appointment before scheduling.
            </div>
          )}

          <p className="sr-only" aria-live="polite">
            {demoState.announcement}
          </p>
        </aside>
      </div>
    </main>
  );
}
