import { Document, Schema, Types, model } from 'mongoose';

export type PaymentMethod = 'BANK' | 'CARD' | 'CASH';
export type PaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED';

export interface IPayment {
  paymentId: string;
  orderRef?: Types.ObjectId;
  saleRef?: Types.ObjectId;
  amount: number;
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  paymentDate: Date;
}

export interface IPaymentDocument extends IPayment, Document {
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<IPaymentDocument>(
  {
    paymentId: { type: String, required: true, unique: true, trim: true, uppercase: true },
    orderRef: { type: Schema.Types.ObjectId, ref: 'Order', index: true },
    saleRef: { type: Schema.Types.ObjectId, ref: 'Sale', index: true },
    amount: { type: Number, required: true, min: 0 },
    paymentMethod: { type: String, enum: ['BANK', 'CARD', 'CASH'], required: true },
    status: { type: String, enum: ['PENDING', 'COMPLETED', 'FAILED'], required: true, default: 'PENDING' },
    paymentDate: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true }
);

export const Payment = model<IPaymentDocument>('Payment', paymentSchema);
