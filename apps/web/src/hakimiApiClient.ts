import type {
  AppointmentAvailabilityResponse,
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
  listAppointmentAvailability(options: {
    facilityId: string;
    practitionerId: string;
    from: string;
    to: string;
    signal?: AbortSignal;
  }): Promise<AppointmentAvailabilityResponse>;
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

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isValidDateTime(value: string) {
  return Number.isFinite(Date.parse(value));
}

function toTime(value: string) {
  return new Date(value).getTime();
}

function isValidTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function rejectInvalidAvailabilityResponse(): never {
  throw new HakimiApiError('server', failureMessage('server'));
}

function assertAvailabilityResponse(
  value: unknown,
): asserts value is AppointmentAvailabilityResponse {
  if (!value || typeof value !== 'object') {
    rejectInvalidAvailabilityResponse();
  }

  const response = value as Partial<AppointmentAvailabilityResponse>;
  if (
    !isString(response.facilityId) ||
    !isString(response.practitionerId) ||
    !isString(response.timeZone) ||
    !isString(response.from) ||
    !isString(response.to) ||
    !Array.isArray(response.slots)
  ) {
    rejectInvalidAvailabilityResponse();
  }

  if (
    !isValidTimeZone(response.timeZone) ||
    !isValidDateTime(response.from) ||
    !isValidDateTime(response.to) ||
    toTime(response.to) <= toTime(response.from)
  ) {
    rejectInvalidAvailabilityResponse();
  }

  const seenSlots = new Set<string>();
  for (const slot of response.slots) {
    if (
      !slot ||
      typeof slot !== 'object' ||
      !isString(slot.start) ||
      !isString(slot.end) ||
      !isValidDateTime(slot.start) ||
      !isValidDateTime(slot.end) ||
      typeof slot.slotMinutes !== 'number' ||
      !Number.isInteger(slot.slotMinutes) ||
      slot.slotMinutes <= 0
    ) {
      rejectInvalidAvailabilityResponse();
    }

    const start = toTime(slot.start);
    const end = toTime(slot.end);
    const durationMs = slot.slotMinutes * 60 * 1000;
    const key = `${slot.start}|${slot.end}`;

    if (
      end <= start ||
      end - start !== durationMs ||
      start < toTime(response.from) ||
      end > toTime(response.to) ||
      seenSlots.has(key)
    ) {
      rejectInvalidAvailabilityResponse();
    }
    seenSlots.add(key);
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

    async listAppointmentAvailability(options) {
      const url = new URL('appointments/availability', config.baseUrl);
      appendQuery(url, {
        facilityId: options.facilityId,
        practitionerId: options.practitionerId,
        from: options.from,
        to: options.to,
      });

      const response = await request<unknown>(
        `${url.pathname}${url.search}`,
        options.signal,
      );
      assertAvailabilityResponse(response);
      return response;
    },
  });
}
