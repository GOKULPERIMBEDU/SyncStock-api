import { Document, Schema, Types, model } from 'mongoose';

export interface INotification {
  userRef?: Types.ObjectId;
  title: string;
  message: string;
  isRead: boolean;
  date: Date;
}

export interface INotificationDocument extends INotification, Document {
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotificationDocument>(
  {
    userRef: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    isRead: { type: Boolean, required: true, default: false },
    date: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true }
);

notificationSchema.index({ date: -1 });

export const Notification = model<INotificationDocument>('Notification', notificationSchema);
