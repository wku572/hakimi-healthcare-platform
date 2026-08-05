import {
  Router,
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import type { PractitionerService } from './service.js';
import {
  parseAssignmentIdParam,
  parseCreatePractitionerAssignmentInput,
  parseCreatePractitionerInput,
  parseListPractitionersQuery,
  parsePractitionerIdParam,
  parseUpdatePractitionerAssignmentInput,
  parseUpdatePractitionerInput,
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

export function createPractitionersRouter(service: PractitionerService) {
  const router = Router();

  router.post(
    '/',
    wrapAsync(async (request, response) => {
      const input = parseCreatePractitionerInput(request.body);
      const practitioner = await service.createPractitioner(input);

      response
        .status(201)
        .location(`/api/v1/practitioners/${practitioner.id}`)
        .json(practitioner);
    }),
  );

  router.get(
    '/',
    wrapAsync(async (request, response) => {
      const query = parseListPractitionersQuery(request.query);
      const practitioners = await service.listPractitioners(query);

      response.status(200).json(practitioners);
    }),
  );

  router.get(
    '/:practitionerId',
    wrapAsync(async (request, response) => {
      const { practitionerId } = parsePractitionerIdParam(request.params);
      const practitioner = await service.getPractitionerById(practitionerId);

      response.status(200).json(practitioner);
    }),
  );

  router.patch(
    '/:practitionerId',
    wrapAsync(async (request, response) => {
      const { practitionerId } = parsePractitionerIdParam(request.params);
      const input = parseUpdatePractitionerInput(request.body);
      const practitioner = await service.updatePractitioner(
        practitionerId,
        input,
      );

      response.status(200).json(practitioner);
    }),
  );

  router.delete(
    '/:practitionerId',
    wrapAsync(async (request, response) => {
      const { practitionerId } = parsePractitionerIdParam(request.params);
      await service.deletePractitioner(practitionerId);

      response.status(204).send();
    }),
  );

  router.post(
    '/:practitionerId/facilities',
    wrapAsync(async (request, response) => {
      const { practitionerId } = parsePractitionerIdParam(request.params);
      const input = parseCreatePractitionerAssignmentInput(request.body);
      const assignment = await service.createAssignment(practitionerId, input);

      response
        .status(201)
        .location(
          `/api/v1/practitioners/${practitionerId}/facilities/${assignment.id}`,
        )
        .json(assignment);
    }),
  );

  router.get(
    '/:practitionerId/facilities',
    wrapAsync(async (request, response) => {
      const { practitionerId } = parsePractitionerIdParam(request.params);
      const assignments = await service.listAssignments(practitionerId);

      response.status(200).json(assignments);
    }),
  );

  router.patch(
    '/:practitionerId/facilities/:assignmentId',
    wrapAsync(async (request, response) => {
      const { practitionerId } = parsePractitionerIdParam({
        practitionerId: request.params.practitionerId,
      });
      const { assignmentId } = parseAssignmentIdParam({
        assignmentId: request.params.assignmentId,
      });
      const input = parseUpdatePractitionerAssignmentInput(request.body);
      const assignment = await service.updateAssignment(
        practitionerId,
        assignmentId,
        input,
      );

      response.status(200).json(assignment);
    }),
  );

  router.delete(
    '/:practitionerId/facilities/:assignmentId',
    wrapAsync(async (request, response) => {
      const { practitionerId } = parsePractitionerIdParam({
        practitionerId: request.params.practitionerId,
      });
      const { assignmentId } = parseAssignmentIdParam({
        assignmentId: request.params.assignmentId,
      });
      await service.deleteAssignment(practitionerId, assignmentId);

      response.status(204).send();
    }),
  );

  return router;
}
