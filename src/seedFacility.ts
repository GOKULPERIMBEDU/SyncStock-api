import mongoose from 'mongoose';
import { assertRequiredEnv, env } from './config/env';
import { seedFacilityData } from './services/yard/seeder';

/** `npm run seed:facility` - rebuilds only the yard plane; users, products and the rest of the ledger are kept. */
async function run(): Promise<void> {
  assertRequiredEnv();
  await mongoose.connect(env.mongodbUri);
  await seedFacilityData({ reset: true });
  console.log('[seed:facility] Facility sites, docks, vehicles, racks, pallets and shipments reset');
  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error('[seed:facility] Failed', error);
  await mongoose.disconnect();
  process.exit(1);
});
