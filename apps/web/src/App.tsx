import { useEffect, useRef, useState } from 'react';
import type { WorkforceAuthClient, WorkforceUserHint } from './authClient';
import { createWorkforceAuthClient } from './authClient';
import { loadWorkforceAuthConfig } from './authConfig';

type AuthStatus =
  | { state: 'loading' }
  | { state: 'signedOut' }
  | { state: 'authenticated'; user: WorkforceUserHint }
  | { state: 'error'; message: string };

type AppProps = Readonly<{
  authClient?: WorkforceAuthClient;
  initialPath?: string;
}>;

function createDefaultAuthClient(): WorkforceAuthClient {
  const config = loadWorkforceAuthConfig(import.meta.env);
  return createWorkforceAuthClient(config);
}

function isCallbackPath(path: string) {
  return path === '/auth/callback';
}

function authErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Authentication did not complete.';
}

export default function App({ authClient, initialPath }: AppProps) {
  const initialization = useRef<Promise<WorkforceUserHint | null> | null>(null);
  const [client] = useState<WorkforceAuthClient | null>(() => {
    try {
      return authClient ?? createDefaultAuthClient();
    } catch {
      return null;
    }
  });
  const [status, setStatus] = useState<AuthStatus>(
    client
      ? { state: 'loading' }
      : {
          state: 'error',
          message:
            'Workforce OIDC configuration is missing or invalid. Check VITE_OIDC_* development settings.',
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

  async function handleRefresh() {
    if (!client) {
      return;
    }

    setStatus({ state: 'loading' });
    const user = await client.refresh();
    setStatus(user ? { state: 'authenticated', user } : { state: 'signedOut' });
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

        {status.state === 'authenticated' && (
          <section className="workspace" aria-label="Protected workforce shell">
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

            <dl className="claim-grid">
              <div>
                <dt>Fictional username</dt>
                <dd>{status.user.username ?? 'Not provided'}</dd>
              </div>
              <div>
                <dt>Development assurance hint</dt>
                <dd>{status.user.acr ?? 'Not provided'}</dd>
              </div>
              <div>
                <dt>Token storage</dt>
                <dd>In memory only</dd>
              </div>
            </dl>

            <div className="boundary-card">
              <h3>Authorization boundary</h3>
              <p>
                Browser claims are display hints only. API access remains
                verified server-side from the signed bearer token and
                PostgreSQL-backed workforce actor, role, session, and facility
                scope.
              </p>
            </div>

            <button
              className="secondary-action"
              type="button"
              onClick={() => void handleRefresh()}
            >
              Refresh workforce session
            </button>
          </section>
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
