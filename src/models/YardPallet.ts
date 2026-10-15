import { Document, Schema, Types, model } from 'mongoose';

export const PALLET_LOCATION_TYPES = ['Rack', 'Staging', 'Dock'] as const;
export type PalletLocationType = (typeof PALLET_LOCATION_TYPES)[number];

/**
 * One physical pallet in the yard, tied to a real `Product`. Where it sits depends on `locationType`:
 * - `Rack`: `rackCode` + `slotIndex` (level-major, 0-based)
 * - `Staging`: `row` + `col` on the painted staging grid
 * - `Dock`: `dockCode`
 */
export interface IYardPallet {
  siteCode: string;
  code: string;
  productId: Types.ObjectId;
  sku: string;
  /** Units on the pallet. */
  quantity: number;
  /** Visual stack height in the 3D yard (1-3). */
  layers: number;
  locationType: PalletLocationType;
  zone: string;
  row?: number;
  col?: number;
  rackCode?: string;
  slotIndex?: number;
  dockCode?: string;
  /** Shipment the pallet is staged for, when any. */
  shipmentId?: string | null;
}

export interface IYardPalletDocument extends IYardPallet, Document {
  createdAt: Date;
  updatedAt: Date;
}

const yardPalletSchema = new Schema<IYardPalletDocument>(
  {
    siteCode: { type: String, required: true, trim: true, uppercase: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    sku: { type: String, required: true, trim: true, uppercase: true },
    quantity: { type: Number, required: true, min: 0 },
    layers: { type: Number, required: true, min: 1, max: 3, default: 1 },
    locationType: { type: String, enum: PALLET_LOCATION_TYPES, required: true },
    zone: { type: String, required: true, trim: true },
    row: { type: Number },
    col: { type: Number },
    rackCode: { type: String, trim: true, uppercase: true },
    slotIndex: { type: Number },
    dockCode: { type: String, trim: true, uppercase: true },
    shipmentId: { type: String, default: null },
  },
  { timestamps: true }
);

yardPalletSchema.index({ siteCode: 1, code: 1 }, { unique: true });
yardPalletSchema.index({ siteCode: 1, locationType: 1 });
yardPalletSchema.index({ siteCode: 1, rackCode: 1, slotIndex: 1 });

export const YardPallet = model<IYardPalletDocument>('YardPallet', yardPalletSchema);
