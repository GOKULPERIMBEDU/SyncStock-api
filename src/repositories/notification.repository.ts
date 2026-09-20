import { Notification, type INotification, type INotificationDocument } from '../models/Notification';

export class NotificationRepository {
  async create(data: INotification): Promise<INotificationDocument> {
    return Notification.create(data);
  }

  async findForUser(userId: string): Promise<INotificationDocument[]> {
    return Notification.find({
      $or: [{ userRef: userId }, { userRef: { $exists: false } }, { userRef: null }],
    }).sort({ date: -1 });
  }

  async markRead(id: string): Promise<INotificationDocument | null> {
    return Notification.findByIdAndUpdate(id, { $set: { isRead: true } }, { new: true });
  }

  async unreadCount(userId: string): Promise<number> {
    return Notification.countDocuments({
      isRead: false,
      $or: [{ userRef: userId }, { userRef: { $exists: false } }, { userRef: null }],
    });
  }
}

export const notificationRepository = new NotificationRepository();
