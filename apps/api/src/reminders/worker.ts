import { createPostgresPool, closePostgresPool } from '../database.js';
import { loadReminderWorkerConfig } from './config.js';
import {
  createDevelopmentReminderDeliveryAdapter,
  type ReminderDeliveryAdapter,
} from './adapter.js';
import {
  createReminderRepository,
  type ReminderRepository,
} from './repository.js';
import {
  computeReminderBackoffMs,
  isReminderDeliveryError,
  type ReminderDeliveryErrorCategory,
} from './service.js';
import type { AppointmentReminderProcessingContext } from './types.js';
import { pathToFileURL } from 'node:url';
import {
  createStructuredLogger,
  OBSERVABILITY_EVENT_CODES,
  type ObservabilityLogger,
} from '../observability/logger.js';

type ReminderWorkerDependencies = {
  repository: ReminderRepository;
  adapter: ReminderDeliveryAdapter;
  logger: ObservabilityLogger;
  workerId: string;
  pollIntervalMs: number;
  batchSize: number;
  leaseMs: number;
  maxAttempts: number;
  backoffBaseMs: number;
  backoffCapMs: number;
  now: () => Date;
};

type ReminderProcessingSummary = {
  claimedCount: number;
  deliveredCount: number;
  cancelledCount: number;
  supersededCount: number;
  retriedCount: number;
  deadLetteredCount: number;
  skippedCount: number;
};

type ReminderProcessingOutcome =
  | 'delivered'
  | 'cancelled'
  | 'superseded'
  | 'retried'
  | 'deadLettered'
  | 'skipped';

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    function onAbort() {
      clearTimeout(timeout);
      resolve();
    }

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function getErrorCategory(error: unknown): ReminderDeliveryErrorCategory {
  if (isReminderDeliveryError(error)) {
    return error.category;
  }

  return 'transient_delivery_failure';
}

async function processClaimedReminder(
  repository: ReminderRepository,
  adapter: ReminderDeliveryAdapter,
  config: Pick<
    ReminderWorkerDependencies,
    'workerId' | 'backoffBaseMs' | 'backoffCapMs' | 'maxAttempts' | 'now'
  >,
  reminder: AppointmentReminderProcessingContext,
): Promise<ReminderProcessingOutcome> {
  const latest = await repository.findAppointmentReminderProcessingContextById(
    reminder.id,
  );

  if (
    !latest ||
    latest.status !== 'PROCESSING' ||
    latest.leaseToken !== reminder.leaseToken
  ) {
    return 'skipped';
  }

  if (latest.appointmentStatus !== 'CONFIRMED') {
    const wasCancelled =
      latest.appointmentStatus === 'CANCELLED' ||
      latest.appointmentStatus === 'COMPLETED' ||
      latest.appointmentStatus === 'NO_SHOW';
    const category = wasCancelled ? 'reminder_cancelled' : 'invalid_state';

    if (wasCancelled) {
      await repository.markReminderCancelled(
        latest.id,
        latest.leaseToken ?? reminder.leaseToken ?? '',
        category,
      );

      return 'cancelled';
    }

    await repository.markReminderDeadLetter(
      latest.id,
      latest.leaseToken ?? reminder.leaseToken ?? '',
      category,
    );

    return 'deadLettered';
  }

  if (latest.appointmentScheduleVersion !== latest.scheduleVersion) {
    await repository.supersedeAppointmentReminders(
      latest.appointmentId,
      latest.appointmentScheduleVersion,
    );

    return 'superseded';
  }

  if (latest.appointmentIsStarted) {
    await repository.markReminderDeadLetter(
      latest.id,
      latest.leaseToken ?? reminder.leaseToken ?? '',
      'appointment_started',
    );

    return 'deadLettered';
  }

  try {
    await adapter.deliverReminder({
      reminder: latest,
      workerId: config.workerId,
    });

    const delivered = await repository.markReminderDelivered(
      latest.id,
      latest.leaseToken ?? reminder.leaseToken ?? '',
    );

    if (!delivered) {
      return 'skipped';
    }

    return 'delivered';
  } catch (error) {
    const category = getErrorCategory(error);
    const attemptCount = latest.attemptCount;
    const exhausted =
      attemptCount >= latest.maxAttempts || attemptCount >= config.maxAttempts;
    const nextAvailableAt = new Date(
      config.now().getTime() +
        computeReminderBackoffMs(
          attemptCount,
          config.backoffBaseMs,
          config.backoffCapMs,
        ),
    );

    if (
      exhausted ||
      nextAvailableAt.getTime() >=
        new Date(latest.appointmentScheduledStart).getTime() ||
      !isReminderDeliveryError(error) ||
      !error.retryable
    ) {
      await repository.markReminderDeadLetter(
        latest.id,
        latest.leaseToken ?? reminder.leaseToken ?? '',
        category,
      );

      return 'deadLettered';
    }

    const retried = await repository.markReminderRetry(
      latest.id,
      latest.leaseToken ?? reminder.leaseToken ?? '',
      nextAvailableAt.toISOString(),
      category,
    );

    if (!retried) {
      return 'skipped';
    }

    return 'retried';
  }
}

export async function processReminderCycle(
  dependencies: ReminderWorkerDependencies,
): Promise<ReminderProcessingSummary> {
  const now = dependencies.now();
  const deadLettered =
    await dependencies.repository.deadLetterExhaustedReminders();
  const claimed = await dependencies.repository.claimDueReminders({
    workerId: dependencies.workerId,
    batchSize: dependencies.batchSize,
    now: now.toISOString(),
    leaseUntil: new Date(now.getTime() + dependencies.leaseMs).toISOString(),
  });
  const summary: ReminderProcessingSummary = {
    claimedCount: claimed.length,
    deliveredCount: 0,
    cancelledCount: 0,
    supersededCount: 0,
    retriedCount: 0,
    deadLetteredCount: deadLettered.length,
    skippedCount: 0,
  };

  for (const reminder of claimed) {
    const outcome = await processClaimedReminder(
      dependencies.repository,
      dependencies.adapter,
      dependencies,
      reminder,
    );

    switch (outcome) {
      case 'delivered':
        summary.deliveredCount += 1;
        break;
      case 'cancelled':
        summary.cancelledCount += 1;
        break;
      case 'superseded':
        summary.supersededCount += 1;
        break;
      case 'retried':
        summary.retriedCount += 1;
        break;
      case 'deadLettered':
        summary.deadLetteredCount += 1;
        break;
      case 'skipped':
        summary.skippedCount += 1;
        break;
    }
  }

  dependencies.logger.info(
    OBSERVABILITY_EVENT_CODES.reminderCycleCompleted,
    summary,
  );
  return summary;
}

export async function runReminderWorker(
  dependencies: ReminderWorkerDependencies,
  signal?: AbortSignal,
): Promise<void> {
  let running = true;
  let stoppingLogged = false;

  const stop = () => {
    running = false;
    if (!stoppingLogged) {
      stoppingLogged = true;
      dependencies.logger.info(
        OBSERVABILITY_EVENT_CODES.reminderWorkerStopping,
      );
    }
  };

  signal?.addEventListener('abort', stop, { once: true });
  dependencies.logger.info(OBSERVABILITY_EVENT_CODES.reminderWorkerStarted);

  try {
    while (running) {
      try {
        await processReminderCycle(dependencies);
      } catch (error) {
        void error;
        dependencies.logger.error(
          OBSERVABILITY_EVENT_CODES.reminderCycleFailed,
        );
      }

      if (!running || signal?.aborted) {
        break;
      }

      await sleep(dependencies.pollIntervalMs, signal);
    }
  } finally {
    signal?.removeEventListener('abort', stop);
    dependencies.logger.info(OBSERVABILITY_EVENT_CODES.reminderWorkerStopped);
  }
}

async function main() {
  const config = loadReminderWorkerConfig();
  const logger = createStructuredLogger({
    service: 'hakimi-reminder-worker',
    level: config.LOG_LEVEL,
  });
  const pool = createPostgresPool(config.DATABASE_URL);
  pool.on('error', () => {
    logger.error(OBSERVABILITY_EVENT_CODES.databasePoolError);
  });
  const repository = createReminderRepository(pool);
  const adapter = createDevelopmentReminderDeliveryAdapter();
  const abortController = new AbortController();

  const stop = () => {
    abortController.abort();
  };

  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);

  try {
    await runReminderWorker(
      {
        repository,
        adapter,
        logger,
        workerId: config.REMINDER_WORKER_ID,
        pollIntervalMs: config.REMINDER_POLL_INTERVAL_MS,
        batchSize: config.REMINDER_BATCH_SIZE,
        leaseMs: config.REMINDER_LEASE_MS,
        maxAttempts: config.REMINDER_MAX_ATTEMPTS,
        backoffBaseMs: config.REMINDER_BACKOFF_BASE_MS,
        backoffCapMs: config.REMINDER_BACKOFF_CAP_MS,
        now: () => new Date(),
      },
      abortController.signal,
    );
  } finally {
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
    await closePostgresPool(pool);
  }
}

const isMainModule =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  void main().catch((error: unknown) => {
    void error;
    const logger = createStructuredLogger({
      service: 'hakimi-reminder-worker',
      level: 'error',
    });
    logger.error(OBSERVABILITY_EVENT_CODES.reminderWorkerFailed);
    process.exitCode = 1;
  });
}
