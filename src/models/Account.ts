import { Document, Schema, Types, model } from 'mongoose';

export type LedgerType = 'CREDIT' | 'DEBIT';

export interface IAccount {
  transactionId: string;
  type: LedgerType;
  amount: number;
  date: Date;
  description: string;
  orderRef?: Types.ObjectId;
}

export interface IAccountDocument extends IAccount, Document {
  createdAt: Date;
  updatedAt: Date;
}

const accountSchema = new Schema<IAccountDocument>(
  {
    transactionId: { type: String, required: true, unique: true, trim: true, uppercase: true },
    type: { type: String, enum: ['CREDIT', 'DEBIT'], required: true },
    amount: { type: Number, required: true, min: 0 },
    date: { type: Date, required: true, default: Date.now },
    description: { type: String, required: true, trim: true },
    orderRef: { type: Schema.Types.ObjectId, ref: 'Order' },
  },
  { timestamps: true }
);

accountSchema.index({ date: -1 });

export const Account = model<IAccountDocument>('Account', accountSchema);
