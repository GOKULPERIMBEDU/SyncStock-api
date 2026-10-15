import { Document, Schema, Types, model } from 'mongoose';
import type { MovementType } from '../types';

export interface IStockMovement {
  productId: Types.ObjectId;
  quantity: number;
  type: MovementType;
  reason: string;
  previousStock: number;
  newStock: number;
  handledBy?: Types.ObjectId;
  /** Yard-plane link, filled in when the movement is realised as a shipment at a facility. */
  siteCode?: string;
  shipmentCode?: string;
  truckCode?: string;
}

export interface IStockMovementDocument extends IStockMovement, Document {
  createdAt: Date;
  updatedAt: Date;
}

const stockMovementSchema = new Schema<IStockMovementDocument>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    quantity: { type: Number, required: true, min: 1 },
    type: { type: String, enum: ['IN', 'OUT', 'ADJUSTMENT'], required: true },
    reason: { type: String, required: true, trim: true },
    previousStock: { type: Number, required: true, min: 0 },
    newStock: { type: Number, required: true, min: 0 },
    handledBy: { type: Schema.Types.ObjectId, ref: 'User' },
    siteCode: { type: String, trim: true, uppercase: true },
    shipmentCode: { type: String, trim: true, uppercase: true },
    truckCode: { type: String, trim: true, uppercase: true },
  },
  { timestamps: true }
);

stockMovementSchema.index({ createdAt: -1 });
stockMovementSchema.index({ productId: 1, createdAt: -1 });

export const StockMovement = model<IStockMovementDocument>('StockMovement', stockMovementSchema);
