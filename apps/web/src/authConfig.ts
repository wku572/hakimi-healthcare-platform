export type WorkforceAuthConfig = Readonly<{
  issuer: string;
  clientId: string;
  redirectUri: string;
  postLogoutRedirectUri: string;
  scope: string;
}>;

type PublicEnvironment = Readonly<Record<string, string | undefined>>;

const requiredKeys = [
  'VITE_OIDC_ISSUER',
  'VITE_OIDC_CLIENT_ID',
  'VITE_OIDC_REDIRECT_URI',
  'VITE_OIDC_POST_LOGOUT_REDIRECT_URI',
] as const;

function requireUrl(
  value: string,
  key: string,
  options: { stripTrailingSlash?: boolean } = {},
) {
  try {
    const parsedUrl = new URL(value).toString();

    return options.stripTrailingSlash === false
      ? parsedUrl
      : parsedUrl.replace(/\/$/, '');
  } catch {
    throw new Error(`${key} must be a valid URL`);
  }
}

export function loadWorkforceAuthConfig(
  environment: PublicEnvironment,
): WorkforceAuthConfig {
  const missing = requiredKeys.filter((key) => !environment[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing workforce OIDC configuration: ${missing.join(', ')}`,
    );
  }

  return Object.freeze({
    issuer: requireUrl(environment.VITE_OIDC_ISSUER!, 'VITE_OIDC_ISSUER'),
    clientId: environment.VITE_OIDC_CLIENT_ID!,
    redirectUri: requireUrl(
      environment.VITE_OIDC_REDIRECT_URI!,
      'VITE_OIDC_REDIRECT_URI',
    ),
    postLogoutRedirectUri: requireUrl(
      environment.VITE_OIDC_POST_LOGOUT_REDIRECT_URI!,
      'VITE_OIDC_POST_LOGOUT_REDIRECT_URI',
      { stripTrailingSlash: false },
    ),
    scope: environment.VITE_OIDC_SCOPE ?? 'openid',
  });
}
