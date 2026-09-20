import { z } from 'zod';

export const createPaymentSchema = z.object({
  body: z.object({
    paymentId: z.string().trim().min(1),
    orderRef: z.string().min(1).optional(),
    saleRef: z.string().min(1).optional(),
    amount: z.number().nonnegative(),
    paymentMethod: z.enum(['BANK', 'CARD', 'CASH']),
    status: z.enum(['PENDING', 'COMPLETED', 'FAILED']).optional(),
    paymentDate: z.coerce.date().optional(),
  }),
});

export const updatePaymentSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    amount: z.number().nonnegative().optional(),
    paymentMethod: z.enum(['BANK', 'CARD', 'CASH']).optional(),
    status: z.enum(['PENDING', 'COMPLETED', 'FAILED']).optional(),
    paymentDate: z.coerce.date().optional(),
    orderRef: z.string().min(1).optional(),
    saleRef: z.string().min(1).optional(),
  }),
});
