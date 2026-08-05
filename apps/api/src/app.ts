import express from 'express';

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
};

const defaultReadinessCheck: ReadinessCheck = async () => false;

export function createApp(options: CreateAppOptions = {}) {
  const readinessCheck = options.readinessCheck ?? defaultReadinessCheck;
  const app = express();

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

    response.status(503).json(payload);
  });

  return app;
}
