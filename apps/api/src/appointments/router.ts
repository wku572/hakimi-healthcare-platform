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
import {
  denyRouteAuthorizer,
  type RouteAuthorizer,
} from '../access/service.js';

export function createAppointmentsRouter(
  service: AppointmentService,
  authorizer: RouteAuthorizer = denyRouteAuthorizer,
): Router {
  const router = createRouter();

  router.post('/', async (request, response, next) => {
    try {
      const input = parseCreateAppointmentInput(request.body);
      await authorizer.authorize(response, 'createAppointment', input, {
        facilityId: input.facilityId,
        practitionerId: input.practitionerId,
        patientId: input.patientId,
      });
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
      const authorization = await authorizer.authorize(
        response,
        'listAppointments',
      );
      const appointments = await service.listAppointments(
        query,
        authorization.scope,
      );

      response.status(200).json(appointments);
    } catch (error) {
      next(error);
    }
  });

  router.get('/:appointmentId', async (request, response, next) => {
    try {
      const { appointmentId } = parseAppointmentIdParam(request.params);
      await authorizer.authorize(response, 'getAppointmentById', undefined, {
        appointmentId,
      });
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
      await authorizer.authorize(response, 'updateAppointment', input, {
        appointmentId,
      });
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
      await authorizer.authorize(response, 'cancelAppointment', input, {
        appointmentId,
      });
      const appointment = await service.cancelAppointment(appointmentId, input);

      response.status(200).json(appointment);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
