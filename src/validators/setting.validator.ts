import { z } from 'zod';

const siteCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9-]{2,12}$/, 'Site code looks like WH-02');

const categories = z
  .array(z.string().trim().min(1).max(40))
  .max(40)
  .transform((values) => [...new Map(values.map((value) => [value.toLowerCase(), value])).values()]);

const currency = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, 'Currency is a 3-letter ISO code such as INR');

export const updateSettingSchema = z.object({
  body: z.object({
    organizationName: z.string().trim().min(1).max(80).optional(),
    companyName: z.string().trim().min(1).max(80).optional(),
    industryType: z.string().trim().min(1).max(80).optional(),
    defaultSiteCode: siteCode.optional(),
    customCategories: categories.optional(),
    currency: currency.optional(),
    taxRate: z.number().min(0).max(100).optional(),
  }),
});

export const createWorkspaceSchema = z.object({
  body: z.object({
    tenantId: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/, 'Workspace id is a slug such as acme-logistics'),
    organizationName: z.string().trim().min(1).max(80),
    industryType: z.string().trim().min(1).max(80).default('General warehousing'),
    defaultSiteCode: siteCode.default('WH-02'),
    customCategories: categories.default([]),
    currency: currency.default('INR'),
    taxRate: z.number().min(0).max(100).default(0),
  }),
});
