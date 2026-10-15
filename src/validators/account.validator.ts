import { z } from 'zod';

export const createAccountSchema = z.object({
  body: z.object({
    transactionId: z.string().trim().min(1),
    type: z.enum(['CREDIT', 'DEBIT']),
    amount: z.number().nonnegative(),
    date: z.coerce.date().optional(),
    description: z.string().trim().min(1),
    orderRef: z.string().min(1).optional(),
    saleRef: z.string().min(1).optional(),
  }),
});

export const updateAccountSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    type: z.enum(['CREDIT', 'DEBIT']).optional(),
    amount: z.number().nonnegative().optional(),
    date: z.coerce.date().optional(),
    description: z.string().trim().min(1).optional(),
    orderRef: z.string().min(1).optional(),
    saleRef: z.string().min(1).optional(),
  }),
});
