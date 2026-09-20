import type { FilterQuery } from 'mongoose';
import { Product, type IProduct, type IProductDocument } from '../models/Product.model';
import type { ProductListQuery } from '../types';

export class ProductRepository {
  async create(data: IProduct): Promise<IProductDocument> {
    return Product.create(data);
  }

  async findById(id: string): Promise<IProductDocument | null> {
    return Product.findById(id);
  }

  async findBySku(sku: string): Promise<IProductDocument | null> {
    return Product.findOne({ sku: sku.toUpperCase() });
  }

  async findAll(query: ProductListQuery = {}): Promise<IProductDocument[]> {
    const filter: FilterQuery<IProductDocument> = {};

    if (query.search) {
      const term = query.search.trim();
      filter.$or = [
        { name: { $regex: term, $options: 'i' } },
        { sku: { $regex: term, $options: 'i' } },
        { barcode: { $regex: term, $options: 'i' } },
      ];
    }

    if (query.category) {
      filter.category = query.category;
    }

    if (query.stockStatus === 'out') {
      filter.currentStock = 0;
    } else if (query.stockStatus === 'low') {
      filter.currentStock = { $gt: 0 };
      filter.$expr = { $lte: ['$currentStock', '$lowStockThreshold'] };
    } else if (query.stockStatus === 'in') {
      filter.$expr = { $gt: ['$currentStock', '$lowStockThreshold'] };
    }

    return Product.find(filter).sort({ updatedAt: -1 });
  }

  async updateById(
    id: string,
    data: Partial<Omit<IProduct, 'currentStock'>>
  ): Promise<IProductDocument | null> {
    return Product.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true });
  }

  async deleteById(id: string): Promise<IProductDocument | null> {
    return Product.findByIdAndDelete(id);
  }

  /**
   * Atomically increment stock. Safe under concurrent restocks.
   */
  async incrementStock(id: string, quantity: number): Promise<IProductDocument | null> {
    return Product.findOneAndUpdate(
      { _id: id },
      { $inc: { currentStock: quantity } },
      { new: true, runValidators: true }
    );
  }

  /**
   * Atomically decrement stock only when enough units exist.
   * This is the concurrency guard: two simultaneous OUT requests cannot both succeed
   * if that would take stock below zero.
   */
  async decrementIfSufficient(id: string, quantity: number): Promise<IProductDocument | null> {
    return Product.findOneAndUpdate(
      { _id: id, currentStock: { $gte: quantity } },
      { $inc: { currentStock: -quantity } },
      { new: true, runValidators: true }
    );
  }

  /**
   * Set an absolute stock level. Quantity must already be validated as >= 0.
   */
  async setStock(id: string, quantity: number): Promise<IProductDocument | null> {
    return Product.findOneAndUpdate(
      { _id: id },
      { $set: { currentStock: quantity } },
      { new: true, runValidators: true }
    );
  }

  async countAll(): Promise<number> {
    return Product.countDocuments();
  }

  async findOutOfStock(): Promise<IProductDocument[]> {
    return Product.find({ currentStock: 0 }).sort({ name: 1 });
  }

  async findLowStock(): Promise<IProductDocument[]> {
    return Product.find({
      currentStock: { $gt: 0 },
      $expr: { $lte: ['$currentStock', '$lowStockThreshold'] },
    }).sort({ currentStock: 1, name: 1 });
  }

  async distinctCategories(): Promise<string[]> {
    return Product.distinct('category');
  }

  async aggregateStockValue(): Promise<{ totalProducts: number; totalStockValue: number }> {
    const [result] = await Product.aggregate<{
      totalProducts: number;
      totalStockValue: number;
    }>([
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          totalStockValue: { $sum: { $multiply: ['$price', '$currentStock'] } },
        },
      },
    ]);

    return {
      totalProducts: result?.totalProducts ?? 0,
      totalStockValue: result?.totalStockValue ?? 0,
    };
  }
}

export const productRepository = new ProductRepository();
