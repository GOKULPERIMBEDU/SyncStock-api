import { Document, Schema, Types, model } from 'mongoose';

/**
 * A multi-level pallet rack in the yard. `occupiedSlots` is the number of filled pallet positions and always
 * equals the count of `YardPallet` documents with `locationType: 'Rack'` and this `rackCode`.
 */
export interface IStorageRack {
  siteCode: string;
  /** `R-01`.. */
  code: string;
  zone: string;
  levels: number;
  /** Total pallet positions across all levels. */
  capacity: number;
  occupiedSlots: number;
  assignedProductId: Types.ObjectId | null;
  assignedSku: string | null;
}

export interface IStorageRackDocument extends IStorageRack, Document {
  createdAt: Date;
  updatedAt: Date;
}

const storageRackSchema = new Schema<IStorageRackDocument>(
  {
    siteCode: { type: String, required: true, trim: true, uppercase: true, index: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    zone: { type: String, required: true, trim: true },
    levels: { type: Number, required: true, min: 1 },
    capacity: { type: Number, required: true, min: 1 },
    occupiedSlots: { type: Number, required: true, min: 0, default: 0 },
    assignedProductId: { type: Schema.Types.ObjectId, ref: 'Product', default: null },
    assignedSku: { type: String, trim: true, uppercase: true, default: null },
  },
  { timestamps: true }
);

storageRackSchema.index({ siteCode: 1, code: 1 }, { unique: true });

export const StorageRack = model<IStorageRackDocument>('StorageRack', storageRackSchema);
