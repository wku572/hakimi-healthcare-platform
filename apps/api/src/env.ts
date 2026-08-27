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
  LOG_LEVEL: z.enum(['info', 'warn', 'error']).default('info'),
});

export type RuntimeEnvironment = z.infer<typeof environmentSchema>;

const commaSeparatedAlgorithms = z
  .string()
  .min(1)
  .transform((value) => value.split(',').map((item) => item.trim()))
  .refine(
    (values) =>
      values.length > 0 &&
      new Set(values).size === values.length &&
      values.every((value) => value === 'RS256' || value === 'ES256'),
    'OIDC_ALLOWED_ALGORITHMS must be a unique comma-separated subset of RS256 and ES256',
  );

const commaSeparatedAcrValues = z
  .string()
  .min(1)
  .transform((value) => value.split(',').map((item) => item.trim()))
  .refine(
    (values) =>
      values.length > 0 &&
      values.length <= 10 &&
      new Set(values).size === values.length &&
      values.every((value) => value.length > 0 && value.length <= 100),
    'OIDC_REQUIRED_ACR_VALUES must contain 1 to 10 unique nonblank values of at most 100 characters',
  );

const accessEnvironmentSchema = environmentSchema
  .extend({
    OIDC_ISSUER: z.string().min(1).max(500).url(),
    OIDC_AUDIENCE: z.string().min(1).max(255),
    OIDC_JWKS_URI: z.string().min(1).max(2000).url(),
    OIDC_ALLOWED_ALGORITHMS: commaSeparatedAlgorithms,
    OIDC_REQUIRED_ACR_VALUES: commaSeparatedAcrValues,
    OIDC_CLOCK_TOLERANCE_SECONDS: z.coerce.number().int().min(0).max(60),
  })
  .superRefine((value, context) => {
    const jwksUri = new URL(value.OIDC_JWKS_URI);
    const isLoopback = ['127.0.0.1', '::1', 'localhost'].includes(
      jwksUri.hostname,
    );

    if (
      jwksUri.protocol !== 'https:' &&
      !(
        value.NODE_ENV !== 'production' &&
        jwksUri.protocol === 'http:' &&
        isLoopback
      )
    ) {
      context.addIssue({
        code: 'custom',
        path: ['OIDC_JWKS_URI'],
        message:
          'OIDC_JWKS_URI must use HTTPS except for loopback development and test URLs',
      });
    }
  });

export type AccessRuntimeEnvironment = z.infer<typeof accessEnvironmentSchema>;

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

export function loadAccessEnvironment(
  source: NodeJS.ProcessEnv = process.env,
  localEnvironmentOverrides = loadLocalEnvironmentOverrides(),
): AccessRuntimeEnvironment {
  const parsed = accessEnvironmentSchema.safeParse({
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
