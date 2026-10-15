import { createApp } from './app';
import { connectDatabase } from './config/database';
import { assertRequiredEnv, env } from './config/env';
import { runMigrations } from './migrations/runner';
import { ensureFacilityData } from './services/yard/seeder';
import { startYardSimulation } from './services/yard/simulation';

async function bootstrap(): Promise<void> {
  assertRequiredEnv();
  await connectDatabase();

  // Data migrations first (workspaces, roles, ledger reconciliation, yard rebuild); they never block start-up.
  const migrations = await runMigrations();
  if (migrations.failed) console.error(`[server] Migration ${migrations.failed} failed; continuing with the existing data`);

  // The yard plane (sites, docks, fleet, racks, pallets, shipments) is seeded when empty and then simulated.
  await ensureFacilityData();
  startYardSimulation();

  const app = createApp();

  app.listen(env.port, () => {
    console.log(`[server] SyncStock API listening on http://localhost:${env.port}`);
  });
}

bootstrap().catch((error) => {
  console.error('[server] Failed to start', error);
  process.exit(1);
});
