import { Types } from 'mongoose';
import type { IProductDocument } from '../models/Product.model';
import { notificationRepository } from '../repositories/notification.repository';
import { productRepository } from '../repositories/product.repository';
import {
  stockMovementRepository,
  type MovementListQuery,
} from '../repositories/stockMovement.repository';
import type { AdjustStockInput, StockChangeInput } from '../types';
import { AppError } from '../utils/AppError';
import { emailService } from './email.service';
import { yardAfterStockIn, yardAfterStockOut, type YardHookOptions } from './yard/bridge';

export class StockService {
  /**
   * Stock-in. After the ledger write, the yard bridge raises (or extends) an inbound shipment so a truck, a bay and a
   * forklift physically receive the goods. `yard` carries the purchase receipt context when it comes from an order.
   */
  async restock(productId: string, input: StockChangeInput, handledBy?: string, yard?: YardHookOptions) {
    await this.requireProduct(productId);

    const updated = await productRepository.incrementStock(productId, input.quantity);
    if (!updated) {
      throw new AppError(404, 'Product not found');
    }

    const previousStock = updated.currentStock - input.quantity;
    const movement = await this.recordMovement({
      product: updated,
      quantity: input.quantity,
      type: 'IN',
      reason: input.reason,
      previousStock,
      handledBy,
    });

    await this.maybeAlertLowStock(updated, previousStock);
    await yardAfterStockIn(
      { productId: updated._id as Types.ObjectId, sku: updated.sku, quantity: input.quantity, movementId: movement._id as Types.ObjectId },
      yard
    );

    return { product: updated, movement };
  }

  /**
   * Dispatch uses an atomic filter (`currentStock >= quantity`) so two concurrent
   * OUT requests cannot both succeed if that would take stock below zero.
   * The yard bridge then raises an outbound shipment for the goods.
   */
  async dispatch(productId: string, input: StockChangeInput, handledBy?: string, yard?: YardHookOptions) {
    const existing = await this.requireProduct(productId);

    const updated = await productRepository.decrementIfSufficient(productId, input.quantity);
    if (!updated) {
      throw new AppError(
        409,
        `Insufficient stock. Available: ${existing.currentStock}, requested: ${input.quantity}`
      );
    }

    const previousStock = updated.currentStock + input.quantity;
    const movement = await this.recordMovement({
      product: updated,
      quantity: input.quantity,
      type: 'OUT',
      reason: input.reason,
      previousStock,
      handledBy,
    });

    await this.maybeAlertLowStock(updated, previousStock);
    await yardAfterStockOut(
      { productId: updated._id as Types.ObjectId, sku: updated.sku, quantity: input.quantity, movementId: movement._id as Types.ObjectId },
      yard
    );

    return { product: updated, movement };
  }

  async adjust(productId: string, input: AdjustStockInput, handledBy?: string) {
    const existing = await this.requireProduct(productId);
    const previousStock = existing.currentStock;

    if (previousStock === input.quantity) {
      return { product: existing, movement: null };
    }

    const updated = await productRepository.setStock(productId, input.quantity);
    if (!updated) {
      throw new AppError(404, 'Product not found');
    }

    const delta = Math.abs(updated.currentStock - previousStock);
    const movement = await this.recordMovement({
      product: updated,
      quantity: delta,
      type: 'ADJUSTMENT',
      reason: input.reason,
      previousStock,
      handledBy,
    });

    await this.maybeAlertLowStock(updated, previousStock);

    return { product: updated, movement };
  }

  async listMovements(query: MovementListQuery) {
    return stockMovementRepository.findRecent(query);
  }

  private async requireProduct(id: string): Promise<IProductDocument> {
    const product = await productRepository.findById(id);
    if (!product) {
      throw new AppError(404, 'Product not found');
    }
    return product;
  }

  private async recordMovement(params: {
    product: IProductDocument;
    quantity: number;
    type: 'IN' | 'OUT' | 'ADJUSTMENT';
    reason: string;
    previousStock: number;
    handledBy?: string;
  }) {
    return stockMovementRepository.create({
      productId: params.product._id,
      quantity: params.quantity,
      type: params.type,
      reason: params.reason,
      previousStock: params.previousStock,
      newStock: params.product.currentStock,
      handledBy: params.handledBy ? new Types.ObjectId(params.handledBy) : undefined,
    });
  }

  /**
   * Alert when stock has decreased and is now at or below the product threshold.
   * Email failures are logged and never roll back the stock change.
   */
  private async maybeAlertLowStock(
    product: IProductDocument,
    previousStock: number
  ): Promise<void> {
    const dropped = product.currentStock < previousStock;
    const isLow = product.currentStock <= product.lowStockThreshold;

    if (!dropped || !isLow) {
      return;
    }

    await notificationRepository.create({
      title: `Low Stock Alert for ${product.name}`,
      message: `${product.name} (${product.sku}) is at ${product.currentStock} units. Threshold: ${product.lowStockThreshold}.`,
      isRead: false,
      date: new Date(),
    });

    try {
      await emailService.sendLowStockAlert(product);
    } catch (error) {
      console.error(`[email] Failed low-stock alert for ${product.sku}`, error);
    }
  }
}

export const stockService = new StockService();
