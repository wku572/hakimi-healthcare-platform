export type ReminderDeliveryErrorCategory =
  | 'transient_delivery_failure'
  | 'permanent_delivery_failure'
  | 'invalid_state'
  | 'stale_schedule_version'
  | 'appointment_started'
  | 'lease_mismatch'
  | 'reminder_cancelled'
  | 'reminder_superseded'
  | 'attempts_exhausted';

export class ReminderDeliveryError extends Error {
  public readonly category: ReminderDeliveryErrorCategory;

  public readonly retryable: boolean;

  constructor(
    category: ReminderDeliveryErrorCategory,
    message: string,
    retryable: boolean,
  ) {
    super(message);
    this.name = 'ReminderDeliveryError';
    this.category = category;
    this.retryable = retryable;
  }
}

export function isReminderDeliveryError(
  error: unknown,
): error is ReminderDeliveryError {
  return error instanceof ReminderDeliveryError;
}

export function computeReminderBackoffMs(
  attemptCount: number,
  baseMs: number,
  capMs: number,
) {
  const exponent = Math.max(0, attemptCount - 1);
  const delayMs = baseMs * Math.pow(2, exponent);
  return Math.min(delayMs, capMs);
}
