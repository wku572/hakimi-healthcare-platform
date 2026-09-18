import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

type KeycloakMapper = {
  name?: unknown;
  protocolMapper?: unknown;
  config?: Record<string, unknown>;
};

type KeycloakClient = {
  clientId?: unknown;
  publicClient?: unknown;
  standardFlowEnabled?: unknown;
  implicitFlowEnabled?: unknown;
  directAccessGrantsEnabled?: unknown;
  serviceAccountsEnabled?: unknown;
  redirectUris?: unknown;
  webOrigins?: unknown;
  attributes?: Record<string, unknown>;
  protocolMappers?: KeycloakMapper[];
};

type KeycloakUser = {
  id?: unknown;
  username?: unknown;
  firstName?: unknown;
  lastName?: unknown;
};

type KeycloakRealm = {
  realm?: unknown;
  enabled?: unknown;
  clients?: KeycloakClient[];
  users?: KeycloakUser[];
  roles?: unknown;
};

const realmPath = fileURLToPath(
  new URL(
    '../../../infrastructure/local-oidc/hakimi-local-realm.json',
    import.meta.url,
  ),
);

function loadRealm() {
  return JSON.parse(readFileSync(realmPath, 'utf8')) as KeycloakRealm;
}

function findClient(realm: KeycloakRealm, clientId: string) {
  return realm.clients?.find((client) => client.clientId === clientId);
}

function findMapper(client: KeycloakClient, name: string) {
  return client.protocolMappers?.find((mapper) => mapper.name === name);
}

describe('local OIDC realm import', () => {
  it('defines only a development realm and browser PKCE client', () => {
    const realm = loadRealm();
    const client = findClient(realm, 'hakimi-web');

    expect(realm.realm).toBe('hakimi-local');
    expect(realm.enabled).toBe(true);
    expect(client).toBeDefined();
    expect(client).toMatchObject({
      publicClient: true,
      standardFlowEnabled: true,
      implicitFlowEnabled: false,
      directAccessGrantsEnabled: false,
      serviceAccountsEnabled: false,
    });
    expect(client?.attributes?.['pkce.code.challenge.method']).toBe('S256');
    expect(client?.redirectUris).toEqual([
      'http://localhost:5173/auth/callback',
      'http://127.0.0.1:5173/auth/callback',
    ]);
    expect(client?.webOrigins).toEqual([
      'http://localhost:5173',
      'http://127.0.0.1:5173',
    ]);
  });

  it('maps tokens to the existing API verifier contract without Hakimi roles', () => {
    const realm = loadRealm();
    const client = findClient(realm, 'hakimi-web');
    expect(client).toBeDefined();

    const audienceMapper = findMapper(client!, 'hakimi-api-audience');
    const acrMapper = findMapper(client!, 'hakimi-development-acr');

    expect(audienceMapper).toMatchObject({
      protocolMapper: 'oidc-audience-mapper',
    });
    expect(audienceMapper?.config).toMatchObject({
      'access.token.claim': 'true',
      'included.custom.audience': 'hakimi-api',
    });
    expect(acrMapper).toMatchObject({
      protocolMapper: 'oidc-hardcoded-claim-mapper',
    });
    expect(acrMapper?.config).toMatchObject({
      'access.token.claim': 'true',
      'claim.name': 'acr',
      'claim.value': 'workforce-mfa',
      'jsonType.label': 'String',
    });
    expect(JSON.stringify(realm.roles ?? {})).not.toContain('PATIENT');
    expect(JSON.stringify(client)).not.toContain('PATIENT');
  });

  it('contains one deterministic fictional workforce user for later provisioning', () => {
    const realm = loadRealm();

    expect(realm.users).toEqual([
      expect.objectContaining({
        id: '00000000-0000-4000-8000-0000000000d5',
        username: 'demo.scheduler',
        email: 'demo.scheduler@example.test',
        emailVerified: true,
        firstName: 'Demo',
        lastName: 'Scheduler',
      }),
    ]);
  });
});
