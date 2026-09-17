import type {
  HealthcareFacilityListResponse,
  PatientListResponse,
  PractitionerListResponse,
} from '@hakimi/shared';
import type { WorkforceAuthClient } from './authClient';
import type { HakimiApiConfig } from './apiConfig';

export type ApiFailureKind =
  | 'unauthenticated'
  | 'forbidden'
  | 'notFound'
  | 'validation'
  | 'network'
  | 'server';

export class HakimiApiError extends Error {
  constructor(
    readonly kind: ApiFailureKind,
    message: string,
  ) {
    super(message);
    this.name = 'HakimiApiError';
  }
}

export type HakimiApiClient = Readonly<{
  listFacilities(options?: {
    signal?: AbortSignal;
  }): Promise<HealthcareFacilityListResponse>;
  listPatients(options: {
    facilityId: string;
    search?: string;
    medicalRecordNumber?: string;
    signal?: AbortSignal;
  }): Promise<PatientListResponse>;
  listPractitioners(options: {
    facilityId: string;
    signal?: AbortSignal;
  }): Promise<PractitionerListResponse>;
}>;

type Fetcher = typeof fetch;

function appendQuery(url: URL, values: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value.trim() !== '') {
      url.searchParams.set(key, value);
    }
  }
}

function mapStatusToFailureKind(status: number): ApiFailureKind {
  if (status === 401) {
    return 'unauthenticated';
  }

  if (status === 403) {
    return 'forbidden';
  }

  if (status === 404) {
    return 'notFound';
  }

  if (status === 400 || status === 422) {
    return 'validation';
  }

  return 'server';
}

function failureMessage(kind: ApiFailureKind) {
  switch (kind) {
    case 'unauthenticated':
      return 'Your local workforce session expired. Please sign in again.';
    case 'forbidden':
      return 'Your current workforce access does not allow this data.';
    case 'notFound':
      return 'The requested record was not found.';
    case 'validation':
      return 'The request could not be validated.';
    case 'network':
      return 'Hakimi API is unavailable. Check the local API server.';
    case 'server':
      return 'Hakimi API returned an unexpected error.';
  }
}

export function createHakimiApiClient(
  config: HakimiApiConfig,
  authClient: Pick<WorkforceAuthClient, 'getAccessToken' | 'clear'>,
  fetcher: Fetcher = fetch,
): HakimiApiClient {
  async function request<T>(path: string, signal?: AbortSignal): Promise<T> {
    const url = new URL(path, config.baseUrl);

    if (url.origin !== config.baseUrl.origin) {
      throw new HakimiApiError(
        'network',
        'Refused to call an unexpected API origin.',
      );
    }

    const token = await authClient.getAccessToken();

    if (!token) {
      await authClient.clear();
      throw new HakimiApiError(
        'unauthenticated',
        failureMessage('unauthenticated'),
      );
    }

    let response: Response;
    const init: RequestInit = {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    };
    if (signal) {
      init.signal = signal;
    }

    try {
      response = await fetcher(url, init);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw error;
      }

      throw new HakimiApiError('network', failureMessage('network'));
    }

    if (!response.ok) {
      const kind = mapStatusToFailureKind(response.status);

      if (kind === 'unauthenticated') {
        await authClient.clear();
      }

      throw new HakimiApiError(kind, failureMessage(kind));
    }

    return (await response.json()) as T;
  }

  return Object.freeze({
    listFacilities(options = {}) {
      const url = new URL('facilities', config.baseUrl);
      appendQuery(url, {
        page: '1',
        pageSize: '20',
        isActive: 'true',
      });

      return request<HealthcareFacilityListResponse>(
        `${url.pathname}${url.search}`,
        options.signal,
      );
    },

    listPatients(options) {
      const url = new URL('patients', config.baseUrl);
      appendQuery(url, {
        page: '1',
        pageSize: '20',
        isActive: 'true',
        facilityId: options.facilityId,
        search: options.search,
        medicalRecordNumber: options.medicalRecordNumber,
      });

      return request<PatientListResponse>(
        `${url.pathname}${url.search}`,
        options.signal,
      );
    },

    listPractitioners(options) {
      const url = new URL('practitioners', config.baseUrl);
      appendQuery(url, {
        page: '1',
        pageSize: '20',
        isActive: 'true',
        facilityId: options.facilityId,
      });

      return request<PractitionerListResponse>(
        `${url.pathname}${url.search}`,
        options.signal,
      );
    },
  });
}
