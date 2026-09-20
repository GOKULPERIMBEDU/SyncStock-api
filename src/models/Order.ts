import { Document, Schema, Types, model } from 'mongoose';

export type OrderKind = 'PURCHASE' | 'SALE';
export type OrderStatus = 'PENDING' | 'COMPLETE' | 'PARTIAL';

export interface IOrderItem {
  productId: Types.ObjectId;
  quantity: number;
  received: number;
  unitPrice: number;
}

export interface IOrder {
  orderNumber: string;
  partyName: string;
  kind: OrderKind;
  status: OrderStatus;
  items: IOrderItem[];
  totalAmount: number;
  emailSent: boolean;
}

export interface IOrderDocument extends IOrder, Document {
  createdAt: Date;
  updatedAt: Date;
}

const orderItemSchema = new Schema<IOrderItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true, min: 1 },
    received: { type: Number, required: true, min: 0, default: 0 },
    unitPrice: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const orderSchema = new Schema<IOrderDocument>(
  {
    orderNumber: { type: String, required: true, unique: true, trim: true, uppercase: true },
    partyName: { type: String, required: true, trim: true },
    kind: { type: String, enum: ['PURCHASE', 'SALE'], required: true },
    status: { type: String, enum: ['PENDING', 'COMPLETE', 'PARTIAL'], required: true, default: 'PENDING' },
    items: { type: [orderItemSchema], required: true, validate: (v: IOrderItem[]) => v.length > 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    emailSent: { type: Boolean, required: true, default: false },
  },
  { timestamps: true }
);

orderSchema.index({ kind: 1, createdAt: -1 });
orderSchema.index({ partyName: 1 });

export const Order = model<IOrderDocument>('Order', orderSchema);
