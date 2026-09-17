import { useEffect, useRef, useState } from 'react';
import type { HealthcareFacility, Patient, Practitioner } from '@hakimi/shared';
import type { WorkforceAuthClient, WorkforceUserHint } from './authClient';
import { createWorkforceAuthClient } from './authClient';
import { loadWorkforceAuthConfig } from './authConfig';
import { loadHakimiApiConfig } from './apiConfig';
import {
  createHakimiApiClient,
  HakimiApiError,
  type HakimiApiClient,
} from './hakimiApiClient';

type AuthStatus =
  | { state: 'loading' }
  | { state: 'signedOut' }
  | { state: 'authenticated'; user: WorkforceUserHint }
  | { state: 'error'; message: string };

type LoadState<T> =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'success'; data: T }
  | { state: 'empty' }
  | { state: 'error'; message: string };

type AppProps = Readonly<{
  authClient?: WorkforceAuthClient;
  apiClient?: HakimiApiClient;
  initialPath?: string;
}>;

const emptyPatientResults: LoadState<Patient[]> = { state: 'idle' };

function createDefaultAuthClient(): WorkforceAuthClient {
  const config = loadWorkforceAuthConfig(import.meta.env);
  return createWorkforceAuthClient(config);
}

function createDefaultApiClient(authClient: WorkforceAuthClient) {
  const config = loadHakimiApiConfig(import.meta.env);
  return createHakimiApiClient(config, authClient);
}

function isCallbackPath(path: string) {
  return path === '/auth/callback';
}

function authErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Authentication did not complete.';
}

function formatPersonName(person: {
  firstName: string;
  middleName?: string | null;
  lastName?: string | null;
}) {
  return [person.firstName, person.middleName, person.lastName]
    .filter(Boolean)
    .join(' ');
}

function getApiErrorMessage(error: unknown) {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return null;
  }

  if (error instanceof HakimiApiError) {
    return error.message;
  }

  return 'Unable to load local Hakimi data.';
}

function registrationForFacility(patient: Patient, facilityId: string) {
  return patient.registrations.find(
    (registration) => registration.facilityId === facilityId,
  );
}

function ProtectedSchedulingWorkspace({
  apiClient,
  onSessionExpired,
  user,
}: Readonly<{
  apiClient: HakimiApiClient;
  onSessionExpired(): void;
  user: WorkforceUserHint;
}>) {
  const [facilityState, setFacilityState] = useState<
    LoadState<HealthcareFacility[]>
  >({ state: 'loading' });
  const [practitionerState, setPractitionerState] = useState<
    LoadState<Practitioner[]>
  >({ state: 'idle' });
  const [patientState, setPatientState] =
    useState<LoadState<Patient[]>>(emptyPatientResults);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [selectedPractitionerId, setSelectedPractitionerId] = useState('');
  const [patientSearch, setPatientSearch] = useState('');
  const patientSearchAbort = useRef<AbortController | null>(null);

  const facilities =
    facilityState.state === 'success' ? facilityState.data : [];
  const fixedFacility = facilities.length === 1 ? facilities[0] : null;
  const practitioners =
    practitionerState.state === 'success' ? practitionerState.data : [];
  const patients = patientState.state === 'success' ? patientState.data : [];
  const selectedPatient = patients.find(
    (patient) => patient.id === selectedPatientId,
  );
  const selectedPractitioner = practitioners.find(
    (practitioner) => practitioner.id === selectedPractitionerId,
  );

  useEffect(() => {
    const controller = new AbortController();

    async function loadFacilities() {
      setFacilityState({ state: 'loading' });
      try {
        const response = await apiClient.listFacilities({
          signal: controller.signal,
        });
        setFacilityState(
          response.data.length > 0
            ? { state: 'success', data: response.data }
            : { state: 'empty' },
        );
      } catch (error) {
        const message = getApiErrorMessage(error);
        if (!message) {
          return;
        }
        if (
          error instanceof HakimiApiError &&
          error.kind === 'unauthenticated'
        ) {
          onSessionExpired();
          return;
        }
        setFacilityState({ state: 'error', message });
      }
    }

    void loadFacilities();

    return () => {
      controller.abort();
    };
  }, [apiClient, onSessionExpired]);

  useEffect(() => {
    const facility = fixedFacility;

    if (!facility) {
      return;
    }

    const facilityId = facility.id;
    const controller = new AbortController();

    async function loadPractitioners() {
      setPractitionerState({ state: 'loading' });
      setSelectedPractitionerId('');
      try {
        const response = await apiClient.listPractitioners({
          facilityId,
          signal: controller.signal,
        });
        setPractitionerState(
          response.data.length > 0
            ? { state: 'success', data: response.data }
            : { state: 'empty' },
        );
      } catch (error) {
        const message = getApiErrorMessage(error);
        if (!message) {
          return;
        }
        if (
          error instanceof HakimiApiError &&
          error.kind === 'unauthenticated'
        ) {
          onSessionExpired();
          return;
        }
        setPractitionerState({ state: 'error', message });
      }
    }

    void loadPractitioners();

    return () => {
      controller.abort();
    };
  }, [apiClient, fixedFacility, onSessionExpired]);

  async function searchPatients(mode: 'query' | 'browse') {
    if (!fixedFacility) {
      return;
    }

    patientSearchAbort.current?.abort();
    const controller = new AbortController();
    patientSearchAbort.current = controller;
    setSelectedPatientId('');
    setPatientState({ state: 'loading' });

    try {
      const request = {
        facilityId: fixedFacility.id,
        signal: controller.signal,
        ...(mode === 'query' && patientSearch.trim().length > 0
          ? { search: patientSearch.trim() }
          : {}),
      };
      const response = await apiClient.listPatients({
        ...request,
      });
      setPatientState(
        response.data.length > 0
          ? { state: 'success', data: response.data }
          : { state: 'empty' },
      );
    } catch (error) {
      const message = getApiErrorMessage(error);
      if (!message) {
        return;
      }
      if (error instanceof HakimiApiError && error.kind === 'unauthenticated') {
        onSessionExpired();
        return;
      }
      setPatientState({ state: 'error', message });
    }
  }

  function clearPatientSearch() {
    patientSearchAbort.current?.abort();
    setPatientSearch('');
    setSelectedPatientId('');
    setPatientState(emptyPatientResults);
  }

  return (
    <section className="workspace" aria-label="Protected workforce shell">
      <header className="workspace-header">
        <div>
          <p className="eyebrow">Staff appointment scheduling</p>
          <h2>Create an appointment for a synthetic patient</h2>
          <p>
            Signed in as {user.displayName}. Browser claims are display hints
            only; API authorization remains server-derived.
          </p>
        </div>
        <div className="storage-note">
          <strong>Token storage</strong>
          <span>
            Bearer tokens stay in memory. OIDC PKCE transaction state may use
            temporary session storage.
          </span>
        </div>
      </header>

      <div className="scheduling-grid">
        <section className="workflow-panel" aria-labelledby="facility-heading">
          <h3 id="facility-heading">1. Authorized facility context</h3>
          {facilityState.state === 'loading' && <p>Loading facilities...</p>}
          {facilityState.state === 'empty' && (
            <p>No facilities are visible to this workforce account.</p>
          )}
          {facilityState.state === 'error' && (
            <p role="alert">{facilityState.message}</p>
          )}
          {facilityState.state === 'success' && fixedFacility && (
            <div className="context-card">
              <strong>{fixedFacility.name}</strong>
              <span>
                {fixedFacility.city}, {fixedFacility.region}
              </span>
              <span>Facility code: {fixedFacility.code}</span>
            </div>
          )}
          {facilityState.state === 'success' && facilities.length > 1 && (
            <p role="alert">
              Multiple facilities are visible. This local demo does not let the
              browser expand facility scope.
            </p>
          )}
        </section>

        <section className="workflow-panel" aria-labelledby="patient-heading">
          <h3 id="patient-heading">2. Patient search</h3>
          <p>
            Search by fictional patient name or demo MRN. Results come from the
            protected patient-list API.
          </p>
          <form
            className="search-row"
            onSubmit={(event) => {
              event.preventDefault();
              void searchPatients('query');
            }}
          >
            <label htmlFor="patient-search">Patient search</label>
            <div>
              <input
                id="patient-search"
                value={patientSearch}
                onChange={(event) => {
                  setPatientSearch(event.target.value);
                }}
                placeholder="Name or demo MRN"
                disabled={!fixedFacility}
              />
              <button
                className="primary-action"
                type="submit"
                disabled={!fixedFacility || patientSearch.trim().length < 2}
              >
                Search
              </button>
              <button
                className="secondary-action"
                type="button"
                disabled={!fixedFacility}
                onClick={() => void searchPatients('browse')}
              >
                Browse
              </button>
              <button
                className="secondary-action"
                type="button"
                onClick={clearPatientSearch}
              >
                Clear
              </button>
            </div>
          </form>

          {patientState.state === 'idle' && (
            <p className="empty-state">
              No patient selected. Search or browse to load PostgreSQL-backed
              synthetic patients.
            </p>
          )}
          {patientState.state === 'loading' && <p>Loading patients...</p>}
          {patientState.state === 'empty' && (
            <p className="empty-state">No synthetic patients found.</p>
          )}
          {patientState.state === 'error' && (
            <p role="alert">{patientState.message}</p>
          )}
          {patientState.state === 'success' && (
            <fieldset className="choice-group">
              <legend className="sr-only">Select one patient</legend>
              {patients.map((patient) => {
                const registration = fixedFacility
                  ? registrationForFacility(patient, fixedFacility.id)
                  : undefined;
                return (
                  <label className="choice-row" key={patient.id}>
                    <input
                      type="radio"
                      name="patient"
                      checked={selectedPatientId === patient.id}
                      onChange={() => {
                        setSelectedPatientId(patient.id);
                      }}
                    />
                    <span>
                      <strong>{formatPersonName(patient)}</strong>
                      <small>
                        Demo MRN{' '}
                        {registration?.medicalRecordNumber ?? 'not available'}
                      </small>
                    </span>
                  </label>
                );
              })}
            </fieldset>
          )}
        </section>

        <section
          className="workflow-panel"
          aria-labelledby="practitioner-heading"
        >
          <h3 id="practitioner-heading">3. Practitioner</h3>
          <p>
            Practitioners are loaded from the protected practitioner-list API
            using the authorized facility context.
          </p>
          {practitionerState.state === 'idle' && (
            <p className="empty-state">Load an authorized facility first.</p>
          )}
          {practitionerState.state === 'loading' && (
            <p>Loading practitioners...</p>
          )}
          {practitionerState.state === 'empty' && (
            <p className="empty-state">
              No active practitioners are visible for this facility.
            </p>
          )}
          {practitionerState.state === 'error' && (
            <p role="alert">{practitionerState.message}</p>
          )}
          {practitionerState.state === 'success' && (
            <fieldset className="choice-group">
              <legend className="sr-only">Select one practitioner</legend>
              {practitioners.map((practitioner) => (
                <label className="choice-row" key={practitioner.id}>
                  <input
                    type="radio"
                    name="practitioner"
                    checked={selectedPractitionerId === practitioner.id}
                    onChange={() => {
                      setSelectedPractitionerId(practitioner.id);
                    }}
                  />
                  <span>
                    <strong>{formatPersonName(practitioner)}</strong>
                    <small>{practitioner.profession}</small>
                  </span>
                </label>
              ))}
            </fieldset>
          )}
        </section>

        <section
          className="workflow-panel"
          aria-labelledby="availability-heading"
        >
          <h3 id="availability-heading">4. Date and time</h3>
          <p role="status">Appointment availability is not implemented yet.</p>
          <p>
            Hakimi can read authorized facilities, patients, and practitioners,
            but the API does not yet expose an availability endpoint. This demo
            stops here instead of showing fake slots.
          </p>
        </section>
      </div>

      <aside className="summary-panel" aria-label="Appointment summary">
        <h3>Appointment summary</h3>
        <dl>
          <div>
            <dt>Facility</dt>
            <dd>{fixedFacility?.name ?? 'Not selected'}</dd>
          </div>
          <div>
            <dt>Patient</dt>
            <dd>
              {selectedPatient
                ? formatPersonName(selectedPatient)
                : 'Not selected'}
            </dd>
          </div>
          <div>
            <dt>Practitioner</dt>
            <dd>
              {selectedPractitioner
                ? formatPersonName(selectedPractitioner)
                : 'Not selected'}
            </dd>
          </div>
          <div>
            <dt>Date and time</dt>
            <dd>Unavailable</dd>
          </div>
          <div>
            <dt>Appointment status</dt>
            <dd>Not started</dd>
          </div>
        </dl>
      </aside>
    </section>
  );
}

export default function App({ authClient, apiClient, initialPath }: AppProps) {
  const initialization = useRef<Promise<WorkforceUserHint | null> | null>(null);
  const [client] = useState<WorkforceAuthClient | null>(() => {
    try {
      return authClient ?? createDefaultAuthClient();
    } catch {
      return null;
    }
  });
  const [api] = useState<HakimiApiClient | null>(() => {
    try {
      return apiClient ?? (client ? createDefaultApiClient(client) : null);
    } catch {
      return null;
    }
  });
  const [status, setStatus] = useState<AuthStatus>(
    client && api
      ? { state: 'loading' }
      : {
          state: 'error',
          message:
            'Workforce OIDC or Hakimi API configuration is missing or invalid. Check VITE_* development settings.',
        },
  );
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const currentPath =
    initialPath ?? `${window.location.pathname}${window.location.search}`;

  useEffect(() => {
    let isMounted = true;

    async function initialize() {
      if (!client) {
        return;
      }

      try {
        initialization.current ??= isCallbackPath(window.location.pathname)
          ? client.handleRedirectCallback()
          : client.initialize();

        const user = await initialization.current;

        if (!isMounted) {
          return;
        }

        setStatus(
          user ? { state: 'authenticated', user } : { state: 'signedOut' },
        );
      } catch (error) {
        await client.clear();

        if (!isMounted) {
          return;
        }

        setStatus({
          state: 'error',
          message: authErrorMessage(error),
        });
      }
    }

    void initialize();

    return () => {
      isMounted = false;
    };
  }, [client]);

  async function handleSignIn() {
    if (!client) {
      return;
    }

    setIsSigningIn(true);
    try {
      await client.signIn(currentPath);
    } catch (error) {
      await client.clear();
      setStatus({
        state: 'error',
        message: authErrorMessage(error),
      });
      setIsSigningIn(false);
    }
  }

  async function handleLogout() {
    if (!client) {
      return;
    }

    setIsSigningOut(true);
    try {
      await client.signOut();
      setStatus({ state: 'signedOut' });
    } catch (error) {
      await client.clear();
      setStatus({
        state: 'error',
        message: authErrorMessage(error),
      });
    } finally {
      setIsSigningOut(false);
    }
  }

  function expireSession() {
    setStatus({ state: 'signedOut' });
  }

  return (
    <main className="shell">
      <section className="panel" aria-labelledby="page-title">
        <header className="brand-header">
          <div>
            <p className="eyebrow">Hakimi / ሀኪሜ</p>
            <h1 id="page-title">Workforce local development</h1>
          </div>
          <span className="environment-badge">Synthetic only</span>
        </header>

        <p className="disclosure">
          Fictional local-development environment. Not connected to a production
          healthcare service and not approved for real patient data.
        </p>

        {status.state === 'loading' && (
          <section className="state-card" aria-live="polite">
            <p className="state-label">Checking workforce session</p>
            <p>
              Hakimi is initializing local OIDC state. Protected content is
              hidden until authentication completes.
            </p>
          </section>
        )}

        {status.state === 'signedOut' && (
          <section className="state-card">
            <p className="state-label">Signed out</p>
            <h2>Sign in with local Keycloak</h2>
            <p>
              Use the fictional workforce account from the local
              <code> hakimi-local </code>
              realm. Hakimi never collects the password; the OIDC provider owns
              the sign-in form.
            </p>
            <button
              className="primary-action"
              type="button"
              onClick={() => void handleSignIn()}
              disabled={isSigningIn}
            >
              {isSigningIn ? 'Redirecting...' : 'Sign in'}
            </button>
          </section>
        )}

        {status.state === 'authenticated' && api && (
          <>
            <div className="workspace-heading">
              <div>
                <p className="state-label">Authenticated workforce shell</p>
                <h2>Welcome, {status.user.displayName}</h2>
              </div>
              <button
                className="secondary-action"
                type="button"
                onClick={() => void handleLogout()}
                disabled={isSigningOut}
              >
                {isSigningOut ? 'Signing out...' : 'Logout'}
              </button>
            </div>
            <ProtectedSchedulingWorkspace
              apiClient={api}
              onSessionExpired={expireSession}
              user={status.user}
            />
          </>
        )}

        {status.state === 'error' && (
          <section className="state-card error-card" role="alert">
            <p className="state-label">Authentication issue</p>
            <h2>Sign-in could not be completed</h2>
            <p>{status.message}</p>
            <button
              className="primary-action"
              type="button"
              onClick={() => {
                setStatus({ state: 'signedOut' });
              }}
            >
              Return to sign in
            </button>
          </section>
        )}
      </section>
    </main>
  );
}
