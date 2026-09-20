import { z } from 'zod';

const customerBody = {
  name: z.string().trim().min(1),
  email: z.string().email(),
  phone: z.string().trim().min(1),
  address: z.string().trim().min(1),
};

export const createCustomerSchema = z.object({
  body: z.object(customerBody),
});

export const updateCustomerSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    name: z.string().trim().min(1).optional(),
    email: z.string().email().optional(),
    phone: z.string().trim().min(1).optional(),
    address: z.string().trim().min(1).optional(),
  }),
});

export const customerIdParamSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
});
