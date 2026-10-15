import { MigrationRecord } from '../models/MigrationRecord';
import { MIGRATIONS } from './steps';

export interface Migration {
  /** Sortable, never reused: `2026-10-001`. */
  id: string;
  name: string;
  /** Applies the change and returns a short note about what it did. Must be safe to run twice. */
  up: (log: (message: string) => void) => Promise<string | void>;
}

const log = (message: string) => console.log(`[migrate] ${message}`);

/**
 * Applies every pending data migration in order and records it. A failing migration is logged and left unrecorded so
 * it retries on the next boot; later migrations that may depend on it are skipped. The API keeps starting either way,
 * so a bad migration can never lock users out.
 */
export async function runMigrations(): Promise<{ applied: string[]; failed: string | null }> {
  const applied: string[] = [];
  const done = new Set((await MigrationRecord.find().select('migrationId').lean()).map((record) => record.migrationId));

  for (const migration of MIGRATIONS) {
    if (done.has(migration.id)) continue;
    try {
      log(`Applying ${migration.id} - ${migration.name}`);
      const notes = (await migration.up((message) => log(`  ${message}`))) ?? '';
      await MigrationRecord.create({ migrationId: migration.id, name: migration.name, notes });
      applied.push(migration.id);
    } catch (error) {
      console.error(`[migrate] ${migration.id} failed; it will be retried on the next start`, error);
      return { applied, failed: migration.id };
    }
  }

  if (applied.length === 0) log('Database is up to date');
  return { applied, failed: null };
}
