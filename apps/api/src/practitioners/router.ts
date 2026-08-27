import {
  Router,
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import type { PractitionerService } from './service.js';
import {
  denyRouteAuthorizer,
  type RouteAuthorizer,
} from '../access/service.js';
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

export function createPractitionersRouter(
  service: PractitionerService,
  authorizer: RouteAuthorizer = denyRouteAuthorizer,
) {
  const router = Router();

  router.post(
    '/',
    wrapAsync(async (request, response) => {
      const input = parseCreatePractitionerInput(request.body);
      await authorizer.authorize(response, 'createPractitioner', input);
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
      const authorization = await authorizer.authorize(
        response,
        'listPractitioners',
      );
      const practitioners = await service.listPractitioners(
        query,
        authorization.scope,
      );

      response.status(200).json(practitioners);
    }),
  );

  router.get(
    '/:practitionerId',
    wrapAsync(async (request, response) => {
      const { practitionerId } = parsePractitionerIdParam(request.params);
      await authorizer.authorize(response, 'getPractitionerById', undefined, {
        practitionerId,
      });
      const practitioner = await service.getPractitionerById(practitionerId);

      response.status(200).json(practitioner);
    }),
  );

  router.patch(
    '/:practitionerId',
    wrapAsync(async (request, response) => {
      const { practitionerId } = parsePractitionerIdParam(request.params);
      const input = parseUpdatePractitionerInput(request.body);
      await authorizer.authorize(response, 'updatePractitioner', input, {
        practitionerId,
      });
      const practitioner = await service.updatePractitioner(
        practitionerId,
        input,
      );

      if (input.isActive !== undefined) {
        await authorizer.revokeForPractitioner(practitionerId);
      }

      response.status(200).json(practitioner);
    }),
  );

  router.delete(
    '/:practitionerId',
    wrapAsync(async (request, response) => {
      const { practitionerId } = parsePractitionerIdParam(request.params);
      await authorizer.authorize(
        response,
        'deactivatePractitioner',
        undefined,
        { practitionerId },
      );
      await service.deletePractitioner(practitionerId);
      await authorizer.revokeForPractitioner(practitionerId);

      response.status(204).send();
    }),
  );

  router.post(
    '/:practitionerId/facilities',
    wrapAsync(async (request, response) => {
      const { practitionerId } = parsePractitionerIdParam(request.params);
      const input = parseCreatePractitionerAssignmentInput(request.body);
      await authorizer.authorize(
        response,
        'createPractitionerAssignment',
        input,
        { practitionerId, facilityId: input.facilityId },
      );
      const assignment = await service.createAssignment(practitionerId, input);
      await authorizer.revokeForAssignment(assignment.id);

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
      const authorization = await authorizer.authorize(
        response,
        'listPractitionerAssignments',
        undefined,
        { practitionerId },
      );
      const assignments = await service.listAssignments(
        practitionerId,
        authorization.scope,
      );

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
      await authorizer.authorize(
        response,
        'updatePractitionerAssignment',
        input,
        { practitionerId, assignmentId },
      );
      const assignment = await service.updateAssignment(
        practitionerId,
        assignmentId,
        input,
      );

      if (input.isActive !== undefined) {
        await authorizer.revokeForAssignment(assignmentId);
      }

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
      await authorizer.authorize(
        response,
        'deactivatePractitionerAssignment',
        undefined,
        { practitionerId, assignmentId },
      );
      await service.deleteAssignment(practitionerId, assignmentId);
      await authorizer.revokeForAssignment(assignmentId);

      response.status(204).send();
    }),
  );

  return router;
}
