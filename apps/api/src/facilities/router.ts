import {
  Router,
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import type { HealthcareFacilityService } from './service.js';
import {
  denyRouteAuthorizer,
  type RouteAuthorizer,
} from '../access/service.js';
import {
  parseCreateHealthcareFacilityInput,
  parseFacilityIdParam,
  parseHealthcareFacilityListQuery,
  parseUpdateHealthcareFacilityInput,
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

export function createFacilitiesRouter(
  service: HealthcareFacilityService,
  authorizer: RouteAuthorizer = denyRouteAuthorizer,
) {
  const router = Router();

  router.post(
    '/',
    wrapAsync(async (request, response) => {
      const input = parseCreateHealthcareFacilityInput(request.body);
      await authorizer.authorize(response, 'createHealthcareFacility', input);
      const facility = await service.createFacility(input);

      response
        .status(201)
        .location(`/api/v1/facilities/${facility.id}`)
        .json(facility);
    }),
  );

  router.get(
    '/',
    wrapAsync(async (request, response) => {
      const query = parseHealthcareFacilityListQuery(request.query);
      const authorization = await authorizer.authorize(
        response,
        'listHealthcareFacilities',
      );
      const facilities = await service.listFacilities(
        query,
        authorization.scope,
      );

      response.status(200).json(facilities);
    }),
  );

  router.get(
    '/:id',
    wrapAsync(async (request, response) => {
      const { id } = parseFacilityIdParam(request.params);
      await authorizer.authorize(
        response,
        'getHealthcareFacilityById',
        undefined,
        {
          facilityId: id,
        },
      );
      const facility = await service.getFacilityById(id);

      response.status(200).json(facility);
    }),
  );

  router.patch(
    '/:id',
    wrapAsync(async (request, response) => {
      const { id } = parseFacilityIdParam(request.params);
      const input = parseUpdateHealthcareFacilityInput(request.body);
      await authorizer.authorize(response, 'updateHealthcareFacility', input, {
        facilityId: id,
      });
      const facility = await service.updateFacility(id, input);

      if (input.isActive !== undefined) {
        await authorizer.revokeForFacility(id);
      }

      response.status(200).json(facility);
    }),
  );

  router.delete(
    '/:id',
    wrapAsync(async (request, response) => {
      const { id } = parseFacilityIdParam(request.params);
      await authorizer.authorize(
        response,
        'deactivateHealthcareFacility',
        undefined,
        { facilityId: id },
      );
      await service.deleteFacility(id);
      await authorizer.revokeForFacility(id);

      response.status(204).send();
    }),
  );

  return router;
}
