import { notificationRepository } from '../repositories/notification.repository';
import { AppError } from '../utils/AppError';

export class NotificationService {
  async list(userId: string) {
    const [items, unreadCount] = await Promise.all([
      notificationRepository.findForUser(userId),
      notificationRepository.unreadCount(userId),
    ]);
    return { items, unreadCount };
  }

  async markRead(id: string) {
    const updated = await notificationRepository.markRead(id);
    if (!updated) throw new AppError(404, 'Notification not found');
    return updated;
  }
}

export const notificationService = new NotificationService();
