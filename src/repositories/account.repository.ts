import { Account, type IAccount, type IAccountDocument } from '../models/Account';

export class AccountRepository {
  async create(data: IAccount): Promise<IAccountDocument> {
    return Account.create(data);
  }

  async findAll(): Promise<IAccountDocument[]> {
    return Account.find().sort({ date: -1 }).populate('orderRef', 'orderNumber partyName totalAmount');
  }

  async findById(id: string): Promise<IAccountDocument | null> {
    return Account.findById(id).populate('orderRef', 'orderNumber partyName totalAmount');
  }

  async findByTransactionId(transactionId: string): Promise<IAccountDocument | null> {
    return Account.findOne({ transactionId: transactionId.toUpperCase() });
  }

  async updateById(id: string, data: Partial<IAccount>): Promise<IAccountDocument | null> {
    return Account.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true }).populate(
      'orderRef',
      'orderNumber partyName totalAmount'
    );
  }

  async deleteById(id: string): Promise<IAccountDocument | null> {
    return Account.findByIdAndDelete(id);
  }
}

export const accountRepository = new AccountRepository();
