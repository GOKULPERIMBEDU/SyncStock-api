import { Document, Schema, model } from 'mongoose';

/**
 * A warehouse workspace profile (one per organisation / tenant). Profiles are lightweight: they carry the identity,
 * currency, tax and material categories an operator works with, and the site they land on. The ledger and the yard
 * are shared, so a profile never hides stock; it decides how the app presents it.
 */
export interface ISystemSetting {
  /** URL-safe slug, unique across profiles (`syncstock-india`). Sent by the web app as `X-Tenant-Id`. */
  tenantId: string;
  organizationName: string;
  /** Mirror of `organizationName`, kept so clients written before workspaces existed keep working. */
  companyName: string;
  /** Free-text industry label, e.g. `IT Hardware & Peripherals`. */
  industryType: string;
  /** Facility the workspace opens on (`WH-01`..`WH-05`). */
  defaultSiteCode: string;
  /** Material categories this organisation works with, on top of any already present in the catalogue. */
  customCategories: string[];
  currency: string;
  taxRate: number;
  /** The profile used when a request names no tenant. */
  isDefault: boolean;
}

export interface ISystemSettingDocument extends ISystemSetting, Document {
  createdAt: Date;
  updatedAt: Date;
}

const systemSettingSchema = new Schema<ISystemSettingDocument>(
  {
    tenantId: { type: String, required: true, unique: true, trim: true, lowercase: true },
    organizationName: { type: String, required: true, trim: true, default: 'SyncStock' },
    companyName: { type: String, trim: true, default: '' },
    industryType: { type: String, trim: true, default: 'General warehousing' },
    defaultSiteCode: { type: String, trim: true, uppercase: true, default: 'WH-02' },
    customCategories: { type: [String], default: [] },
    currency: { type: String, required: true, trim: true, uppercase: true, default: 'INR' },
    taxRate: { type: Number, required: true, min: 0, default: 0 },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

systemSettingSchema.pre('validate', function keepNamesInSync(next) {
  if (!this.companyName) this.companyName = this.organizationName;
  else if (this.isModified('organizationName') && !this.isModified('companyName')) this.companyName = this.organizationName;
  else if (this.isModified('companyName') && !this.isModified('organizationName')) this.organizationName = this.companyName;
  next();
});

export const SystemSetting = model<ISystemSettingDocument>('SystemSetting', systemSettingSchema);
