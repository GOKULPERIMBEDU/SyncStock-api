import { z } from 'zod';

export const shipmentCodeParamSchema = z.object({
  params: z.object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^SHP-\d{3,8}$/, 'Shipment code looks like SHP-20931'),
  }),
});

export const overviewQuerySchema = z.object({
  query: z.object({
    siteId: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9-]{2,12}$/, 'siteId must be a facility code such as WH-02')
      .optional(),
    scope: z.enum(['site', 'network']).optional(),
  }),
});
