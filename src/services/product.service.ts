import { productRepository } from '../repositories/product.repository';
import { stockMovementRepository } from '../repositories/stockMovement.repository';
import type { CreateProductInput, ProductListQuery, UpdateProductInput } from '../types';
import { AppError } from '../utils/AppError';

export class ProductService {
  async create(input: CreateProductInput) {
    const sku = input.sku.trim().toUpperCase();
    const existing = await productRepository.findBySku(sku);
    if (existing) {
      throw new AppError(409, `SKU ${sku} already exists`);
    }

    const currentStock = input.currentStock ?? 0;
    const product = await productRepository.create({
      name: input.name.trim(),
      sku,
      barcode: input.barcode?.trim() || undefined,
      category: input.category.trim(),
      price: input.price,
      currentStock,
      lowStockThreshold: input.lowStockThreshold ?? 10,
    });

    if (currentStock > 0) {
      await stockMovementRepository.create({
        productId: product._id,
        quantity: currentStock,
        type: 'IN',
        reason: 'Initial stock',
        previousStock: 0,
        newStock: currentStock,
      });
    }

    return product;
  }

  async list(query: ProductListQuery) {
    return productRepository.findAll(query);
  }

  async getById(id: string) {
    const product = await productRepository.findById(id);
    if (!product) {
      throw new AppError(404, 'Product not found');
    }
    return product;
  }

  async update(id: string, input: UpdateProductInput) {
    await this.getById(id);

    if (input.sku) {
      const sku = input.sku.trim().toUpperCase();
      const existing = await productRepository.findBySku(sku);
      if (existing && existing.id !== id) {
        throw new AppError(409, `SKU ${sku} already exists`);
      }
      input.sku = sku;
    }

    const updated = await productRepository.updateById(id, {
      ...input,
      barcode: input.barcode?.trim() || undefined,
    });

    if (!updated) {
      throw new AppError(404, 'Product not found');
    }

    return updated;
  }

  async remove(id: string) {
    const deleted = await productRepository.deleteById(id);
    if (!deleted) {
      throw new AppError(404, 'Product not found');
    }
    return deleted;
  }

  async listCategories() {
    const categories = await productRepository.distinctCategories();
    return categories.filter(Boolean).sort((a, b) => a.localeCompare(b));
  }
}

export const productService = new ProductService();
