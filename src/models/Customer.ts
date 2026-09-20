import { Document, Schema, model } from 'mongoose';

export interface ICustomer {
  name: string;
  email: string;
  phone: string;
  address: string;
}

export interface ICustomerDocument extends ICustomer, Document {
  createdAt: Date;
  updatedAt: Date;
}

const customerSchema = new Schema<ICustomerDocument>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

export const Customer = model<ICustomerDocument>('Customer', customerSchema);
