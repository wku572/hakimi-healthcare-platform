import { describe, expect, it, vi } from 'vitest';
import type { RuntimeEnvironment } from '../src/env.js';
import { provisionLocalDemoData } from '../src/access/local-demo-provisioning.js';

const baseEnvironment: RuntimeEnvironment = {
  PORT: 3001,
  NODE_ENV: 'development',
  POSTGRES_DB: 'hakimi_dev',
  POSTGRES_USER: 'hakimi_dev',
  POSTGRES_PASSWORD: 'change-me-development-only',
  DATABASE_URL: 'postgresql://hakimi_dev:change-me@localhost:5432/hakimi_dev',
  LOG_LEVEL: 'info',
};

describe('local demo provisioning safety', () => {
  it('refuses to run unless explicitly enabled', async () => {
    const connect = vi.fn();

    await expect(
      provisionLocalDemoData({ connect }, baseEnvironment, 'false'),
    ).rejects.toThrow('LOCAL_DEMO_PROVISIONING_NOT_ENABLED');
    expect(connect).not.toHaveBeenCalled();
  });

  it('refuses production before opening a database connection', async () => {
    const connect = vi.fn();

    await expect(
      provisionLocalDemoData(
        { connect },
        { ...baseEnvironment, NODE_ENV: 'production' },
        'true',
      ),
    ).rejects.toThrow('LOCAL_DEMO_PROVISIONING_REFUSES_PRODUCTION');
    expect(connect).not.toHaveBeenCalled();
  });
});
