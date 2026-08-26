import { describe, expect, it, vi } from 'vitest';
import {
  ReminderDeliveryError,
  computeReminderBackoffMs,
} from '../src/reminders/service.js';
import {
  processReminderCycle,
  runReminderWorker,
} from '../src/reminders/worker.js';
import { createStructuredLogger } from '../src/observability/logger.js';

const appointmentId = '11111111-1111-4111-8111-111111111111';
const reminderId = '22222222-2222-4222-8222-222222222222';
const leaseToken = '33333333-3333-4333-8333-333333333333';

function createReminderContext(overrides = {}) {
  return {
    id: reminderId,
    appointmentId,
    reminderKind: 'APPOINTMENT_24H' as const,
    scheduleVersion: 1,
    idempotencyKey: `${appointmentId}:APPOINTMENT_24H:1`,
    availableAt: '2026-08-07T06:00:00.000Z',
    status: 'PROCESSING' as const,
    attemptCount: 1,
    maxAttempts: 5,
    lockedAt: '2026-08-07T05:59:00.000Z',
    lockedUntil: '2026-08-07T06:59:00.000Z',
    lockedBy: 'test-worker',
    leaseToken,
    lastErrorCategory: null,
    deliveredAt: null,
    cancelledAt: null,
    supersededAt: null,
    deadLetteredAt: null,
    createdAt: '2026-08-07T05:58:00.000Z',
    updatedAt: '2026-08-07T05:59:00.000Z',
    appointmentScheduleVersion: 1,
    appointmentStatus: 'CONFIRMED' as const,
    appointmentScheduledStart: '2026-08-08T06:00:00.000Z',
    appointmentScheduledEnd: '2026-08-08T06:30:00.000Z',
    appointmentIsStarted: false,
    ...overrides,
  };
}

function createRepositoryMock() {
  return {
    withTransaction: vi.fn(),
    createAppointmentReminder: vi.fn(),
    findAppointmentReminderById: vi.fn(),
    findAppointmentReminderProcessingContextById: vi.fn(),
    claimDueReminders: vi.fn(),
    cancelActiveAppointmentReminders: vi.fn(),
    supersedeAppointmentReminders: vi.fn(),
    markReminderDelivered: vi.fn(),
    markReminderRetry: vi.fn(),
    markReminderCancelled: vi.fn(),
    markReminderDeadLetter: vi.fn(),
    deadLetterExhaustedReminders: vi.fn(),
  };
}

function createAdapterMock() {
  return {
    deliverReminder: vi.fn(),
  };
}

describe('reminder worker', () => {
  it('delivers eligible reminders and finalizes the row', async () => {
    const repository = createRepositoryMock();
    const adapter = createAdapterMock();
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    repository.deadLetterExhaustedReminders.mockResolvedValue([]);
    repository.claimDueReminders.mockResolvedValue([createReminderContext()]);
    repository.findAppointmentReminderProcessingContextById.mockResolvedValue(
      createReminderContext(),
    );
    adapter.deliverReminder.mockResolvedValue(undefined);
    repository.markReminderDelivered.mockResolvedValue(true);

    await processReminderCycle({
      repository,
      adapter,
      logger,
      workerId: 'worker-1',
      pollIntervalMs: 1_000,
      batchSize: 10,
      leaseMs: 120_000,
      maxAttempts: 5,
      backoffBaseMs: 60_000,
      backoffCapMs: 3_600_000,
      now: () => new Date('2026-08-07T12:00:00.000Z'),
    });

    expect(adapter.deliverReminder).toHaveBeenCalledWith({
      reminder: expect.objectContaining({
        id: reminderId,
        leaseToken,
      }),
      workerId: 'worker-1',
    });
    expect(repository.markReminderDelivered).toHaveBeenCalledWith(
      reminderId,
      leaseToken,
    );
    expect(repository.markReminderCancelled).not.toHaveBeenCalled();
    expect(repository.markReminderDeadLetter).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith('REMINDER_CYCLE_COMPLETED', {
      claimedCount: 1,
      deliveredCount: 1,
      cancelledCount: 0,
      supersededCount: 0,
      retriedCount: 0,
      deadLetteredCount: 0,
      skippedCount: 0,
    });
  });

  it('cancels reminders when the appointment is cancelled before delivery', async () => {
    const repository = createRepositoryMock();
    const adapter = createAdapterMock();
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    repository.deadLetterExhaustedReminders.mockResolvedValue([]);
    repository.claimDueReminders.mockResolvedValue([createReminderContext()]);
    repository.findAppointmentReminderProcessingContextById.mockResolvedValue(
      createReminderContext({ appointmentStatus: 'CANCELLED' }),
    );
    repository.markReminderCancelled.mockResolvedValue(true);

    await processReminderCycle({
      repository,
      adapter,
      logger,
      workerId: 'worker-1',
      pollIntervalMs: 1_000,
      batchSize: 10,
      leaseMs: 120_000,
      maxAttempts: 5,
      backoffBaseMs: 60_000,
      backoffCapMs: 3_600_000,
      now: () => new Date('2026-08-07T12:00:00.000Z'),
    });

    expect(repository.markReminderCancelled).toHaveBeenCalledWith(
      reminderId,
      leaseToken,
      'reminder_cancelled',
    );
    expect(adapter.deliverReminder).not.toHaveBeenCalled();
    expect(repository.markReminderDeadLetter).not.toHaveBeenCalled();
  });

  it('supersedes stale reminders before delivery', async () => {
    const repository = createRepositoryMock();
    const adapter = createAdapterMock();
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    repository.deadLetterExhaustedReminders.mockResolvedValue([]);
    repository.claimDueReminders.mockResolvedValue([createReminderContext()]);
    repository.findAppointmentReminderProcessingContextById.mockResolvedValue(
      createReminderContext({ appointmentScheduleVersion: 2 }),
    );
    repository.supersedeAppointmentReminders.mockResolvedValue(1);

    await processReminderCycle({
      repository,
      adapter,
      logger,
      workerId: 'worker-1',
      pollIntervalMs: 1_000,
      batchSize: 10,
      leaseMs: 120_000,
      maxAttempts: 5,
      backoffBaseMs: 60_000,
      backoffCapMs: 3_600_000,
      now: () => new Date('2026-08-07T12:00:00.000Z'),
    });

    expect(repository.supersedeAppointmentReminders).toHaveBeenCalledWith(
      appointmentId,
      2,
    );
    expect(adapter.deliverReminder).not.toHaveBeenCalled();
    expect(repository.markReminderDeadLetter).not.toHaveBeenCalled();
  });

  it('retries transient failures with exponential backoff', async () => {
    const repository = createRepositoryMock();
    const adapter = createAdapterMock();
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    repository.deadLetterExhaustedReminders.mockResolvedValue([]);
    repository.claimDueReminders.mockResolvedValue([createReminderContext()]);
    repository.findAppointmentReminderProcessingContextById.mockResolvedValue(
      createReminderContext({ attemptCount: 1 }),
    );
    adapter.deliverReminder.mockRejectedValue(
      new ReminderDeliveryError(
        'transient_delivery_failure',
        'provider unavailable',
        true,
      ),
    );
    repository.markReminderRetry.mockResolvedValue(true);

    await processReminderCycle({
      repository,
      adapter,
      logger,
      workerId: 'worker-1',
      pollIntervalMs: 1_000,
      batchSize: 10,
      leaseMs: 120_000,
      maxAttempts: 5,
      backoffBaseMs: 60_000,
      backoffCapMs: 3_600_000,
      now: () => new Date('2026-08-07T12:00:00.000Z'),
    });

    expect(repository.markReminderRetry).toHaveBeenCalledWith(
      reminderId,
      leaseToken,
      '2026-08-07T12:01:00.000Z',
      'transient_delivery_failure',
    );
    expect(repository.markReminderDeadLetter).not.toHaveBeenCalled();
  });

  it('dead-letters permanent failures and exhausted retries', async () => {
    const permanentRepository = createRepositoryMock();
    const permanentAdapter = createAdapterMock();
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    permanentRepository.deadLetterExhaustedReminders.mockResolvedValue([]);
    permanentRepository.claimDueReminders.mockResolvedValue([
      createReminderContext({ attemptCount: 2 }),
    ]);
    permanentRepository.findAppointmentReminderProcessingContextById.mockResolvedValue(
      createReminderContext({ attemptCount: 2 }),
    );
    permanentAdapter.deliverReminder.mockRejectedValue(
      new ReminderDeliveryError(
        'permanent_delivery_failure',
        'provider rejected payload',
        false,
      ),
    );
    permanentRepository.markReminderDeadLetter.mockResolvedValue(true);

    await processReminderCycle({
      repository: permanentRepository,
      adapter: permanentAdapter,
      logger,
      workerId: 'worker-1',
      pollIntervalMs: 1_000,
      batchSize: 10,
      leaseMs: 120_000,
      maxAttempts: 5,
      backoffBaseMs: 60_000,
      backoffCapMs: 3_600_000,
      now: () => new Date('2026-08-07T12:00:00.000Z'),
    });

    expect(permanentRepository.markReminderDeadLetter).toHaveBeenCalledWith(
      reminderId,
      leaseToken,
      'permanent_delivery_failure',
    );
    expect(permanentRepository.markReminderRetry).not.toHaveBeenCalled();

    const exhaustedRepository = createRepositoryMock();
    const exhaustedAdapter = createAdapterMock();
    exhaustedRepository.deadLetterExhaustedReminders.mockResolvedValue([]);
    exhaustedRepository.claimDueReminders.mockResolvedValue([
      createReminderContext({ attemptCount: 5 }),
    ]);
    exhaustedRepository.findAppointmentReminderProcessingContextById.mockResolvedValue(
      createReminderContext({ attemptCount: 5 }),
    );
    exhaustedAdapter.deliverReminder.mockRejectedValue(
      new ReminderDeliveryError(
        'transient_delivery_failure',
        'still failing',
        true,
      ),
    );
    exhaustedRepository.markReminderDeadLetter.mockResolvedValue(true);

    await processReminderCycle({
      repository: exhaustedRepository,
      adapter: exhaustedAdapter,
      logger,
      workerId: 'worker-1',
      pollIntervalMs: 1_000,
      batchSize: 10,
      leaseMs: 120_000,
      maxAttempts: 5,
      backoffBaseMs: 60_000,
      backoffCapMs: 3_600_000,
      now: () => new Date('2026-08-07T12:00:00.000Z'),
    });

    expect(exhaustedRepository.markReminderDeadLetter).toHaveBeenCalledWith(
      reminderId,
      leaseToken,
      'transient_delivery_failure',
    );
    expect(exhaustedRepository.markReminderRetry).not.toHaveBeenCalled();
  });

  it('stops gracefully when aborted', async () => {
    const repository = createRepositoryMock();
    const adapter = createAdapterMock();
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    repository.deadLetterExhaustedReminders.mockResolvedValue([]);
    repository.claimDueReminders.mockResolvedValue([]);

    const controller = new AbortController();
    const runPromise = runReminderWorker(
      {
        repository,
        adapter,
        logger,
        workerId: 'worker-1',
        pollIntervalMs: 1_000,
        batchSize: 10,
        leaseMs: 120_000,
        maxAttempts: 5,
        backoffBaseMs: 60_000,
        backoffCapMs: 3_600_000,
        now: () => new Date('2026-08-07T12:00:00.000Z'),
      },
      controller.signal,
    );

    controller.abort();
    await expect(runPromise).resolves.toBeUndefined();
    expect(logger.info).toHaveBeenCalledWith('REMINDER_WORKER_STARTED');
    expect(logger.info).toHaveBeenCalledWith('REMINDER_WORKER_STOPPING');
    expect(logger.info).toHaveBeenCalledWith('REMINDER_WORKER_STOPPED');
  });

  it('logs cycle failures without raw errors and stops cleanly', async () => {
    const repository = createRepositoryMock();
    const adapter = createAdapterMock();
    const controller = new AbortController();
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(() => controller.abort()),
    };
    repository.deadLetterExhaustedReminders.mockRejectedValue(
      new Error('patient@example.org provider secret'),
    );

    await runReminderWorker(
      {
        repository,
        adapter,
        logger,
        workerId: 'patient@example.org',
        pollIntervalMs: 1_000,
        batchSize: 10,
        leaseMs: 120_000,
        maxAttempts: 5,
        backoffBaseMs: 60_000,
        backoffCapMs: 3_600_000,
        now: () => new Date('2026-08-07T12:00:00.000Z'),
      },
      controller.signal,
    );

    expect(logger.error).toHaveBeenCalledWith('REMINDER_CYCLE_FAILED');
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain(
      'patient@example.org',
    );
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain('secret');
  });

  it('emits only aggregate cycle fields without reminder-level identifiers', async () => {
    const repository = createRepositoryMock();
    const adapter = createAdapterMock();
    const stdout: string[] = [];
    const stderr: string[] = [];
    const logger = createStructuredLogger({
      service: 'hakimi-reminder-worker',
      level: 'info',
      sink: {
        stdout: (line) => stdout.push(line),
        stderr: (line) => stderr.push(line),
      },
      now: () => new Date('2026-08-07T12:00:00.000Z'),
    });
    repository.deadLetterExhaustedReminders.mockResolvedValue([]);
    repository.claimDueReminders.mockResolvedValue([createReminderContext()]);
    repository.findAppointmentReminderProcessingContextById.mockResolvedValue(
      createReminderContext(),
    );
    repository.markReminderDelivered.mockResolvedValue(true);
    adapter.deliverReminder.mockResolvedValue(undefined);

    await processReminderCycle({
      repository,
      adapter,
      logger,
      workerId: 'patient@example.org',
      pollIntervalMs: 1_000,
      batchSize: 10,
      leaseMs: 120_000,
      maxAttempts: 5,
      backoffBaseMs: 60_000,
      backoffCapMs: 3_600_000,
      now: () => new Date('2026-08-07T12:00:00.000Z'),
    });

    expect(stderr).toEqual([]);
    expect(stdout).toHaveLength(1);
    expect(JSON.parse(stdout[0] ?? '{}')).toEqual({
      timestamp: '2026-08-07T12:00:00.000Z',
      severity: 'INFO',
      service: 'hakimi-reminder-worker',
      eventCode: 'REMINDER_CYCLE_COMPLETED',
      claimedCount: 1,
      deliveredCount: 1,
      cancelledCount: 0,
      supersededCount: 0,
      retriedCount: 0,
      deadLetteredCount: 0,
      skippedCount: 0,
    });
    const output = stdout.join(' ');
    expect(output).not.toContain(reminderId);
    expect(output).not.toContain(appointmentId);
    expect(output).not.toContain(leaseToken);
    expect(output).not.toContain('patient@example.org');
  });
});

describe('reminder retry helpers', () => {
  it('computes exponential backoff within the configured cap', () => {
    expect(computeReminderBackoffMs(1, 60_000, 3_600_000)).toBe(60_000);
    expect(computeReminderBackoffMs(3, 60_000, 3_600_000)).toBe(240_000);
    expect(computeReminderBackoffMs(10, 60_000, 3_600_000)).toBe(3_600_000);
  });
});
