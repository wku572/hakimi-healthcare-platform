import dotenv from 'dotenv';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const localEnvPath = fileURLToPath(
  new URL('../../../../.env', import.meta.url),
);

const workerEnvironmentSchema = z.object({
  DATABASE_URL: z
    .string()
    .url()
    .refine(
      (value) =>
        value.startsWith('postgresql://') || value.startsWith('postgres://'),
      'DATABASE_URL must use the postgres or postgresql scheme',
    ),
  REMINDER_WORKER_ID: z
    .string()
    .min(1)
    .default(`reminder-worker-${process.pid}`),
  REMINDER_POLL_INTERVAL_MS: z.coerce.number().int().min(100).default(1_000),
  REMINDER_BATCH_SIZE: z.coerce.number().int().min(1).max(100).default(25),
  REMINDER_LEASE_MS: z.coerce.number().int().min(1_000).default(120_000),
  REMINDER_MAX_ATTEMPTS: z.coerce.number().int().min(1).default(5),
  REMINDER_BACKOFF_BASE_MS: z.coerce.number().int().min(1_000).default(60_000),
  REMINDER_BACKOFF_CAP_MS: z.coerce
    .number()
    .int()
    .min(60_000)
    .default(3_600_000),
  LOG_LEVEL: z.enum(['info', 'warn', 'error']).default('info'),
});

export type ReminderWorkerConfig = z.infer<typeof workerEnvironmentSchema>;

function loadLocalEnvironmentOverrides() {
  if (!fs.existsSync(localEnvPath)) {
    return {};
  }

  const localEnvFile = fs.readFileSync(localEnvPath, 'utf8');

  return dotenv.parse(localEnvFile);
}

export function loadReminderWorkerConfig(
  source: NodeJS.ProcessEnv = process.env,
  localEnvironmentOverrides = loadLocalEnvironmentOverrides(),
): ReminderWorkerConfig {
  const parsed = workerEnvironmentSchema.safeParse({
    ...localEnvironmentOverrides,
    ...source,
  });

  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => {
        const path = issue.path.join('.') || 'environment';
        return `- ${path}: ${issue.message}`;
      })
      .join('\n');

    throw new Error(`Invalid reminder worker configuration:\n${message}`);
  }

  return parsed.data;
}
