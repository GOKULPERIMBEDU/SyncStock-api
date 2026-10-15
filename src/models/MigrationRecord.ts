import { Document, Schema, model } from 'mongoose';

/** One row per data migration that has been applied to this database (see `src/migrations`). */
export interface IMigrationRecord {
  migrationId: string;
  name: string;
  notes: string;
  appliedAt: Date;
}

export interface IMigrationRecordDocument extends IMigrationRecord, Document {}

const migrationRecordSchema = new Schema<IMigrationRecordDocument>(
  {
    migrationId: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    notes: { type: String, default: '' },
    appliedAt: { type: Date, required: true, default: Date.now },
  },
  { collection: 'schema_migrations' }
);

export const MigrationRecord = model<IMigrationRecordDocument>('MigrationRecord', migrationRecordSchema);
