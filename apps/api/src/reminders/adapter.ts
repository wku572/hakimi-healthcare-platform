import type { AppointmentReminderProcessingContext } from './types.js';

export type ReminderDeliveryAdapter = {
  deliverReminder(input: {
    reminder: AppointmentReminderProcessingContext;
    workerId: string;
  }): Promise<void>;
};

export function createDevelopmentReminderDeliveryAdapter(
  logger: Pick<Console, 'info'>,
): ReminderDeliveryAdapter {
  return {
    async deliverReminder({ reminder, workerId }) {
      logger.info(
        `Reminder delivered [opaque] reminderId=${reminder.id} appointmentId=${reminder.appointmentId} workerId=${workerId} scheduleVersion=${reminder.scheduleVersion} attemptCount=${reminder.attemptCount}`,
      );
    },
  };
}
