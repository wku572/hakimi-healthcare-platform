export const OBSERVABILITY_EVENT_CODES = {
  httpRequestCompleted: 'HTTP_REQUEST_COMPLETED',
  httpRequestAborted: 'HTTP_REQUEST_ABORTED',
  httpApiError: 'HTTP_API_ERROR',
  httpUnexpectedError: 'HTTP_UNEXPECTED_ERROR',
  readinessCheckFailed: 'READINESS_CHECK_FAILED',
  postgresConnectivitySucceeded: 'POSTGRES_CONNECTIVITY_SUCCEEDED',
  postgresConnectivityFailed: 'POSTGRES_CONNECTIVITY_FAILED',
  apiStartupFailed: 'API_STARTUP_FAILED',
  apiStarted: 'API_STARTED',
  apiShutdownStarted: 'API_SHUTDOWN_STARTED',
  apiShutdownCompleted: 'API_SHUTDOWN_COMPLETED',
  apiShutdownFailed: 'API_SHUTDOWN_FAILED',
  databasePoolError: 'DATABASE_POOL_ERROR',
  reminderWorkerStarted: 'REMINDER_WORKER_STARTED',
  reminderWorkerFailed: 'REMINDER_WORKER_FAILED',
  reminderCycleCompleted: 'REMINDER_CYCLE_COMPLETED',
  reminderCycleFailed: 'REMINDER_CYCLE_FAILED',
  reminderWorkerStopping: 'REMINDER_WORKER_STOPPING',
  reminderWorkerStopped: 'REMINDER_WORKER_STOPPED',
} as const;

export type ObservabilityEventCode =
  (typeof OBSERVABILITY_EVENT_CODES)[keyof typeof OBSERVABILITY_EVENT_CODES];

export type LogLevel = 'info' | 'warn' | 'error';
export type LogSeverity = 'INFO' | 'WARN' | 'ERROR';
export type ServiceName = 'hakimi-api' | 'hakimi-reminder-worker';

export type SafeLogFields = Partial<{
  requestId: string;
  method: string;
  route: string;
  statusCode: number;
  durationMs: number;
  errorCode: string;
  port: number;
  signal: 'SIGINT' | 'SIGTERM';
  failureStage: 'http_server' | 'database_pool';
  claimedCount: number;
  deliveredCount: number;
  cancelledCount: number;
  supersededCount: number;
  retriedCount: number;
  deadLetteredCount: number;
  skippedCount: number;
}>;

export type ObservabilityLogger = {
  info(eventCode: ObservabilityEventCode, fields?: SafeLogFields): void;
  warn(eventCode: ObservabilityEventCode, fields?: SafeLogFields): void;
  error(eventCode: ObservabilityEventCode, fields?: SafeLogFields): void;
};

type LogSink = {
  stdout(line: string): void;
  stderr(line: string): void;
};

type CreateStructuredLoggerOptions = {
  service: ServiceName;
  level: LogLevel;
  sink?: LogSink;
  now?: () => Date;
};

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  info: 1,
  warn: 2,
  error: 3,
};

const SAFE_FIELD_NAMES = [
  'requestId',
  'method',
  'route',
  'statusCode',
  'durationMs',
  'errorCode',
  'port',
  'signal',
  'failureStage',
  'claimedCount',
  'deliveredCount',
  'cancelledCount',
  'supersededCount',
  'retriedCount',
  'deadLetteredCount',
  'skippedCount',
] as const satisfies ReadonlyArray<keyof SafeLogFields>;

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const METHOD_PATTERN = /^[A-Z]{3,10}$/;
const ERROR_CODE_PATTERN = /^[A-Z][A-Z0-9_]{0,63}$/;
const SAFE_ROUTE_TEMPLATES = new Set([
  '/health/live',
  '/health/ready',
  '/api/v1/facilities',
  '/api/v1/facilities/:id',
  '/api/v1/practitioners',
  '/api/v1/practitioners/:practitionerId',
  '/api/v1/practitioners/:practitionerId/facilities',
  '/api/v1/practitioners/:practitionerId/facilities/:assignmentId',
  '/api/v1/patients',
  '/api/v1/patients/:patientId',
  '/api/v1/appointments',
  '/api/v1/appointments/:appointmentId',
  '/api/v1/appointments/:appointmentId/cancel',
  'UNMATCHED',
]);

const defaultSink: LogSink = {
  stdout(line) {
    process.stdout.write(`${line}\n`);
  },
  stderr(line) {
    process.stderr.write(`${line}\n`);
  },
};

function isSafeStringField(name: keyof SafeLogFields, value: string) {
  switch (name) {
    case 'requestId':
      return UUID_V4_PATTERN.test(value);
    case 'method':
      return METHOD_PATTERN.test(value);
    case 'route':
      return SAFE_ROUTE_TEMPLATES.has(value);
    case 'errorCode':
      return ERROR_CODE_PATTERN.test(value);
    case 'signal':
      return value === 'SIGINT' || value === 'SIGTERM';
    case 'failureStage':
      return value === 'http_server' || value === 'database_pool';
    default:
      return false;
  }
}

function isSafeNumberField(name: keyof SafeLogFields, value: number) {
  if (!Number.isFinite(value) || value < 0) {
    return false;
  }

  if (name === 'port') {
    return Number.isInteger(value) && value >= 1 && value <= 65_535;
  }

  return Number.isInteger(value);
}

function sanitizeFields(fields: SafeLogFields | undefined) {
  const safeFields: Record<string, string | number> = {};

  if (!fields || typeof fields !== 'object') {
    return safeFields;
  }

  const candidateFields = fields as Record<string, unknown>;

  for (const name of SAFE_FIELD_NAMES) {
    const value = candidateFields[name];

    if (typeof value === 'string' && isSafeStringField(name, value)) {
      safeFields[name] = value;
      continue;
    }

    if (typeof value === 'number' && isSafeNumberField(name, value)) {
      safeFields[name] = value;
    }
  }

  return safeFields;
}

export function createStructuredLogger({
  service,
  level,
  sink = defaultSink,
  now = () => new Date(),
}: CreateStructuredLoggerOptions): ObservabilityLogger {
  function write(
    configuredLevel: LogLevel,
    severity: LogSeverity,
    eventCode: ObservabilityEventCode,
    fields?: SafeLogFields,
  ) {
    if (LEVEL_PRIORITY[configuredLevel] < LEVEL_PRIORITY[level]) {
      return;
    }

    const line = JSON.stringify({
      timestamp: now().toISOString(),
      severity,
      service,
      eventCode,
      ...sanitizeFields(fields),
    });

    if (severity === 'INFO') {
      sink.stdout(line);
      return;
    }

    sink.stderr(line);
  }

  return {
    info(eventCode, fields) {
      write('info', 'INFO', eventCode, fields);
    },
    warn(eventCode, fields) {
      write('warn', 'WARN', eventCode, fields);
    },
    error(eventCode, fields) {
      write('error', 'ERROR', eventCode, fields);
    },
  };
}

export const noopObservabilityLogger: ObservabilityLogger = {
  info() {},
  warn() {},
  error() {},
};
