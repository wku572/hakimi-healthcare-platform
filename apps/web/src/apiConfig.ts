export type HakimiApiConfig = Readonly<{
  baseUrl: URL;
}>;

type PublicEnvironment = Readonly<Record<string, string | undefined>>;

export function loadHakimiApiConfig(
  environment: PublicEnvironment,
  currentOrigin = window.location.origin,
): HakimiApiConfig {
  const rawBaseUrl = environment.VITE_HAKIMI_API_BASE_URL ?? '/api/v1';

  try {
    const baseUrl = new URL(rawBaseUrl, currentOrigin);

    if (!['http:', 'https:'].includes(baseUrl.protocol)) {
      throw new Error('unsupported protocol');
    }

    if (!baseUrl.pathname.endsWith('/')) {
      baseUrl.pathname = `${baseUrl.pathname}/`;
    }

    return Object.freeze({ baseUrl });
  } catch {
    throw new Error('VITE_HAKIMI_API_BASE_URL must be a valid HTTP(S) URL');
  }
}
