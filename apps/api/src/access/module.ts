import type { Pool } from 'pg';
import type { AccessRuntimeEnvironment } from '../env.js';
import type { ObservabilityLogger } from '../observability/logger.js';
import { createAccessAuthenticationMiddleware } from './middleware.js';
import { createOidcVerifier } from './oidc-verifier.js';
import { createAccessRepository } from './repository.js';
import { createAccessService, createRouteAuthorizer } from './service.js';

export function createAccessModule(
  db: Pick<Pool, 'query' | 'connect'>,
  environment: AccessRuntimeEnvironment,
  logger: ObservabilityLogger,
) {
  const repository = createAccessRepository(db);
  const service = createAccessService(repository, logger);
  const verifier = createOidcVerifier(environment);
  const authenticationMiddleware = createAccessAuthenticationMiddleware(
    verifier,
    service,
    logger,
  );
  const routeAuthorizer = createRouteAuthorizer(service);

  return {
    repository,
    service,
    verifier,
    authenticationMiddleware,
    routeAuthorizer,
  };
}
