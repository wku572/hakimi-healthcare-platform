import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import type { WorkforceAuthClient, WorkforceUserHint } from './authClient';

const authenticatedUser: WorkforceUserHint = {
  displayName: 'Demo Scheduler',
  username: 'demo.scheduler',
  acr: 'workforce-mfa',
  expiresAt: 123456789,
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
    refresh: vi
      .fn<() => Promise<WorkforceUserHint | null>>()
      .mockResolvedValue(authenticatedUser),
    signOut: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    clear: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    ...overrides,
  };
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

    render(<App authClient={authClient} />);

    expect(screen.getByText('Checking workforce session')).toBeInTheDocument();
    expect(
      screen.queryByLabelText('Protected workforce shell'),
    ).not.toBeInTheDocument();
  });

  it('renders the unauthenticated sign-in screen without protected content', async () => {
    render(<App authClient={createAuthClient()} />);

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
      <App authClient={authClient} initialPath="/appointments?day=demo" />,
    );
    await user.click(await screen.findByRole('button', { name: 'Sign in' }));

    expect(authClient.signIn).toHaveBeenCalledWith('/appointments?day=demo');
  });

  it('renders the authenticated shell using safe display claims', async () => {
    const authClient = createAuthClient({
      initialize: vi.fn().mockResolvedValue(authenticatedUser),
    });

    render(<App authClient={authClient} />);

    expect(
      await screen.findByText('Welcome, Demo Scheduler'),
    ).toBeInTheDocument();
    expect(screen.getByText('demo.scheduler')).toBeInTheDocument();
    expect(screen.getByText('workforce-mfa')).toBeInTheDocument();
    expect(screen.getByText('In memory only')).toBeInTheDocument();
    expect(
      screen.getByText(/Browser claims are display hints only/i),
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
        <App authClient={authClient} />
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

    render(<App authClient={authClient} />);
    await user.click(await screen.findByRole('button', { name: 'Logout' }));

    expect(authClient.signOut).toHaveBeenCalledOnce();
  });

  it('returns to signed-out state when refresh fails', async () => {
    const user = userEvent.setup();
    const authClient = createAuthClient({
      initialize: vi.fn().mockResolvedValue(authenticatedUser),
      refresh: vi.fn().mockResolvedValue(null),
    });

    render(<App authClient={authClient} />);
    await user.click(
      await screen.findByRole('button', { name: 'Refresh workforce session' }),
    );

    expect(
      await screen.findByRole('button', { name: 'Sign in' }),
    ).toBeEnabled();
  });

  it('shows authentication errors without rendering protected content', async () => {
    const authClient = createAuthClient({
      initialize: vi
        .fn()
        .mockRejectedValue(new Error('OIDC initialization failed')),
    });

    render(<App authClient={authClient} />);

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

    render(<App authClient={authClient} />);
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
