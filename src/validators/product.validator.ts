import { z } from 'zod';

export const createProductSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1, 'Name is required'),
    sku: z.string().trim().min(1, 'SKU is required'),
    barcode: z.string().trim().optional(),
    category: z.string().trim().min(1, 'Category is required'),
    price: z.number().nonnegative('Price cannot be negative'),
    currentStock: z.number().int().nonnegative().optional(),
    lowStockThreshold: z.number().int().nonnegative().optional(),
  }),
});

export const updateProductSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z
    .object({
      name: z.string().trim().min(1).optional(),
      sku: z.string().trim().min(1).optional(),
      barcode: z.string().trim().optional(),
      category: z.string().trim().min(1).optional(),
      price: z.number().nonnegative().optional(),
      lowStockThreshold: z.number().int().nonnegative().optional(),
    })
    .refine((value) => Object.keys(value).length > 0, {
      message: 'At least one field must be provided',
    }),
});

export const productIdParamSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});

export const productListQuerySchema = z.object({
  query: z.object({
    search: z.string().optional(),
    category: z.string().optional(),
    stockStatus: z.enum(['all', 'in', 'low', 'out']).optional(),
  }),
});
