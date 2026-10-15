import { Types } from 'mongoose';
import { customerRepository } from '../repositories/customer.repository';
import { notificationRepository } from '../repositories/notification.repository';
import { productRepository } from '../repositories/product.repository';
import { saleRepository } from '../repositories/sale.repository';
import { stockMovementRepository } from '../repositories/stockMovement.repository';
import { AppError } from '../utils/AppError';
import { emailService } from './email.service';
import { yardAfterSale, type YardLedgerLine } from './yard/bridge';

export interface CreateSaleInput {
  customerRef: string;
  items: Array<{ productRef: string; qty: number; price?: number }>;
  createdBy: string;
  /** Facility that fulfils the invoice; defaults to the primary site. */
  siteCode?: string;
}

export class SaleService {
  /**
   * Creating a sale deducts stock atomically, writes an OUT movement,
   * and raises in-app + SMTP alerts when a SKU crosses its threshold.
   */
  async create(input: CreateSaleInput) {
    const customer = await customerRepository.findById(input.customerRef);
    if (!customer) {
      throw new AppError(404, 'Customer not found');
    }

    const invoiceNumber = await saleRepository.nextInvoiceNumber();
    const lines: Array<{ productRef: Types.ObjectId; qty: number; price: number }> = [];
    const deducted: Array<{ productId: string; qty: number }> = [];
    const yardLines: YardLedgerLine[] = [];

    try {
      for (const item of input.items) {
        const product = await productRepository.findById(item.productRef);
        if (!product) {
          throw new AppError(404, `Product ${item.productRef} not found`);
        }

        const updated = await productRepository.decrementIfSufficient(product.id, item.qty);
        if (!updated) {
          throw new AppError(
            409,
            `Insufficient stock for ${product.name}. Available: ${product.currentStock}, requested: ${item.qty}`
          );
        }

        const previousStock = updated.currentStock + item.qty;
        const movement = await stockMovementRepository.create({
          productId: updated._id,
          quantity: item.qty,
          type: 'OUT',
          reason: `Sale #${invoiceNumber}`,
          previousStock,
          newStock: updated.currentStock,
          handledBy: new Types.ObjectId(input.createdBy),
        });
        yardLines.push({
          productId: updated._id as Types.ObjectId,
          sku: updated.sku,
          quantity: item.qty,
          movementId: movement._id as Types.ObjectId,
        });

        if (updated.currentStock <= updated.lowStockThreshold) {
          await notificationRepository.create({
            title: `Low Stock Alert for ${updated.name}`,
            message: `${updated.name} (${updated.sku}) is at ${updated.currentStock} units. Threshold: ${updated.lowStockThreshold}.`,
            isRead: false,
            date: new Date(),
          });
          try {
            await emailService.sendLowStockAlert(updated);
          } catch (error) {
            console.error(`[email] Failed low-stock alert for ${updated.sku}`, error);
          }
        }

        deducted.push({ productId: updated.id, qty: item.qty });
        lines.push({
          productRef: updated._id,
          qty: item.qty,
          price: item.price ?? updated.price,
        });
      }

      const totalAmount = lines.reduce((sum, line) => sum + line.qty * line.price, 0);

      const sale = await saleRepository.create({
        invoiceNumber,
        customerRef: new Types.ObjectId(input.customerRef),
        items: lines,
        totalAmount,
        status: 'COMPLETE',
        createdBy: new Types.ObjectId(input.createdBy),
      });

      // The invoice is committed; now the yard turns it into an outbound shipment (never throws).
      await yardAfterSale(
        { invoiceNumber, saleId: String(sale._id), customerName: customer.name, lines: yardLines },
        { siteCode: input.siteCode }
      );

      return sale;
    } catch (error) {
      await Promise.all(deducted.map((row) => productRepository.incrementStock(row.productId, row.qty)));
      throw error;
    }
  }

  async list() {
    return saleRepository.findAll();
  }

  async getById(id: string) {
    const sale = await saleRepository.findById(id);
    if (!sale) throw new AppError(404, 'Sale not found');
    return sale;
  }
}

export const saleService = new SaleService();
