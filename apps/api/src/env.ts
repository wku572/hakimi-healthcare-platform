import dotenv from 'dotenv';
import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { fileURLToPath } from 'node:url';

const localEnvFile = readFileSync(
  fileURLToPath(new URL('../../../.env', import.meta.url)),
  'utf8',
);

const localEnv = dotenv.parse(localEnvFile);

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

export function loadEnvironment(
  source: NodeJS.ProcessEnv = process.env,
): RuntimeEnvironment {
  const parsed = environmentSchema.safeParse({
    ...source,
    ...localEnv,
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
