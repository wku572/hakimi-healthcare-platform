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

type ReminderWorkerLogger = Pick<Console, 'info' | 'warn' | 'error'>;

type ReminderWorkerDependencies = {
  repository: ReminderRepository;
  adapter: ReminderDeliveryAdapter;
  logger: ReminderWorkerLogger;
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
  claimed: number;
  deadLettered: number;
};

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
  logger: ReminderWorkerLogger,
  config: Pick<
    ReminderWorkerDependencies,
    'workerId' | 'backoffBaseMs' | 'backoffCapMs' | 'maxAttempts' | 'now'
  >,
  reminder: AppointmentReminderProcessingContext,
): Promise<void> {
  const latest = await repository.findAppointmentReminderProcessingContextById(
    reminder.id,
  );

  if (
    !latest ||
    latest.status !== 'PROCESSING' ||
    latest.leaseToken !== reminder.leaseToken
  ) {
    logger.warn(
      `Reminder skipped before delivery [opaque] reminderId=${reminder.id} appointmentId=${reminder.appointmentId} workerId=${config.workerId} state=lease_mismatch`,
    );
    return;
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

      logger.warn(
        `Reminder skipped before delivery [opaque] reminderId=${latest.id} appointmentId=${latest.appointmentId} workerId=${config.workerId} state=${category}`,
      );
      return;
    }

    await repository.markReminderDeadLetter(
      latest.id,
      latest.leaseToken ?? reminder.leaseToken ?? '',
      category,
    );

    logger.warn(
      `Reminder skipped before delivery [opaque] reminderId=${latest.id} appointmentId=${latest.appointmentId} workerId=${config.workerId} state=${category}`,
    );
    return;
  }

  if (latest.appointmentScheduleVersion !== latest.scheduleVersion) {
    await repository.supersedeAppointmentReminders(
      latest.appointmentId,
      latest.appointmentScheduleVersion,
    );

    logger.warn(
      `Reminder skipped before delivery [opaque] reminderId=${latest.id} appointmentId=${latest.appointmentId} workerId=${config.workerId} state=stale_schedule_version`,
    );
    return;
  }

  if (latest.appointmentIsStarted) {
    await repository.markReminderDeadLetter(
      latest.id,
      latest.leaseToken ?? reminder.leaseToken ?? '',
      'appointment_started',
    );

    logger.warn(
      `Reminder skipped before delivery [opaque] reminderId=${latest.id} appointmentId=${latest.appointmentId} workerId=${config.workerId} state=appointment_started`,
    );
    return;
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
      logger.warn(
        `Reminder delivery finalization skipped [opaque] reminderId=${latest.id} appointmentId=${latest.appointmentId} workerId=${config.workerId} state=lease_mismatch`,
      );
      return;
    }

    logger.info(
      `Reminder delivery completed [opaque] reminderId=${latest.id} appointmentId=${latest.appointmentId} workerId=${config.workerId} attemptCount=${latest.attemptCount}`,
    );
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

      logger.warn(
        `Reminder dead-lettered [opaque] reminderId=${latest.id} appointmentId=${latest.appointmentId} workerId=${config.workerId} state=${category} attemptCount=${latest.attemptCount}`,
      );
      return;
    }

    const retried = await repository.markReminderRetry(
      latest.id,
      latest.leaseToken ?? reminder.leaseToken ?? '',
      nextAvailableAt.toISOString(),
      category,
    );

    if (!retried) {
      logger.warn(
        `Reminder retry skipped [opaque] reminderId=${latest.id} appointmentId=${latest.appointmentId} workerId=${config.workerId} state=lease_mismatch`,
      );
      return;
    }

    logger.warn(
      `Reminder retry scheduled [opaque] reminderId=${latest.id} appointmentId=${latest.appointmentId} workerId=${config.workerId} attemptCount=${latest.attemptCount} nextAvailableAt=${nextAvailableAt.toISOString()} state=${category}`,
    );
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

  for (const reminder of claimed) {
    await processClaimedReminder(
      dependencies.repository,
      dependencies.adapter,
      dependencies.logger,
      dependencies,
      reminder,
    );
  }

  return {
    claimed: claimed.length,
    deadLettered: deadLettered.length,
  };
}

export async function runReminderWorker(
  dependencies: ReminderWorkerDependencies,
  signal?: AbortSignal,
): Promise<void> {
  let running = true;

  const stop = () => {
    running = false;
  };

  signal?.addEventListener('abort', stop, { once: true });

  while (running) {
    try {
      await processReminderCycle(dependencies);
    } catch (error) {
      void error;
      dependencies.logger.error(
        `Reminder worker cycle failed [opaque] workerId=${dependencies.workerId}`,
      );
    }

    if (!running || signal?.aborted) {
      break;
    }

    await sleep(dependencies.pollIntervalMs, signal);
  }
}

async function main() {
  const config = loadReminderWorkerConfig();
  const pool = createPostgresPool(config.DATABASE_URL);
  const repository = createReminderRepository(pool);
  const adapter = createDevelopmentReminderDeliveryAdapter(console);
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
        logger: console,
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
    console.error('Reminder worker failed [opaque]');
    process.exitCode = 1;
  });
}
