import { Sale, type ISale, type ISaleDocument } from '../models/Sale';

export class SaleRepository {
  async create(data: ISale): Promise<ISaleDocument> {
    return Sale.create(data);
  }

  async findAll(): Promise<ISaleDocument[]> {
    return Sale.find()
      .sort({ createdAt: -1 })
      .populate('customerRef', 'name email phone address')
      .populate('items.productRef', 'name sku category price currentStock')
      .populate('createdBy', 'name email role');
  }

  async findById(id: string): Promise<ISaleDocument | null> {
    return Sale.findById(id)
      .populate('customerRef', 'name email phone address')
      .populate('items.productRef', 'name sku category price currentStock')
      .populate('createdBy', 'name email role');
  }

  async nextInvoiceNumber(): Promise<string> {
    const count = await Sale.countDocuments();
    return `INV-${String(count + 1).padStart(3, '0')}`;
  }

  async sumCompleted(): Promise<number> {
    const [result] = await Sale.aggregate<{ total: number }>([
      { $match: { status: 'COMPLETE' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]);
    return result?.total ?? 0;
  }
}

export const saleRepository = new SaleRepository();
