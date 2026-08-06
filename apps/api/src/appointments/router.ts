import type { Router } from 'express';
import { Router as createRouter } from 'express';
import {
  parseAppointmentIdParam,
  parseCancelAppointmentInput,
  parseCreateAppointmentInput,
  parseListAppointmentsQuery,
  parseUpdateAppointmentInput,
} from './schemas.js';
import type { AppointmentService } from './service.js';

export function createAppointmentsRouter(service: AppointmentService): Router {
  const router = createRouter();

  router.post('/', async (request, response, next) => {
    try {
      const input = parseCreateAppointmentInput(request.body);
      const appointment = await service.createAppointment(input);

      response
        .status(201)
        .location(`/api/v1/appointments/${appointment.id}`)
        .json(appointment);
    } catch (error) {
      next(error);
    }
  });

  router.get('/', async (request, response, next) => {
    try {
      const query = parseListAppointmentsQuery(request.query);
      const appointments = await service.listAppointments(query);

      response.status(200).json(appointments);
    } catch (error) {
      next(error);
    }
  });

  router.get('/:appointmentId', async (request, response, next) => {
    try {
      const { appointmentId } = parseAppointmentIdParam(request.params);
      const appointment = await service.getAppointmentById(appointmentId);

      response.status(200).json(appointment);
    } catch (error) {
      next(error);
    }
  });

  router.patch('/:appointmentId', async (request, response, next) => {
    try {
      const { appointmentId } = parseAppointmentIdParam(request.params);
      const input = parseUpdateAppointmentInput(request.body);
      const appointment = await service.updateAppointment(appointmentId, input);

      response.status(200).json(appointment);
    } catch (error) {
      next(error);
    }
  });

  router.post('/:appointmentId/cancel', async (request, response, next) => {
    try {
      const { appointmentId } = parseAppointmentIdParam(request.params);
      const input = parseCancelAppointmentInput(request.body);
      const appointment = await service.cancelAppointment(appointmentId, input);

      response.status(200).json(appointment);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
