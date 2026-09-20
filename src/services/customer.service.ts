import type { ICustomer } from '../models/Customer';
import { customerRepository } from '../repositories/customer.repository';
import { AppError } from '../utils/AppError';

export class CustomerService {
  async create(input: ICustomer) {
    return customerRepository.create(input);
  }

  async list() {
    return customerRepository.findAll();
  }

  async getById(id: string) {
    const customer = await customerRepository.findById(id);
    if (!customer) throw new AppError(404, 'Customer not found');
    return customer;
  }

  async update(id: string, input: Partial<ICustomer>) {
    const updated = await customerRepository.updateById(id, input);
    if (!updated) throw new AppError(404, 'Customer not found');
    return updated;
  }

  async remove(id: string) {
    const deleted = await customerRepository.deleteById(id);
    if (!deleted) throw new AppError(404, 'Customer not found');
    return deleted;
  }
}

export const customerService = new CustomerService();
