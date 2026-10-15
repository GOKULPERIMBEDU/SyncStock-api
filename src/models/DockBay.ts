import { Document, Schema, model } from 'mongoose';

export const DOCK_STATUSES = ['Available', 'Occupied', 'Loading', 'Unloading', 'Maintenance'] as const;
export type DockStatus = (typeof DOCK_STATUSES)[number];

/** A loading bay (`D1`..`D5`) at a facility. Truck and shipment are referenced by their business codes. */
export interface IDockBay {
  siteCode: string;
  /** `D1`..`D5`. */
  code: string;
  /** Human label, e.g. `Bay 01`. */
  name: string;
  status: DockStatus;
  /** `YardVehicle.code` of the truck backed into the bay, or null. */
  assignedTruckId: string | null;
  /** `ShipmentTracker.code` being worked at the bay, or null. */
  assignedShipmentId: string | null;
  /** When the bay entered its current status. */
  since: Date;
}

export interface IDockBayDocument extends IDockBay, Document {
  createdAt: Date;
  updatedAt: Date;
}

const dockBaySchema = new Schema<IDockBayDocument>(
  {
    siteCode: { type: String, required: true, trim: true, uppercase: true, index: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    status: { type: String, enum: DOCK_STATUSES, required: true, default: 'Available' },
    assignedTruckId: { type: String, default: null },
    assignedShipmentId: { type: String, default: null },
    since: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true }
);

dockBaySchema.index({ siteCode: 1, code: 1 }, { unique: true });

export const DockBay = model<IDockBayDocument>('DockBay', dockBaySchema);
