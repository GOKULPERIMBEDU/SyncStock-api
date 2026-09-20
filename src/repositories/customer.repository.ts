import { Customer, type ICustomer, type ICustomerDocument } from '../models/Customer';

export class CustomerRepository {
  async create(data: ICustomer): Promise<ICustomerDocument> {
    return Customer.create(data);
  }

  async findAll(): Promise<ICustomerDocument[]> {
    return Customer.find().sort({ name: 1 });
  }

  async findById(id: string): Promise<ICustomerDocument | null> {
    return Customer.findById(id);
  }

  async updateById(id: string, data: Partial<ICustomer>): Promise<ICustomerDocument | null> {
    return Customer.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true });
  }

  async deleteById(id: string): Promise<ICustomerDocument | null> {
    return Customer.findByIdAndDelete(id);
  }
}

export const customerRepository = new CustomerRepository();
