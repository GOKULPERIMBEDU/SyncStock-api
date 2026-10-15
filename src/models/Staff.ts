import { Document, Schema, model } from 'mongoose';

/** Same three roles as `User.role`, so permissions and badges can never disagree. */
export type StaffRole = 'Admin' | 'Manager' | 'Staff';
export type StaffStatus = 'Active' | 'Inactive';

export interface IStaff {
  name: string;
  email: string;
  role: StaffRole;
  status: StaffStatus;
  joinedDate: Date;
}

export interface IStaffDocument extends IStaff, Document {
  createdAt: Date;
  updatedAt: Date;
}

const staffSchema = new Schema<IStaffDocument>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    role: { type: String, enum: ['Admin', 'Manager', 'Staff'], required: true },
    status: { type: String, enum: ['Active', 'Inactive'], required: true, default: 'Active' },
    joinedDate: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true }
);

export const Staff = model<IStaffDocument>('Staff', staffSchema);
