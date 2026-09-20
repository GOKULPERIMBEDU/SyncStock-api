import { Types } from 'mongoose';
import type { IPayment } from '../models/Payment';
import { orderRepository } from '../repositories/order.repository';
import { paymentRepository } from '../repositories/payment.repository';
import { saleRepository } from '../repositories/sale.repository';
import { AppError } from '../utils/AppError';

export class PaymentService {
  async create(input: IPayment) {
    const existing = await paymentRepository.findByPaymentId(input.paymentId);
    if (existing) {
      throw new AppError(409, `Payment ${input.paymentId} already exists`);
    }
    if (!input.orderRef && !input.saleRef) {
      throw new AppError(400, 'A payment must reference an order or a sale');
    }
    if (input.orderRef) {
      const order = await orderRepository.findById(String(input.orderRef));
      if (!order) throw new AppError(404, 'Referenced order not found');
    }
    if (input.saleRef) {
      const sale = await saleRepository.findById(String(input.saleRef));
      if (!sale) throw new AppError(404, 'Referenced sale not found');
    }
    return paymentRepository.create({
      ...input,
      paymentId: input.paymentId.trim().toUpperCase(),
      orderRef: input.orderRef ? new Types.ObjectId(String(input.orderRef)) : undefined,
      saleRef: input.saleRef ? new Types.ObjectId(String(input.saleRef)) : undefined,
      paymentDate: input.paymentDate ? new Date(input.paymentDate) : new Date(),
    });
  }

  async list() {
    return paymentRepository.findAll();
  }

  async getById(id: string) {
    const payment = await paymentRepository.findById(id);
    if (!payment) throw new AppError(404, 'Payment not found');
    return payment;
  }

  async update(id: string, input: Partial<IPayment>) {
    await this.getById(id);
    if (input.orderRef) {
      const order = await orderRepository.findById(String(input.orderRef));
      if (!order) throw new AppError(404, 'Referenced order not found');
    }
    const updated = await paymentRepository.updateById(id, input);
    if (!updated) throw new AppError(404, 'Payment not found');
    return updated;
  }

  async remove(id: string) {
    const deleted = await paymentRepository.deleteById(id);
    if (!deleted) throw new AppError(404, 'Payment not found');
    return deleted;
  }
}

export const paymentService = new PaymentService();
