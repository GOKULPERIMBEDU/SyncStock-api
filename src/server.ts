import { createApp } from './app';
import { connectDatabase } from './config/database';
import { assertRequiredEnv, env } from './config/env';

async function bootstrap(): Promise<void> {
  assertRequiredEnv();
  await connectDatabase();

  const app = createApp();
  app.listen(env.port, () => {
    console.log(`[server] SyncStock API listening on http://localhost:${env.port}`);
  });
}

bootstrap().catch((error) => {
  console.error('[server] Failed to start', error);
  process.exit(1);
});
