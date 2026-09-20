import { z } from 'zod';

export const createSaleSchema = z.object({
  body: z.object({
    customerRef: z.string().min(1),
    items: z
      .array(
        z.object({
          productRef: z.string().min(1),
          qty: z.number().int().positive(),
          price: z.number().nonnegative().optional(),
        })
      )
      .min(1),
  }),
});

export const saleIdParamSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
});
