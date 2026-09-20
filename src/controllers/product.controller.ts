import type { Request, Response } from 'express';
import { productService } from '../services/product.service';
import type { ProductListQuery, StockStatusFilter } from '../types';
import { ok } from '../utils/response';

export class ProductController {
  create = async (req: Request, res: Response): Promise<void> => {
    const product = await productService.create(req.body);
    ok(res, product, 201);
  };

  list = async (req: Request, res: Response): Promise<void> => {
    const query = req.query as ProductListQuery;
    const products = await productService.list({
      search: query.search,
      category: query.category,
      stockStatus: query.stockStatus as StockStatusFilter | undefined,
    });
    ok(res, products);
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    const product = await productService.getById(req.params.id);
    ok(res, product);
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const product = await productService.update(req.params.id, req.body);
    ok(res, product);
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    await productService.remove(req.params.id);
    ok(res, { deleted: true });
  };

  categories = async (_req: Request, res: Response): Promise<void> => {
    const categories = await productService.listCategories();
    ok(res, categories);
  };
}

export const productController = new ProductController();
