import { z } from 'zod';

const productIdParams = z.object({
  productId: z.string().min(1),
});

export const stockChangeSchema = z.object({
  params: productIdParams,
  body: z.object({
    quantity: z.number().int().positive('Quantity must be a positive integer'),
    reason: z.string().trim().min(1, 'Reason is required'),
  }),
});

export const adjustStockSchema = z.object({
  params: productIdParams,
  body: z.object({
    quantity: z.number().int().nonnegative('Adjusted quantity cannot be negative'),
    reason: z.string().trim().min(1, 'Reason is required'),
  }),
});

export const movementsQuerySchema = z.object({
  query: z.object({
    productId: z.string().optional(),
    type: z.enum(['IN', 'OUT', 'ADJUSTMENT']).optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
});
