import { Types } from 'mongoose';
import type { IOrder, IOrderItem } from '../models/Order';
import { orderRepository } from '../repositories/order.repository';
import { productRepository } from '../repositories/product.repository';
import { AppError } from '../utils/AppError';
import { stockService } from './stock.service';

export class OrderService {
  async create(input: Omit<IOrder, 'totalAmount' | 'status' | 'emailSent'> & { status?: IOrder['status']; emailSent?: boolean }) {
    const existing = await orderRepository.findByNumber(input.orderNumber);
    if (existing) {
      throw new AppError(409, `Order ${input.orderNumber} already exists`);
    }

    const items: IOrderItem[] = [];
    for (const item of input.items) {
      const product = await productRepository.findById(String(item.productId));
      if (!product) {
        throw new AppError(404, `Product ${item.productId} not found`);
      }
      items.push({
        productId: new Types.ObjectId(String(product._id)),
        quantity: item.quantity,
        received: item.received ?? 0,
        unitPrice: item.unitPrice ?? product.price,
      });
    }

    const totalAmount = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const receivedAll = items.every((item) => item.received >= item.quantity);
    const receivedNone = items.every((item) => item.received === 0);

    return orderRepository.create({
      orderNumber: input.orderNumber.trim().toUpperCase(),
      partyName: input.partyName.trim(),
      kind: input.kind,
      items,
      totalAmount,
      emailSent: input.emailSent ?? false,
      status: input.status ?? (receivedAll ? 'COMPLETE' : receivedNone ? 'PENDING' : 'PARTIAL'),
    });
  }

  async list(kind?: IOrder['kind']) {
    return orderRepository.findAll(kind ? { kind } : {});
  }

  async getById(id: string) {
    const order = await orderRepository.findById(id);
    if (!order) throw new AppError(404, 'Order not found');
    return order;
  }

  async update(id: string, input: Partial<Pick<IOrder, 'partyName' | 'status' | 'emailSent'>>) {
    await this.getById(id);
    const updated = await orderRepository.updateById(id, input);
    if (!updated) throw new AppError(404, 'Order not found');
    return updated;
  }

  async remove(id: string) {
    const deleted = await orderRepository.deleteById(id);
    if (!deleted) throw new AppError(404, 'Order not found');
    return deleted;
  }

  /**
   * Receives goods against a purchase order: `all` books in every open line, otherwise `quantity` units (default 1) of
   * the next open line. Each stock-in also raises / extends the inbound yard shipment for this order, which a dock,
   * a truck and a forklift then work (the "Receive / Put-Away" action).
   */
  async receive(id: string, siteCode?: string, options: { quantity?: number; all?: boolean } = {}) {
    const order = await this.getById(id);
    if (order.kind !== 'PURCHASE') {
      throw new AppError(400, 'Only purchase orders can be received into stock');
    }
    if (order.status === 'COMPLETE') {
      throw new AppError(409, 'Order is already complete');
    }

    const items = order.items.map((item) => ({
      productId: typeof item.productId === 'object' && item.productId && '_id' in item.productId
        ? String((item.productId as { _id: unknown })._id)
        : String(item.productId),
      quantity: item.quantity,
      received: item.received,
      unitPrice: item.unitPrice,
    }));

    const openLines = items.filter((item) => item.received < item.quantity);
    if (openLines.length === 0) {
      throw new AppError(409, 'All line items are already received');
    }

    const plan = options.all
      ? openLines.map((line) => ({ line, units: line.quantity - line.received }))
      : [{ line: openLines[0], units: Math.min(Math.max(1, options.quantity ?? 1), openLines[0].quantity - openLines[0].received) }];
    const expectedUnits = items.reduce((sum, item) => sum + item.quantity, 0);

    for (const { line, units } of plan) {
      line.received += units;
      await stockService.restock(
        line.productId,
        {
          quantity: units,
          reason: `Receive ${order.orderNumber}`,
        },
        undefined,
        {
          siteCode,
          source: { kind: 'PURCHASE', ref: order.orderNumber, partyName: order.partyName, id: String(order._id), expectedUnits },
        }
      );
    }

    const receivedAll = items.every((item) => item.received >= item.quantity);
    return orderRepository.updateById(id, {
      items: items.map((item) => ({
        productId: new Types.ObjectId(item.productId),
        quantity: item.quantity,
        received: item.received,
        unitPrice: item.unitPrice,
      })),
      status: receivedAll ? 'COMPLETE' : 'PARTIAL',
    });
  }

  async listClients() {
    const sales = await orderRepository.findAll({ kind: 'SALE' });
    const grouped = new Map<string, { name: string; orders: number; spend: number; lastOrder: Date }>();

    for (const order of sales) {
      const current = grouped.get(order.partyName) ?? {
        name: order.partyName,
        orders: 0,
        spend: 0,
        lastOrder: order.createdAt,
      };
      current.orders += 1;
      if (order.status === 'COMPLETE') current.spend += order.totalAmount;
      if (order.createdAt > current.lastOrder) current.lastOrder = order.createdAt;
      grouped.set(order.partyName, current);
    }

    return [...grouped.values()].sort((a, b) => b.spend - a.spend);
  }
}

export const orderService = new OrderService();
