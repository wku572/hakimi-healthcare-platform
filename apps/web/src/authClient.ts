import {
  InMemoryWebStorage,
  UserManager,
  WebStorageStateStore,
  type User,
  type UserManagerSettings,
} from 'oidc-client-ts';
import type { WorkforceAuthConfig } from './authConfig';

export type WorkforceUserHint = Readonly<{
  displayName: string;
  username: string | null;
  acr: string | null;
  expiresAt: number | null;
}>;

export type WorkforceAuthClient = Readonly<{
  initialize(): Promise<WorkforceUserHint | null>;
  signIn(returnPath: string): Promise<void>;
  handleRedirectCallback(): Promise<WorkforceUserHint | null>;
  getAccessToken(): Promise<string | null>;
  refresh(): Promise<WorkforceUserHint | null>;
  signOut(): Promise<void>;
  clear(): Promise<void>;
}>;

type UserManagerFactory = (settings: UserManagerSettings) => UserManager;

function safeStringClaim(value: unknown) {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function toUserHint(user: User | null) {
  if (!user || user.expired) {
    return null;
  }

  const username = safeStringClaim(user.profile.preferred_username);
  const name = safeStringClaim(user.profile.name);
  const givenName = safeStringClaim(user.profile.given_name);
  const familyName = safeStringClaim(user.profile.family_name);
  const displayName =
    name ?? [givenName, familyName].filter(Boolean).join(' ') ?? username;

  return Object.freeze({
    displayName: displayName || 'Fictional workforce user',
    username,
    acr: safeStringClaim(user.profile.acr),
    expiresAt: user.expires_at ?? null,
  });
}

function hasUsableToken(user: User | null, skewSeconds = 60) {
  if (!user?.access_token || user.expired) {
    return false;
  }

  if (!user.expires_at) {
    return true;
  }

  return user.expires_at - Math.floor(Date.now() / 1000) > skewSeconds;
}

function createUserManagerSettings(
  config: WorkforceAuthConfig,
): UserManagerSettings {
  const hasWindow = typeof window !== 'undefined';
  const memoryUserStore = new WebStorageStateStore({
    store: new InMemoryWebStorage(),
  });
  const transientStateStore = new WebStorageStateStore({
    store: hasWindow ? window.sessionStorage : new InMemoryWebStorage(),
    prefix: 'hakimi.oidc.state.',
  });

  return {
    authority: config.issuer,
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    post_logout_redirect_uri: config.postLogoutRedirectUri,
    response_type: 'code',
    scope: config.scope,
    disablePKCE: false,
    loadUserInfo: false,
    monitorSession: false,
    automaticSilentRenew: false,
    revokeTokensOnSignout: true,
    userStore: memoryUserStore,
    stateStore: transientStateStore,
  };
}

export function createWorkforceAuthClient(
  config: WorkforceAuthConfig,
  userManagerFactory: UserManagerFactory = (settings) =>
    new UserManager(settings),
): WorkforceAuthClient {
  const manager = userManagerFactory(createUserManagerSettings(config));
  let refreshInFlight: Promise<User | null> | null = null;

  async function refreshUser() {
    refreshInFlight ??= manager
      .signinSilent()
      .catch(async () => {
        await manager.removeUser();
        return null;
      })
      .finally(() => {
        refreshInFlight = null;
      });

    return refreshInFlight;
  }

  return Object.freeze({
    async initialize() {
      return toUserHint(await manager.getUser());
    },

    async signIn(returnPath) {
      await manager.signinRedirect({
        state: {
          returnPath:
            returnPath.startsWith('/') && !returnPath.startsWith('//')
              ? returnPath
              : '/',
        },
      });
    },

    async handleRedirectCallback() {
      const user = await manager.signinRedirectCallback();
      const state =
        typeof user.state === 'object' && user.state !== null
          ? (user.state as { returnPath?: unknown })
          : {};
      const returnPath =
        typeof state.returnPath === 'string' &&
        state.returnPath.startsWith('/') &&
        !state.returnPath.startsWith('//')
          ? state.returnPath
          : '/';

      window.history.replaceState({}, document.title, returnPath);
      return toUserHint(user);
    },

    async getAccessToken() {
      const user = await manager.getUser();

      if (hasUsableToken(user)) {
        return user?.access_token ?? null;
      }

      const refreshedUser = await refreshUser();

      return hasUsableToken(refreshedUser, 0)
        ? (refreshedUser?.access_token ?? null)
        : null;
    },

    async refresh() {
      return toUserHint(await refreshUser());
    },

    async signOut() {
      await manager.removeUser();
      await manager.signoutRedirect();
    },

    async clear() {
      await manager.removeUser();
    },
  });
}
