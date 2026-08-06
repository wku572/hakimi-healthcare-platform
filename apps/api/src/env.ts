import dotenv from 'dotenv';
import * as fs from 'node:fs';
import { z } from 'zod';
import { fileURLToPath } from 'node:url';

const localEnvPath = fileURLToPath(new URL('../../../.env', import.meta.url));

const environmentSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535),
  NODE_ENV: z.enum(['development', 'test', 'production']),
  POSTGRES_DB: z.string().min(1),
  POSTGRES_USER: z.string().min(1),
  POSTGRES_PASSWORD: z.string().min(1),
  DATABASE_URL: z
    .string()
    .url()
    .refine(
      (value) =>
        value.startsWith('postgresql://') || value.startsWith('postgres://'),
      'DATABASE_URL must use the postgres or postgresql scheme',
    ),
});

export type RuntimeEnvironment = z.infer<typeof environmentSchema>;

function loadLocalEnvironmentOverrides() {
  if (!fs.existsSync(localEnvPath)) {
    return {};
  }

  const localEnvFile = fs.readFileSync(localEnvPath, 'utf8');

  return dotenv.parse(localEnvFile);
}

export function loadEnvironment(
  source: NodeJS.ProcessEnv = process.env,
  localEnvironmentOverrides = loadLocalEnvironmentOverrides(),
): RuntimeEnvironment {
  const parsed = environmentSchema.safeParse({
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

    throw new Error(`Invalid environment configuration:\n${message}`);
  }

  return parsed.data;
}
