import { Types } from 'mongoose';
import type { IAccount } from '../models/Account';
import { accountRepository } from '../repositories/account.repository';
import { orderRepository } from '../repositories/order.repository';
import { AppError } from '../utils/AppError';

export class AccountService {
  async create(input: IAccount) {
    const existing = await accountRepository.findByTransactionId(input.transactionId);
    if (existing) {
      throw new AppError(409, `Ledger transaction ${input.transactionId} already exists`);
    }
    if (input.orderRef) {
      const order = await orderRepository.findById(String(input.orderRef));
      if (!order) throw new AppError(404, 'Referenced order not found');
    }
    return accountRepository.create({
      ...input,
      transactionId: input.transactionId.trim().toUpperCase(),
      date: input.date ? new Date(input.date) : new Date(),
      orderRef: input.orderRef ? new Types.ObjectId(String(input.orderRef)) : undefined,
    });
  }

  async list() {
    return accountRepository.findAll();
  }

  async getById(id: string) {
    const entry = await accountRepository.findById(id);
    if (!entry) throw new AppError(404, 'Ledger entry not found');
    return entry;
  }

  async update(id: string, input: Partial<IAccount>) {
    await this.getById(id);
    const updated = await accountRepository.updateById(id, input);
    if (!updated) throw new AppError(404, 'Ledger entry not found');
    return updated;
  }

  async remove(id: string) {
    const deleted = await accountRepository.deleteById(id);
    if (!deleted) throw new AppError(404, 'Ledger entry not found');
    return deleted;
  }
}

export const accountService = new AccountService();
