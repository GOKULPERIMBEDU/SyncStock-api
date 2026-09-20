export type MovementType = 'IN' | 'OUT' | 'ADJUSTMENT';

export type StockStatusFilter = 'all' | 'in' | 'low' | 'out';

export interface CreateProductInput {
  name: string;
  sku: string;
  barcode?: string;
  category: string;
  price: number;
  currentStock?: number;
  lowStockThreshold?: number;
}

export interface UpdateProductInput {
  name?: string;
  sku?: string;
  barcode?: string;
  category?: string;
  price?: number;
  lowStockThreshold?: number;
}

export interface ProductListQuery {
  search?: string;
  category?: string;
  stockStatus?: StockStatusFilter;
}

export interface StockChangeInput {
  quantity: number;
  reason: string;
}

export interface AdjustStockInput {
  quantity: number;
  reason: string;
}
