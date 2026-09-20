import { Document, Schema, model } from 'mongoose';

export interface ISystemSetting {
  companyName: string;
  currency: string;
  taxRate: number;
}

export interface ISystemSettingDocument extends ISystemSetting, Document {
  createdAt: Date;
  updatedAt: Date;
}

const systemSettingSchema = new Schema<ISystemSettingDocument>(
  {
    companyName: { type: String, required: true, trim: true, default: 'SyncStock' },
    currency: { type: String, required: true, trim: true, default: 'INR' },
    taxRate: { type: Number, required: true, min: 0, default: 0 },
  },
  { timestamps: true }
);

export const SystemSetting = model<ISystemSettingDocument>('SystemSetting', systemSettingSchema);
