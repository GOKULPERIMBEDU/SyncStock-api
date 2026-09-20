import type { FilterQuery } from 'mongoose';
import { Order, type IOrder, type IOrderDocument } from '../models/Order';

export class OrderRepository {
  async create(data: IOrder): Promise<IOrderDocument> {
    return Order.create(data);
  }

  async findAll(filter: FilterQuery<IOrderDocument> = {}): Promise<IOrderDocument[]> {
    return Order.find(filter).sort({ createdAt: -1 }).populate('items.productId', 'name sku category price currentStock');
  }

  async findById(id: string): Promise<IOrderDocument | null> {
    return Order.findById(id).populate('items.productId', 'name sku category price currentStock');
  }

  async findByNumber(orderNumber: string): Promise<IOrderDocument | null> {
    return Order.findOne({ orderNumber: orderNumber.toUpperCase() });
  }

  async updateById(id: string, data: Partial<IOrder>): Promise<IOrderDocument | null> {
    return Order.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true }).populate(
      'items.productId',
      'name sku category price currentStock'
    );
  }

  async deleteById(id: string): Promise<IOrderDocument | null> {
    return Order.findByIdAndDelete(id);
  }

  async countByStatus(status: IOrder['status']): Promise<number> {
    return Order.countDocuments({ status });
  }

  async sumCompletedSales(): Promise<number> {
    const [result] = await Order.aggregate<{ total: number }>([
      { $match: { kind: 'SALE', status: 'COMPLETE' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]);
    return result?.total ?? 0;
  }
}

export const orderRepository = new OrderRepository();
