import type { Router } from 'express';
import express from 'express';
import { createApiErrorHandler } from './http/error-middleware.js';
import { createRequestObservabilityMiddleware } from './http/request-observability.js';
import {
  OBSERVABILITY_EVENT_CODES,
  noopObservabilityLogger,
  type ObservabilityLogger,
} from './observability/logger.js';

type HealthResponse = {
  status: 'ok';
};

type ReadinessResponse =
  | {
      status: 'ready';
      database: 'up';
    }
  | {
      status: 'not_ready';
      database: 'down';
    };

type ReadinessCheck = () => Promise<boolean>;

type CreateAppOptions = {
  readinessCheck?: ReadinessCheck;
  facilitiesRouter?: Router;
  practitionersRouter?: Router;
  patientsRouter?: Router;
  appointmentsRouter?: Router;
  logger?: ObservabilityLogger;
};

const defaultReadinessCheck: ReadinessCheck = async () => false;

export function createApp(options: CreateAppOptions = {}) {
  const readinessCheck = options.readinessCheck ?? defaultReadinessCheck;
  const facilitiesRouter = options.facilitiesRouter;
  const practitionersRouter = options.practitionersRouter;
  const patientsRouter = options.patientsRouter;
  const appointmentsRouter = options.appointmentsRouter;
  const logger = options.logger ?? noopObservabilityLogger;
  const app = express();

  app.use(createRequestObservabilityMiddleware(logger));
  app.use(express.json({ limit: '100kb' }));

  app.get('/health/live', (_request, response) => {
    const payload: HealthResponse = {
      status: 'ok',
    };

    response.status(200).json(payload);
  });

  app.get('/health/ready', async (_request, response) => {
    try {
      const isReady = await readinessCheck();

      if (isReady) {
        const payload: ReadinessResponse = {
          status: 'ready',
          database: 'up',
        };

        response.status(200).json(payload);
        return;
      }
    } catch {
      // Keep readiness responses stable and avoid leaking internal errors.
    }

    const payload: ReadinessResponse = {
      status: 'not_ready',
      database: 'down',
    };

    const requestId: unknown = response.locals.requestId;
    logger.warn(OBSERVABILITY_EVENT_CODES.readinessCheckFailed, {
      ...(typeof requestId === 'string' ? { requestId } : {}),
      statusCode: 503,
    });
    response.status(503).json(payload);
  });

  if (facilitiesRouter) {
    app.use('/api/v1/facilities', facilitiesRouter);
  }

  if (practitionersRouter) {
    app.use('/api/v1/practitioners', practitionersRouter);
  }

  if (patientsRouter) {
    app.use('/api/v1/patients', patientsRouter);
  }

  if (appointmentsRouter) {
    app.use('/api/v1/appointments', appointmentsRouter);
  }

  app.use(createApiErrorHandler(logger));

  return app;
}
