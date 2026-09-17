import { describe, expect, it, vi } from 'vitest';
import type { User, UserManager, UserManagerSettings } from 'oidc-client-ts';
import { createWorkforceAuthClient } from './authClient';

const config = {
  issuer: 'http://localhost:8080/realms/hakimi-local',
  clientId: 'hakimi-web',
  redirectUri: 'http://localhost:5173/auth/callback',
  postLogoutRedirectUri: 'http://localhost:5173/',
  scope: 'openid',
};

function createUser(overrides: Partial<User> = {}) {
  return {
    access_token: 'fresh-access-token',
    expired: false,
    expires_at: 123456789,
    profile: {
      preferred_username: 'demo.scheduler',
      name: 'Demo Scheduler',
      acr: 'workforce-mfa',
    },
    state: { returnPath: '/appointments' },
    ...overrides,
  } as User;
}

function createSettings(
  overrides: Partial<UserManagerSettings> = {},
): UserManagerSettings {
  return {
    authority: config.issuer,
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    ...overrides,
  };
}

function createManager(settings: UserManagerSettings = createSettings()) {
  return {
    settings,
    getUser: vi.fn<() => Promise<User | null>>(),
    signinRedirect: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    signinRedirectCallback: vi
      .fn<() => Promise<User>>()
      .mockResolvedValue(createUser()),
    signinSilent: vi.fn<() => Promise<User>>().mockResolvedValue(createUser()),
    signoutRedirect: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    removeUser: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  };
}

describe('workforce auth client', () => {
  it('configures Authorization Code with PKCE S256 and in-memory token storage', () => {
    const manager = createManager();
    const captured: { settings?: UserManagerSettings } = {};
    createWorkforceAuthClient(config, (settings) => {
      captured.settings = settings;
      return manager as unknown as UserManager;
    });

    expect(captured.settings).toMatchObject({
      authority: config.issuer,
      client_id: 'hakimi-web',
      response_type: 'code',
      disablePKCE: false,
      loadUserInfo: false,
      monitorSession: false,
      automaticSilentRenew: false,
      revokeTokensOnSignout: true,
    });
    expect(captured.settings?.userStore).toBeDefined();
    expect(captured.settings?.stateStore).toBeDefined();
  });

  it('starts sign-in with a safe return path only', async () => {
    const manager = createManager();
    const client = createWorkforceAuthClient(
      config,
      () => manager as unknown as UserManager,
    );

    await client.signIn('//evil.example');

    expect(manager.signinRedirect).toHaveBeenCalledWith({
      state: { returnPath: '/' },
    });
  });

  it('clears in-memory auth state when refresh fails', async () => {
    const manager = createManager();
    manager.signinSilent.mockRejectedValueOnce(new Error('expired'));
    const client = createWorkforceAuthClient(
      config,
      () => manager as unknown as UserManager,
    );

    await expect(client.refresh()).resolves.toBeNull();

    expect(manager.removeUser).toHaveBeenCalledOnce();
  });

  it('returns an existing in-memory access token when it is not near expiry', async () => {
    const manager = createManager();
    manager.getUser.mockResolvedValueOnce(
      createUser({ expires_at: Math.floor(Date.now() / 1000) + 300 }),
    );
    const client = createWorkforceAuthClient(
      config,
      () => manager as unknown as UserManager,
    );

    await expect(client.getAccessToken()).resolves.toBe('fresh-access-token');

    expect(manager.signinSilent).not.toHaveBeenCalled();
  });

  it('refreshes before returning a near-expiry access token', async () => {
    const manager = createManager();
    manager.getUser.mockResolvedValueOnce(
      createUser({
        access_token: 'stale-access-token',
        expires_at: Math.floor(Date.now() / 1000) + 10,
      }),
    );
    manager.signinSilent.mockResolvedValueOnce(
      createUser({
        access_token: 'refreshed-access-token',
        expires_at: Math.floor(Date.now() / 1000) + 300,
      }),
    );
    const client = createWorkforceAuthClient(
      config,
      () => manager as unknown as UserManager,
    );

    await expect(client.getAccessToken()).resolves.toBe(
      'refreshed-access-token',
    );
  });

  it('shares one concurrent refresh attempt', async () => {
    const manager = createManager();
    manager.getUser.mockResolvedValue(
      createUser({
        access_token: 'stale-access-token',
        expires_at: Math.floor(Date.now() / 1000) + 10,
      }),
    );
    manager.signinSilent.mockResolvedValue(
      createUser({
        access_token: 'refreshed-access-token',
        expires_at: Math.floor(Date.now() / 1000) + 300,
      }),
    );
    const client = createWorkforceAuthClient(
      config,
      () => manager as unknown as UserManager,
    );

    await Promise.all([client.getAccessToken(), client.getAccessToken()]);

    expect(manager.signinSilent).toHaveBeenCalledOnce();
  });

  it('clears local authentication state before logout redirect', async () => {
    const manager = createManager();
    const client = createWorkforceAuthClient(
      config,
      () => manager as unknown as UserManager,
    );

    await client.signOut();

    expect(manager.removeUser).toHaveBeenCalledOnce();
    expect(manager.signoutRedirect).toHaveBeenCalledOnce();
  });
});
