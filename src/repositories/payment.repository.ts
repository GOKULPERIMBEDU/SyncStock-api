import { Payment, type IPayment, type IPaymentDocument } from '../models/Payment';

export class PaymentRepository {
  async create(data: IPayment): Promise<IPaymentDocument> {
    return Payment.create(data);
  }

  async findAll(): Promise<IPaymentDocument[]> {
    return Payment.find()
      .sort({ paymentDate: -1 })
      .populate('orderRef', 'orderNumber partyName totalAmount status kind')
      .populate('saleRef', 'invoiceNumber totalAmount status');
  }

  async findById(id: string): Promise<IPaymentDocument | null> {
    return Payment.findById(id)
      .populate('orderRef', 'orderNumber partyName totalAmount status kind')
      .populate('saleRef', 'invoiceNumber totalAmount status');
  }

  async findByPaymentId(paymentId: string): Promise<IPaymentDocument | null> {
    return Payment.findOne({ paymentId: paymentId.toUpperCase() });
  }

  async updateById(id: string, data: Partial<IPayment>): Promise<IPaymentDocument | null> {
    return Payment.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true }).populate(
      'orderRef',
      'orderNumber partyName totalAmount status kind'
    );
  }

  async deleteById(id: string): Promise<IPaymentDocument | null> {
    return Payment.findByIdAndDelete(id);
  }
}

export const paymentRepository = new PaymentRepository();
