import { Document, Schema, model } from 'mongoose';

export interface IProduct {
  name: string;
  sku: string;
  barcode?: string;
  category: string;
  price: number;
  currentStock: number;
  lowStockThreshold: number;
}

export interface IProductDocument extends IProduct, Document {
  createdAt: Date;
  updatedAt: Date;
}

const productSchema = new Schema<IProductDocument>(
  {
    name: { type: String, required: true, trim: true },
    sku: { type: String, required: true, trim: true, uppercase: true, unique: true },
    barcode: { type: String, trim: true },
    category: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    currentStock: { type: Number, required: true, min: 0, default: 0 },
    lowStockThreshold: { type: Number, required: true, min: 0, default: 10 },
  },
  { timestamps: true }
);

productSchema.index({ category: 1 });
productSchema.index({ currentStock: 1 });
productSchema.index({ name: 'text', sku: 'text', barcode: 'text' });

export const Product = model<IProductDocument>('Product', productSchema);
