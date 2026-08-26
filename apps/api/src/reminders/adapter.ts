import type { AppointmentReminderProcessingContext } from './types.js';

export type ReminderDeliveryAdapter = {
  deliverReminder(input: {
    reminder: AppointmentReminderProcessingContext;
    workerId: string;
  }): Promise<void>;
};

export function createDevelopmentReminderDeliveryAdapter(): ReminderDeliveryAdapter {
  return {
    async deliverReminder(input) {
      void input;
    },
  };
}
