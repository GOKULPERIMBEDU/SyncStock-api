import { Document, Schema, Types, model } from 'mongoose';

export type SaleStatus = 'PENDING' | 'COMPLETE' | 'CANCELLED';

export interface ISaleItem {
  productRef: Types.ObjectId;
  qty: number;
  price: number;
}

export interface ISale {
  invoiceNumber: string;
  customerRef: Types.ObjectId;
  items: ISaleItem[];
  totalAmount: number;
  status: SaleStatus;
  createdBy: Types.ObjectId;
}

export interface ISaleDocument extends ISale, Document {
  createdAt: Date;
  updatedAt: Date;
}

const saleItemSchema = new Schema<ISaleItem>(
  {
    productRef: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    qty: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const saleSchema = new Schema<ISaleDocument>(
  {
    invoiceNumber: { type: String, required: true, unique: true, trim: true, uppercase: true },
    customerRef: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    items: { type: [saleItemSchema], required: true, validate: (v: ISaleItem[]) => v.length > 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['PENDING', 'COMPLETE', 'CANCELLED'], required: true, default: 'COMPLETE' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

saleSchema.index({ createdAt: -1 });

export const Sale = model<ISaleDocument>('Sale', saleSchema);
