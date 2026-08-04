import express from 'express';

type HealthResponse = {
  status: 'ok';
};

export function createApp() {
  const app = express();

  app.get('/health/live', (_request, response) => {
    const payload: HealthResponse = {
      status: 'ok',
    };

    response.status(200).json(payload);
  });

  return app;
}
