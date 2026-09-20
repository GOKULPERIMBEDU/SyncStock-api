import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { env } from '../config/env';
import type { UserRole } from '../models/User';
import { userRepository } from '../repositories/user.repository';
import { AppError } from '../utils/AppError';
import { publicUser, signAuthToken } from '../utils/token';
import { emailService } from './email.service';

export class AuthService {
  async login(email: string, password: string) {
    const user = await userRepository.findByEmail(email, true);
    if (!user) {
      throw new AppError(401, 'Invalid email or password');
    }
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      throw new AppError(401, 'Invalid email or password');
    }
    const profile = publicUser(user);
    return { token: signAuthToken(profile), user: profile };
  }

  async me(id: string) {
    const user = await userRepository.findById(id);
    if (!user) throw new AppError(404, 'User not found');
    return publicUser(user);
  }

  async updateProfile(id: string, input: { name?: string; email?: string }) {
    if (input.email) {
      const existing = await userRepository.findByEmail(input.email);
      if (existing && existing.id !== id) {
        throw new AppError(409, 'Email already in use');
      }
    }
    const updated = await userRepository.updateById(id, input);
    if (!updated) throw new AppError(404, 'User not found');
    return publicUser(updated);
  }

  async changePassword(id: string, currentPassword: string, nextPassword: string) {
    const user = await userRepository.findByEmail((await this.me(id)).email, true);
    if (!user) throw new AppError(404, 'User not found');
    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) throw new AppError(400, 'Current password is incorrect');
    user.password = await bcrypt.hash(nextPassword, 10);
    await user.save();
    return { updated: true };
  }

  async forgotPassword(email: string) {
    const user = await userRepository.findByEmail(email);
    if (!user) {
      return { sent: true };
    }
    const raw = crypto.randomBytes(32).toString('hex');
    const hashed = crypto.createHash('sha256').update(raw).digest('hex');
    user.resetPasswordToken = hashed;
    user.resetPasswordExpire = new Date(Date.now() + 30 * 60 * 1000);
    await user.save();
    const resetUrl = `${env.clientUrl}/reset-password?token=${raw}`;
    await emailService.sendPasswordReset(user.email, resetUrl);
    return { sent: true };
  }

  async resetPassword(token: string, password: string) {
    const hashed = crypto.createHash('sha256').update(token).digest('hex');
    const user = await userRepository.findByResetToken(hashed);
    if (!user) {
      throw new AppError(400, 'Reset token is invalid or expired');
    }
    user.password = await bcrypt.hash(password, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();
    return { reset: true };
  }

  async listUsers() {
    const users = await userRepository.findAll();
    return users.map(publicUser);
  }

  async createUser(input: { name: string; email: string; password: string; role: UserRole }) {
    const existing = await userRepository.findByEmail(input.email);
    if (existing) throw new AppError(409, 'Email already in use');
    const user = await userRepository.create({
      name: input.name,
      email: input.email.toLowerCase(),
      password: await bcrypt.hash(input.password, 10),
      role: input.role,
    });
    return publicUser(user);
  }

  async deleteUser(id: string, actorId: string) {
    if (id === actorId) throw new AppError(400, 'You cannot delete your own account');
    const deleted = await userRepository.deleteById(id);
    if (!deleted) throw new AppError(404, 'User not found');
    return { deleted: true };
  }
}

export const authService = new AuthService();
