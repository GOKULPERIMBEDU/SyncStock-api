import { z } from 'zod';

export const updateSettingSchema = z.object({
  body: z.object({
    companyName: z.string().trim().min(1).optional(),
    currency: z.string().trim().min(1).optional(),
    taxRate: z.number().min(0).optional(),
  }),
});
