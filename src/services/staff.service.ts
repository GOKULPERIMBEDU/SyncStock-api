import { staffRepository } from '../repositories/staff.repository';
import type { IStaff } from '../models/Staff';
import { AppError } from '../utils/AppError';

export class StaffService {
  async create(input: IStaff) {
    const existing = await staffRepository.findByEmail(input.email);
    if (existing) {
      throw new AppError(409, `Staff email ${input.email} already exists`);
    }
    return staffRepository.create({
      ...input,
      email: input.email.toLowerCase(),
      joinedDate: input.joinedDate ? new Date(input.joinedDate) : new Date(),
    });
  }

  async list() {
    return staffRepository.findAll();
  }

  async getById(id: string) {
    const staff = await staffRepository.findById(id);
    if (!staff) throw new AppError(404, 'Staff member not found');
    return staff;
  }

  async update(id: string, input: Partial<IStaff>) {
    await this.getById(id);
    if (input.email) {
      const existing = await staffRepository.findByEmail(input.email);
      if (existing && existing.id !== id) {
        throw new AppError(409, `Staff email ${input.email} already exists`);
      }
      input.email = input.email.toLowerCase();
    }
    const updated = await staffRepository.updateById(id, input);
    if (!updated) throw new AppError(404, 'Staff member not found');
    return updated;
  }

  async remove(id: string) {
    const deleted = await staffRepository.deleteById(id);
    if (!deleted) throw new AppError(404, 'Staff member not found');
    return deleted;
  }
}

export const staffService = new StaffService();
