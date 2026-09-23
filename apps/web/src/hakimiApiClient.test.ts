import { describe, expect, it, vi } from 'vitest';
import { createHakimiApiClient } from './hakimiApiClient';
import type { WorkforceAuthClient } from './authClient';

const config = {
  baseUrl: new URL('http://localhost:5173/api/v1/'),
};

function createAuthClient(
  token: string | null = 'demo-token',
): Pick<WorkforceAuthClient, 'getAccessToken' | 'clear'> {
  return {
    getAccessToken: vi.fn().mockResolvedValue(token),
    clear: vi.fn().mockResolvedValue(undefined),
  };
}

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

const validAvailabilitySlot = {
  start: '2026-02-01T06:00:00.000Z',
  end: '2026-02-01T06:30:00.000Z',
  slotMinutes: 30,
};

const validAvailabilityResponse = {
  facilityId: '11111111-1111-4111-8111-111111111111',
  practitionerId: '44444444-4444-4444-8444-444444444444',
  timeZone: 'Africa/Addis_Ababa',
  from: '2026-02-01T00:00:00.000Z',
  to: '2026-02-15T00:00:00.000Z',
  slots: [validAvailabilitySlot],
};

describe('Hakimi API client', () => {
  it('adds a bearer header to configured API-origin requests', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse({
        data: [],
        pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 },
      }),
    );
    const client = createHakimiApiClient(
      config,
      createAuthClient(),
      fetcher as unknown as typeof fetch,
    );

    await client.listFacilities();

    expect(fetcher).toHaveBeenCalledWith(
      expect.objectContaining({
        href: expect.stringContaining('/api/v1/facilities'),
      }),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer demo-token',
        }),
      }),
    );
  });

  it('keeps caller-controlled query values on the configured API origin', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse({
        data: [],
        pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 },
      }),
    );
    const client = createHakimiApiClient(
      config,
      createAuthClient(),
      fetcher as unknown as typeof fetch,
    );

    await client.listPatients({
      facilityId: '11111111-1111-4111-8111-111111111111',
      search: 'https://evil.example/collect',
    });

    const requestedUrl = fetcher.mock.calls[0]?.[0] as URL;
    expect(requestedUrl.origin).toBe(config.baseUrl.origin);
    expect(requestedUrl.pathname).toBe('/api/v1/patients');
    expect(requestedUrl.searchParams.get('search')).toBe(
      'https://evil.example/collect',
    );
    expect(fetcher).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer demo-token',
        }),
      }),
    );
  });

  it('requests appointment availability without client-controlled slot duration', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(jsonResponse(validAvailabilityResponse));
    const client = createHakimiApiClient(
      config,
      createAuthClient(),
      fetcher as unknown as typeof fetch,
    );

    await client.listAppointmentAvailability({
      facilityId: '11111111-1111-4111-8111-111111111111',
      practitionerId: '44444444-4444-4444-8444-444444444444',
      from: '2026-02-01T00:00:00.000Z',
      to: '2026-02-15T00:00:00.000Z',
    });

    const requestedUrl = fetcher.mock.calls[0]?.[0] as URL;
    expect(requestedUrl.pathname).toBe('/api/v1/appointments/availability');
    expect(requestedUrl.searchParams.get('facilityId')).toBe(
      '11111111-1111-4111-8111-111111111111',
    );
    expect(requestedUrl.searchParams.get('practitionerId')).toBe(
      '44444444-4444-4444-8444-444444444444',
    );
    expect(requestedUrl.searchParams.get('from')).toBe(
      '2026-02-01T00:00:00.000Z',
    );
    expect(requestedUrl.searchParams.get('to')).toBe(
      '2026-02-15T00:00:00.000Z',
    );
    expect(requestedUrl.searchParams.has('slotMinutes')).toBe(false);
  });

  it('maps malformed appointment availability responses to the safe server failure', async () => {
    const client = createHakimiApiClient(
      config,
      createAuthClient(),
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ slots: 'not-an-array' }),
        ) as unknown as typeof fetch,
    );

    await expect(
      client.listAppointmentAvailability({
        facilityId: '11111111-1111-4111-8111-111111111111',
        practitionerId: '44444444-4444-4444-8444-444444444444',
        from: '2026-02-01T00:00:00.000Z',
        to: '2026-02-15T00:00:00.000Z',
      }),
    ).rejects.toMatchObject({
      kind: 'server',
      message: 'Hakimi API returned an unexpected error.',
    });
  });

  it.each([
    [
      'invalid IANA timezone',
      { ...validAvailabilityResponse, timeZone: 'Not/A_Timezone' },
    ],
    [
      'invalid timestamp',
      {
        ...validAvailabilityResponse,
        slots: [{ ...validAvailabilitySlot, start: 'not-a-date' }],
      },
    ],
    [
      'end not after start',
      {
        ...validAvailabilityResponse,
        slots: [
          {
            ...validAvailabilitySlot,
            end: validAvailabilitySlot.start,
          },
        ],
      },
    ],
    [
      'unsupported slot duration',
      {
        ...validAvailabilityResponse,
        slots: [
          {
            ...validAvailabilitySlot,
            slotMinutes: 0,
          },
        ],
      },
    ],
    [
      'duration mismatch',
      {
        ...validAvailabilityResponse,
        slots: [
          {
            ...validAvailabilitySlot,
            slotMinutes: 45,
          },
        ],
      },
    ],
    [
      'slot outside returned range',
      {
        ...validAvailabilityResponse,
        slots: [
          {
            ...validAvailabilitySlot,
            start: '2026-01-31T23:30:00.000Z',
            end: '2026-02-01T00:00:00.000Z',
          },
        ],
      },
    ],
    [
      'duplicate slots',
      {
        ...validAvailabilityResponse,
        slots: [validAvailabilitySlot, validAvailabilitySlot],
      },
    ],
  ])('rejects appointment availability with %s', async (_name, response) => {
    const client = createHakimiApiClient(
      config,
      createAuthClient(),
      vi
        .fn()
        .mockResolvedValue(jsonResponse(response)) as unknown as typeof fetch,
    );

    await expect(
      client.listAppointmentAvailability({
        facilityId: '11111111-1111-4111-8111-111111111111',
        practitionerId: '44444444-4444-4444-8444-444444444444',
        from: '2026-02-01T00:00:00.000Z',
        to: '2026-02-15T00:00:00.000Z',
      }),
    ).rejects.toMatchObject({
      kind: 'server',
      message: 'Hakimi API returned an unexpected error.',
    });
  });

  it('fails as unauthenticated when no token is available', async () => {
    const authClient = createAuthClient(null);
    const client = createHakimiApiClient(config, authClient);

    await expect(client.listFacilities()).rejects.toMatchObject({
      kind: 'unauthenticated',
    });
    expect(authClient.clear).toHaveBeenCalledOnce();
  });

  it('maps forbidden, validation, network, and server failures safely', async () => {
    const forbiddenClient = createHakimiApiClient(
      config,
      createAuthClient(),
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({}, { status: 403 }),
        ) as unknown as typeof fetch,
    );
    const validationClient = createHakimiApiClient(
      config,
      createAuthClient(),
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({}, { status: 400 }),
        ) as unknown as typeof fetch,
    );
    const networkClient = createHakimiApiClient(
      config,
      createAuthClient(),
      vi
        .fn()
        .mockRejectedValue(
          new Error('ECONNREFUSED'),
        ) as unknown as typeof fetch,
    );
    const serverClient = createHakimiApiClient(
      config,
      createAuthClient(),
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({}, { status: 500 }),
        ) as unknown as typeof fetch,
    );

    await expect(forbiddenClient.listFacilities()).rejects.toMatchObject({
      kind: 'forbidden',
    });
    await expect(validationClient.listFacilities()).rejects.toMatchObject({
      kind: 'validation',
    });
    await expect(networkClient.listFacilities()).rejects.toMatchObject({
      kind: 'network',
    });
    await expect(serverClient.listFacilities()).rejects.toMatchObject({
      kind: 'server',
    });
  });
});
