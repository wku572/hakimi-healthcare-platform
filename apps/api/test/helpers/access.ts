import type { RequestHandler } from 'express';
import type { RouteAuthorizer } from '../../src/access/service.js';

export const allowAllAccessMiddleware: RequestHandler = (
  _request,
  _response,
  next,
) => {
  next();
};

export const allowAllScope = Object.freeze({
  actorId: '00000000-0000-4000-8000-000000000090',
  isPlatformAdmin: true,
  isPractitioner: false,
  practitionerId: null,
  facilityIds: Object.freeze([]),
});

export const allowAllRouteAuthorizer: RouteAuthorizer = {
  async authorize() {
    return Object.freeze({
      context: Object.freeze({
        actorId: '10000000-0000-4000-8000-000000000001',
        practitionerId: null,
        sessionId: '10000000-0000-4000-8000-000000000002',
        roles: Object.freeze([]),
        facilityScopes: Object.freeze([]),
      }),
      scope: allowAllScope,
    });
  },
  async revokeForFacility() {},
  async revokeForPractitioner() {},
  async revokeForAssignment() {},
};
