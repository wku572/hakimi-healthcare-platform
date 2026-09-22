import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { HealthcareFacility, Patient, Practitioner } from '@hakimi/shared';
import App from './App';
import type { WorkforceAuthClient, WorkforceUserHint } from './authClient';
import { HakimiApiError, type HakimiApiClient } from './hakimiApiClient';

const authenticatedUser: WorkforceUserHint = {
  displayName: 'Demo Scheduler',
  username: 'demo.scheduler',
  acr: 'workforce-mfa',
  expiresAt: 123456789,
};

const facility: HealthcareFacility = {
  id: '11111111-1111-4111-8111-111111111111',
  code: 'AFC',
  name: 'Addis Family Clinic',
  facilityType: 'clinic',
  licenseNumber: null,
  phone: null,
  email: null,
  region: 'Addis Ababa',
  city: 'Addis Ababa',
  addressLine: null,
  timeZone: 'Africa/Addis_Ababa',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const patient: Patient = {
  id: '22222222-2222-4222-8222-222222222222',
  firstName: 'Dawit',
  middleName: null,
  lastName: 'Tesfaye',
  dateOfBirth: null,
  administrativeSex: 'unknown',
  phone: null,
  email: null,
  addressLine: null,
  city: null,
  region: null,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  registrations: [
    {
      id: '33333333-3333-4333-8333-333333333333',
      patientId: '22222222-2222-4222-8222-222222222222',
      facilityId: facility.id,
      medicalRecordNumber: 'AFC-DEMO-1001',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      facility,
    },
  ],
};

const practitioner: Practitioner = {
  id: '44444444-4444-4444-8444-444444444444',
  code: 'PRAC-DEMO-1',
  firstName: 'Samuel',
  middleName: null,
  lastName: 'Tadesse',
  profession: 'General Practitioner',
  licenseNumber: 'LIC-DEMO-1',
  phone: null,
  email: null,
  bio: null,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });

  return { promise, resolve, reject };
}

function createAuthClient(
  overrides: Partial<WorkforceAuthClient> = {},
): WorkforceAuthClient {
  return {
    initialize: vi
      .fn<() => Promise<WorkforceUserHint | null>>()
      .mockResolvedValue(null),
    signIn: vi
      .fn<(returnPath: string) => Promise<void>>()
      .mockResolvedValue(undefined),
    handleRedirectCallback: vi
      .fn<() => Promise<WorkforceUserHint | null>>()
      .mockResolvedValue(authenticatedUser),
    getAccessToken: vi
      .fn<() => Promise<string | null>>()
      .mockResolvedValue('demo-access-token'),
    refresh: vi
      .fn<() => Promise<WorkforceUserHint | null>>()
      .mockResolvedValue(authenticatedUser),
    signOut: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    clear: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    ...overrides,
  };
}

function createApiClient(
  overrides: Partial<HakimiApiClient> = {},
): HakimiApiClient {
  return {
    listFacilities: vi.fn().mockResolvedValue({
      data: [facility],
      pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
    }),
    listPatients: vi.fn().mockResolvedValue({
      data: [patient],
      pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
    }),
    listPractitioners: vi.fn().mockResolvedValue({
      data: [practitioner],
      pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
    }),
    ...overrides,
  };
}

function renderAuthenticated(
  options: {
    authClient?: WorkforceAuthClient;
    apiClient?: HakimiApiClient;
  } = {},
) {
  const authClient =
    options.authClient ??
    createAuthClient({
      initialize: vi.fn().mockResolvedValue(authenticatedUser),
    });
  const apiClient = options.apiClient ?? createApiClient();

  render(<App authClient={authClient} apiClient={apiClient} />);

  return { apiClient, authClient };
}

describe('App workforce authentication shell', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  it('shows a neutral loading state and hides protected content during initialization', () => {
    const initialization = deferred<WorkforceUserHint | null>();
    const authClient = createAuthClient({
      initialize: vi.fn().mockReturnValue(initialization.promise),
    });

    render(<App authClient={authClient} apiClient={createApiClient()} />);

    expect(screen.getByText('Checking workforce session')).toBeInTheDocument();
    expect(
      screen.queryByLabelText('Protected workforce shell'),
    ).not.toBeInTheDocument();
  });

  it('renders the unauthenticated sign-in screen without protected content', async () => {
    render(
      <App authClient={createAuthClient()} apiClient={createApiClient()} />,
    );

    expect(
      await screen.findByRole('button', { name: 'Sign in' }),
    ).toBeEnabled();
    expect(
      screen.getByText(/fictional local-development environment/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText('Protected workforce shell'),
    ).not.toBeInTheDocument();
  });

  it('starts OIDC sign-in with the current path', async () => {
    const user = userEvent.setup();
    const authClient = createAuthClient();

    render(
      <App
        authClient={authClient}
        apiClient={createApiClient()}
        initialPath="/appointments?day=demo"
      />,
    );
    await user.click(await screen.findByRole('button', { name: 'Sign in' }));

    expect(authClient.signIn).toHaveBeenCalledWith('/appointments?day=demo');
  });

  it('renders the authenticated staff scheduling workspace with API data', async () => {
    renderAuthenticated();

    expect(
      await screen.findByText('Create an appointment for a synthetic patient'),
    ).toBeInTheDocument();
    expect(await screen.findAllByText('Addis Family Clinic')).toHaveLength(2);
    expect(await screen.findByText('Samuel Tadesse')).toBeInTheDocument();
    expect(
      screen.getByText('Appointment availability is not implemented yet.'),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Not selected').length).toBeGreaterThanOrEqual(
      2,
    );
  });

  it('searches patients through the protected API and allows one selection', async () => {
    const user = userEvent.setup();
    const { apiClient } = renderAuthenticated();

    await screen.findAllByText('Addis Family Clinic');
    await user.type(screen.getByLabelText('Patient search'), 'Daw');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(apiClient.listPatients).toHaveBeenCalledWith(
      expect.objectContaining({
        facilityId: facility.id,
        search: 'Daw',
      }),
    );
    await user.click(await screen.findByLabelText(/Dawit Tesfaye/i));

    expect(screen.getByLabelText(/Dawit Tesfaye/i)).toBeChecked();
    expect(screen.getByText('Demo MRN AFC-DEMO-1001')).toBeInTheDocument();
  });

  it('browses patients without fixture fallback and shows empty state', async () => {
    const user = userEvent.setup();
    renderAuthenticated({
      apiClient: createApiClient({
        listPatients: vi.fn().mockResolvedValue({
          data: [],
          pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 },
        }),
      }),
    });

    await user.click(await screen.findByRole('button', { name: 'Browse' }));

    expect(
      await screen.findByText('No synthetic patients found.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Dawit Tesfaye')).not.toBeInTheDocument();
  });

  it('aborts superseded patient searches', async () => {
    const user = userEvent.setup();
    const firstSearch =
      deferred<Awaited<ReturnType<HakimiApiClient['listPatients']>>>();
    const listPatients = vi
      .fn()
      .mockReturnValueOnce(firstSearch.promise)
      .mockResolvedValueOnce({
        data: [patient],
        pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
      });
    renderAuthenticated({
      apiClient: createApiClient({ listPatients }),
    });

    await screen.findAllByText('Addis Family Clinic');
    await user.type(screen.getByLabelText('Patient search'), 'Da');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await user.clear(screen.getByLabelText('Patient search'));
    await user.type(screen.getByLabelText('Patient search'), 'Daw');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    const firstSignal = listPatients.mock.calls[0]?.[0].signal as AbortSignal;
    expect(firstSignal.aborted).toBe(true);
  });

  it('keeps facility scope derived from loaded API data', async () => {
    const { apiClient } = renderAuthenticated();

    await screen.findByText('Samuel Tadesse');

    expect(apiClient.listPractitioners).toHaveBeenCalledWith(
      expect.objectContaining({ facilityId: facility.id }),
    );
  });

  it('returns to signed-out state when protected API auth fails', async () => {
    renderAuthenticated({
      apiClient: createApiClient({
        listFacilities: vi
          .fn()
          .mockRejectedValue(
            new HakimiApiError('unauthenticated', 'Please sign in again.'),
          ),
      }),
    });

    expect(
      await screen.findByRole('button', { name: 'Sign in' }),
    ).toBeInTheDocument();
  });

  it('handles the OIDC callback once under React StrictMode', async () => {
    const authClient = createAuthClient();
    window.history.replaceState(
      {},
      '',
      '/auth/callback?code=demo-code&state=demo-state',
    );

    render(
      <StrictMode>
        <App authClient={authClient} apiClient={createApiClient()} />
      </StrictMode>,
    );

    expect(
      await screen.findByLabelText('Protected workforce shell'),
    ).toBeInTheDocument();
    expect(authClient.handleRedirectCallback).toHaveBeenCalledOnce();
  });

  it('clears local authentication state on logout', async () => {
    const user = userEvent.setup();
    const authClient = createAuthClient({
      initialize: vi.fn().mockResolvedValue(authenticatedUser),
    });

    render(<App authClient={authClient} apiClient={createApiClient()} />);
    await user.click(await screen.findByRole('button', { name: 'Logout' }));

    expect(authClient.signOut).toHaveBeenCalledOnce();
  });

  it('shows authentication errors without rendering protected content', async () => {
    const authClient = createAuthClient({
      initialize: vi
        .fn()
        .mockRejectedValue(new Error('OIDC initialization failed')),
    });

    render(<App authClient={authClient} apiClient={createApiClient()} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'OIDC initialization failed',
    );
    expect(authClient.clear).toHaveBeenCalledOnce();
    expect(
      screen.queryByLabelText('Protected workforce shell'),
    ).not.toBeInTheDocument();
  });

  it('does not write tokens to browser storage through the app shell', async () => {
    const user = userEvent.setup();
    const authClient = createAuthClient();
    const localStorageSpy = vi.spyOn(Storage.prototype, 'setItem');

    render(<App authClient={authClient} apiClient={createApiClient()} />);
    await user.click(await screen.findByRole('button', { name: 'Sign in' }));

    expect(localStorageSpy).not.toHaveBeenCalledWith(
      expect.any(String),
      expect.stringMatching(/access_token|refresh_token|id_token/i),
    );
  });

  it('imports the browser renderer without crashing', async () => {
    vi.resetModules();
    vi.doMock('react-dom/client', () => ({
      default: {
        createRoot: vi.fn(() => ({ render: vi.fn() })),
      },
      createRoot: vi.fn(() => ({ render: vi.fn() })),
    }));
    const root = document.createElement('div');
    root.id = 'root';
    document.body.append(root);

    await expect(import('./main')).resolves.toBeDefined();
  });
});
