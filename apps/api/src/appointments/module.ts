import type { Pool } from 'pg';
import { createAppointmentsRouter } from './router.js';
import { createAppointmentRepository } from './repository.js';
import { createAppointmentService } from './service.js';
import { createReminderRepository } from '../reminders/repository.js';

export function createAppointmentsModule(db: Pick<Pool, 'query' | 'connect'>) {
  const repository = createAppointmentRepository(db);
  const reminderRepository = createReminderRepository(db);
  const service = createAppointmentService(repository, reminderRepository);
  const router = createAppointmentsRouter(service);

  return {
    repository,
    reminderRepository,
    service,
    router,
  };
}
