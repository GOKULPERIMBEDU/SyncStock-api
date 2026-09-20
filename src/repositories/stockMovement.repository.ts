import type { FilterQuery } from 'mongoose';
import {
  StockMovement,
  type IStockMovement,
  type IStockMovementDocument,
} from '../models/StockMovement.model';
import type { MovementType } from '../types';

export interface MovementListQuery {
  productId?: string;
  type?: MovementType;
  limit?: number;
}

export class StockMovementRepository {
  async create(data: IStockMovement): Promise<IStockMovementDocument> {
    return StockMovement.create(data);
  }

  async findRecent(query: MovementListQuery = {}): Promise<IStockMovementDocument[]> {
    const filter: FilterQuery<IStockMovementDocument> = {};

    if (query.productId) {
      filter.productId = query.productId;
    }

    if (query.type) {
      filter.type = query.type;
    }

    return StockMovement.find(filter)
      .sort({ createdAt: -1 })
      .limit(query.limit ?? 50)
      .populate('productId', 'name sku category')
      .populate('handledBy', 'name email role');
  }
}

export const stockMovementRepository = new StockMovementRepository();
