import { describe, expect, it } from 'vitest';
import { loadWorkforceAuthConfig } from './authConfig';

const environment = {
  VITE_OIDC_ISSUER: 'http://localhost:8080/realms/hakimi-local/',
  VITE_OIDC_CLIENT_ID: 'hakimi-web',
  VITE_OIDC_REDIRECT_URI: 'http://localhost:5173/auth/callback',
  VITE_OIDC_POST_LOGOUT_REDIRECT_URI: 'http://localhost:5173',
  VITE_OIDC_SCOPE: 'openid',
};

describe('workforce auth config', () => {
  it('normalizes issuer metadata and preserves allow-listed logout redirect form', () => {
    expect(loadWorkforceAuthConfig(environment)).toMatchObject({
      issuer: 'http://localhost:8080/realms/hakimi-local',
      redirectUri: 'http://localhost:5173/auth/callback',
      postLogoutRedirectUri: 'http://localhost:5173/',
    });
  });

  it('rejects missing required public OIDC configuration', () => {
    expect(() =>
      loadWorkforceAuthConfig({
        ...environment,
        VITE_OIDC_CLIENT_ID: undefined,
      }),
    ).toThrow('Missing workforce OIDC configuration: VITE_OIDC_CLIENT_ID');
  });
});
