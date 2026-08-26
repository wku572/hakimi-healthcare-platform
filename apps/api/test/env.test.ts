import { describe, expect, it } from 'vitest';
import { loadEnvironment } from '../src/env.js';
import { loadReminderWorkerConfig } from '../src/reminders/config.js';

const injectedEnvironment = {
  PORT: '3001',
  NODE_ENV: 'production',
  POSTGRES_DB: 'hakimi_prod',
  POSTGRES_USER: 'hakimi_prod',
  POSTGRES_PASSWORD: 'change-me',
  DATABASE_URL: 'postgresql://hakimi_prod:change-me@postgres:5432/hakimi_prod',
};

describe('environment loaders', () => {
  it('loads injected variables when .env is absent', () => {
    const environment = loadEnvironment(injectedEnvironment, {});
    const workerConfig = loadReminderWorkerConfig(
      {
        ...injectedEnvironment,
        REMINDER_WORKER_ID: 'reminder-worker-prod',
      },
      {},
    );

    expect(environment).toEqual({
      PORT: 3001,
      NODE_ENV: 'production',
      POSTGRES_DB: 'hakimi_prod',
      POSTGRES_USER: 'hakimi_prod',
      POSTGRES_PASSWORD: 'change-me',
      DATABASE_URL:
        'postgresql://hakimi_prod:change-me@postgres:5432/hakimi_prod',
      LOG_LEVEL: 'info',
    });
    expect(workerConfig.DATABASE_URL).toBe(
      'postgresql://hakimi_prod:change-me@postgres:5432/hakimi_prod',
    );
    expect(workerConfig.REMINDER_WORKER_ID).toBe('reminder-worker-prod');
    expect(workerConfig.LOG_LEVEL).toBe('info');
  });

  it('prefers injected variables over .env values', () => {
    const localEnvironmentOverrides = {
      PORT: '4000',
      NODE_ENV: 'development',
      POSTGRES_DB: 'hakimi_dev',
      POSTGRES_USER: 'hakimi_dev',
      POSTGRES_PASSWORD: 'from-file',
      DATABASE_URL: 'postgresql://file:from-file@postgres:5432/hakimi_dev',
      REMINDER_WORKER_ID: 'file-worker',
    };

    const environment = loadEnvironment(
      injectedEnvironment,
      localEnvironmentOverrides,
    );
    const workerConfig = loadReminderWorkerConfig(
      {
        ...injectedEnvironment,
        REMINDER_WORKER_ID: 'reminder-worker-prod',
      },
      localEnvironmentOverrides,
    );

    expect(environment).toEqual({
      PORT: 3001,
      NODE_ENV: 'production',
      POSTGRES_DB: 'hakimi_prod',
      POSTGRES_USER: 'hakimi_prod',
      POSTGRES_PASSWORD: 'change-me',
      DATABASE_URL:
        'postgresql://hakimi_prod:change-me@postgres:5432/hakimi_prod',
      LOG_LEVEL: 'info',
    });
    expect(workerConfig.REMINDER_WORKER_ID).toBe('reminder-worker-prod');
  });

  it('rejects missing required variables when no .env is available', () => {
    expect(() => loadEnvironment({}, {})).toThrow(
      /Invalid environment configuration/i,
    );
    expect(() =>
      loadReminderWorkerConfig(
        {
          REMINDER_WORKER_ID: 'reminder-worker-prod',
        },
        {},
      ),
    ).toThrow(/Invalid reminder worker configuration/i);
  });

  it('rejects invalid injected variables', () => {
    expect(() =>
      loadEnvironment(
        {
          ...injectedEnvironment,
          PORT: 'not-a-number',
        },
        {},
      ),
    ).toThrow(/Invalid environment configuration/i);
    expect(() =>
      loadReminderWorkerConfig(
        {
          ...injectedEnvironment,
          REMINDER_WORKER_ID: 'reminder-worker-prod',
          REMINDER_POLL_INTERVAL_MS: 'not-a-number',
        },
        {},
      ),
    ).toThrow(/Invalid reminder worker configuration/i);

    expect(() =>
      loadEnvironment(
        {
          ...injectedEnvironment,
          LOG_LEVEL: 'debug',
        },
        {},
      ),
    ).toThrow(/Invalid environment configuration/i);
    expect(() =>
      loadReminderWorkerConfig(
        {
          ...injectedEnvironment,
          REMINDER_WORKER_ID: 'reminder-worker-prod',
          LOG_LEVEL: 'debug',
        },
        {},
      ),
    ).toThrow(/Invalid reminder worker configuration/i);
  });
});
