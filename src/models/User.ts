import { Document, Schema, model } from 'mongoose';

export type UserRole = 'Admin' | 'Manager' | 'Staff';

export interface IUser {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  resetPasswordToken?: string;
  resetPasswordExpire?: Date;
}

export interface IUserDocument extends IUser, Document {
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUserDocument>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    password: { type: String, required: true, minlength: 8, select: false },
    role: { type: String, enum: ['Admin', 'Manager', 'Staff'], required: true, default: 'Staff' },
    resetPasswordToken: { type: String },
    resetPasswordExpire: { type: Date },
  },
  { timestamps: true }
);

export const User = model<IUserDocument>('User', userSchema);
