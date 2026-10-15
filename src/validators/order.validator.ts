import { z } from 'zod';

export const createOrderSchema = z.object({
  body: z.object({
    orderNumber: z.string().trim().min(1),
    partyName: z.string().trim().min(1),
    kind: z.enum(['PURCHASE', 'SALE']),
    status: z.enum(['PENDING', 'COMPLETE', 'PARTIAL']).optional(),
    emailSent: z.boolean().optional(),
    items: z
      .array(
        z.object({
          productId: z.string().min(1),
          quantity: z.number().int().positive(),
          received: z.number().int().nonnegative().optional(),
          unitPrice: z.number().nonnegative().optional(),
        })
      )
      .min(1),
  }),
});

export const updateOrderSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    partyName: z.string().trim().min(1).optional(),
    status: z.enum(['PENDING', 'COMPLETE', 'PARTIAL']).optional(),
    emailSent: z.boolean().optional(),
  }),
});

/** `POST /orders/:id/receive`: both fields are optional; an empty body receives one unit of the next open line. */
export const receiveOrderSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z
    .object({
      quantity: z.number().int().positive().max(100000).optional(),
      all: z.boolean().optional(),
    })
    .optional()
    .default({}),
});

export const orderListQuerySchema = z.object({
  query: z.object({
    kind: z.enum(['PURCHASE', 'SALE']).optional(),
  }),
});
