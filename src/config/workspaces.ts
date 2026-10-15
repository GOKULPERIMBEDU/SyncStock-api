import type { ISystemSetting } from '../models/SystemSetting';

export const DEFAULT_TENANT_ID = 'syncstock-india';

/**
 * Warehouse workspace presets. They are created once (never overwritten) so an operator can switch between businesses
 * of very different kinds on the same SyncStock install: each brings its own currency, tax rate, material categories
 * and landing facility.
 */
export const WORKSPACE_PRESETS: ISystemSetting[] = [
  {
    tenantId: DEFAULT_TENANT_ID,
    organizationName: 'SyncStock India Pvt Ltd',
    companyName: 'SyncStock India Pvt Ltd',
    industryType: 'IT Hardware & Peripherals',
    defaultSiteCode: 'WH-02',
    customCategories: ['Displays', 'Peripherals', 'Components'],
    currency: 'INR',
    taxRate: 18,
    isDefault: true,
  },
  {
    tenantId: 'packsafe-industrial',
    organizationName: 'PackSafe Industrial Supplies',
    companyName: 'PackSafe Industrial Supplies',
    industryType: 'Packaging, PPE & Logistics',
    defaultSiteCode: 'WH-01',
    customCategories: ['Packaging', 'PPE', 'Logistics'],
    currency: 'INR',
    taxRate: 18,
    isDefault: false,
  },
  {
    tenantId: 'freshline-fmcg',
    organizationName: 'FreshLine FMCG Distribution',
    companyName: 'FreshLine FMCG Distribution',
    industryType: 'FMCG & Cold Chain',
    defaultSiteCode: 'WH-03',
    customCategories: ['Beverages', 'Dairy', 'Frozen Foods', 'Snacks'],
    currency: 'INR',
    taxRate: 5,
    isDefault: false,
  },
  {
    tenantId: 'northwind-industrial',
    organizationName: 'Northwind Industrial Goods',
    companyName: 'Northwind Industrial Goods',
    industryType: 'Industrial Goods & MRO',
    defaultSiteCode: 'WH-04',
    customCategories: ['Fasteners', 'Bearings', 'Hydraulics', 'Tools'],
    currency: 'USD',
    taxRate: 8,
    isDefault: false,
  },
];
