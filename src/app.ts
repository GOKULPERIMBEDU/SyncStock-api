import cors from 'cors';
import express from 'express';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import routes from './routes';

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: (origin, callback) => {
        const allowed = env.corsOrigin.split(',').map((item) => item.trim()).filter(Boolean);
        if (!origin || allowed.includes(origin) || /localhost:\d+$/.test(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error('Origin not allowed by CORS'));
      },
    })
  );
  app.use(express.json({ limit: '1mb' }));

  app.use('/api', routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
