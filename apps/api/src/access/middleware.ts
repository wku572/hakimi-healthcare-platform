import type { RequestHandler } from 'express';
import {
  createAuthenticationRequiredError,
  createForbiddenError,
  isApiError,
} from '../http/api-error.js';
import {
  getRequestId,
  normalizeRouteTemplate,
} from '../http/request-observability.js';
import {
  OBSERVABILITY_EVENT_CODES,
  type ObservabilityLogger,
} from '../observability/logger.js';
import type { OidcVerifier } from './oidc-verifier.js';
import { assertCoarseAuthorization, findProtectedOperation } from './policy.js';
import type { AccessService } from './service.js';

export function createAccessAuthenticationMiddleware(
  verifier: OidcVerifier,
  service: AccessService,
  logger: ObservabilityLogger,
): RequestHandler {
  return (request, response, next) => {
    void (async () => {
      const requestId = getRequestId(response);

      try {
        if (!request.path.startsWith('/api/v1/')) {
          next();
          return;
        }

        const route = normalizeRouteTemplate(request.method, request.path);
        const operation = findProtectedOperation(request.method, route);

        if (!operation) {
          throw createForbiddenError();
        }

        const identity = await verifier.verifyAuthorizationHeader(
          request.headers.authorization,
        );
        const candidate = await service.resolveCandidate(identity);
        assertCoarseAuthorization(candidate, operation);

        response.locals.authorizationCandidate = candidate;
        response.locals.protectedOperation = operation;
        next();
      } catch (error) {
        if (!isApiError(error)) {
          logger.error(OBSERVABILITY_EVENT_CODES.authenticationRejected, {
            ...(requestId ? { requestId } : {}),
            errorCode: 'INTERNAL_ERROR',
          });
          next(error);
          return;
        }

        const errorCode = error.code;
        logger.warn(
          errorCode === 'FORBIDDEN'
            ? OBSERVABILITY_EVENT_CODES.authorizationDenied
            : OBSERVABILITY_EVENT_CODES.authenticationRejected,
          {
            ...(requestId ? { requestId } : {}),
            errorCode:
              errorCode === 'FORBIDDEN'
                ? 'FORBIDDEN'
                : 'AUTHENTICATION_REQUIRED',
          },
        );
        next(
          errorCode === 'FORBIDDEN'
            ? createForbiddenError()
            : createAuthenticationRequiredError(),
        );
      }
    })();
  };
}
