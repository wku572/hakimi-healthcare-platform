import {
  Router,
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import type { PatientService } from './service.js';
import {
  denyRouteAuthorizer,
  type RouteAuthorizer,
} from '../access/service.js';
import {
  parseCreatePatientInput,
  parseListPatientsQuery,
  parsePatientIdParam,
  parseUpdatePatientInput,
} from './schemas.js';

type AsyncHandler = (
  request: Request,
  response: Response,
  next: NextFunction,
) => Promise<void>;

function wrapAsync(handler: AsyncHandler) {
  return (request: Request, response: Response, next: NextFunction) => {
    void handler(request, response, next).catch(next);
  };
}

export function createPatientsRouter(
  service: PatientService,
  authorizer: RouteAuthorizer = denyRouteAuthorizer,
) {
  const router = Router();

  router.post(
    '/',
    wrapAsync(async (request, response) => {
      const input = parseCreatePatientInput(request.body);
      await authorizer.authorize(response, 'createPatient', input, {
        facilityId: input.facilityId,
      });
      const patient = await service.createPatient(input);

      response
        .status(201)
        .location(`/api/v1/patients/${patient.id}`)
        .json(patient);
    }),
  );

  router.get(
    '/',
    wrapAsync(async (request, response) => {
      const query = parseListPatientsQuery(request.query);
      const authorization = await authorizer.authorize(
        response,
        'listPatients',
      );
      const patients = await service.listPatients(query, authorization.scope);

      response.status(200).json(patients);
    }),
  );

  router.get(
    '/:patientId',
    wrapAsync(async (request, response) => {
      const { patientId } = parsePatientIdParam(request.params);
      const authorization = await authorizer.authorize(
        response,
        'getPatientById',
        undefined,
        { patientId },
      );
      const patient = await service.getPatientById(
        patientId,
        authorization.scope,
      );

      response.status(200).json(patient);
    }),
  );

  router.patch(
    '/:patientId',
    wrapAsync(async (request, response) => {
      const { patientId } = parsePatientIdParam(request.params);
      const input = parseUpdatePatientInput(request.body);
      const authorization = await authorizer.authorize(
        response,
        'updatePatient',
        input,
        { patientId },
      );
      const patient = await service.updatePatient(
        patientId,
        input,
        authorization.scope,
      );

      response.status(200).json(patient);
    }),
  );

  router.delete(
    '/:patientId',
    wrapAsync(async (request, response) => {
      const { patientId } = parsePatientIdParam(request.params);
      await authorizer.authorize(response, 'deactivatePatient', undefined, {
        patientId,
      });
      await service.deletePatient(patientId);

      response.status(204).send();
    }),
  );

  return router;
}
