import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

describe('GET /health/live', () => {
  it('returns ok', async () => {
    const app = createApp();

    const response = await request(app).get('/health/live');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });
});

describe('GET /health/ready', () => {
  it('returns ready when the database check succeeds', async () => {
    const app = createApp({
      readinessCheck: async () => true,
    });

    const response = await request(app).get('/health/ready');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ready', database: 'up' });
  });

  it('returns not ready when the database check fails', async () => {
    const app = createApp({
      readinessCheck: async () => {
        throw new Error('database unavailable');
      },
    });

    const response = await request(app).get('/health/ready');

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ status: 'not_ready', database: 'down' });
  });
});
