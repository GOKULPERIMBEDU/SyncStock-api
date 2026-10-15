import { Document, Schema, Types, model } from 'mongoose';

export type YardVehicleKind = 'Truck' | 'Forklift';
export const VEHICLE_STATUSES = ['Loading', 'Unloading', 'Idle', 'Charging', 'In Transit'] as const;
export type YardVehicleStatus = (typeof VEHICLE_STATUSES)[number];

export interface IVehicleManifestLine {
  productId: Types.ObjectId;
  sku: string;
  quantity: number;
}

/**
 * A truck (`TRK-204`) or forklift (`FL-01`) working a facility yard.
 * Trucks carry a manifest and fuel; forklifts carry battery, zone and operator.
 */
export interface IYardVehicle {
  siteCode: string;
  kind: YardVehicleKind;
  code: string;
  /** Make / model label (`Volvo FH16`); named to avoid clashing with `Document.model`. */
  vehicleModel: string;
  /** Truck carrier / forklift fleet owner. */
  carrier?: string;
  /** Truck driver or forklift operator. */
  operator: string;
  status: YardVehicleStatus;
  /** Task completion, 0-100. For a truck this is the load/unload progress. */
  progress: number;
  /** Dock the vehicle is working (`D1`..`D5`), or null. */
  assignedBay: string | null;
  /** SKU the vehicle is currently moving, if any. */
  activeSku: string | null;
  activeProductId?: Types.ObjectId | null;
  /** Shipment the vehicle is serving (trucks), or null. */
  shipmentId: string | null;
  manifest: IVehicleManifestLine[];
  /** Truck only, 0-100. */
  fuel: number;
  /** Forklift only, 0-100. */
  battery: number;
  /** Forklift only, human-readable yard zone. */
  zone: string;
  /** When the current task began. */
  taskStartedAt?: Date | null;
}

export interface IYardVehicleDocument extends IYardVehicle, Document {
  createdAt: Date;
  updatedAt: Date;
}

const manifestLineSchema = new Schema<IVehicleManifestLine>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    sku: { type: String, required: true, trim: true, uppercase: true },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const yardVehicleSchema = new Schema<IYardVehicleDocument>(
  {
    siteCode: { type: String, required: true, trim: true, uppercase: true, index: true },
    kind: { type: String, enum: ['Truck', 'Forklift'], required: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    vehicleModel: { type: String, required: true, trim: true },
    carrier: { type: String, trim: true },
    operator: { type: String, required: true, trim: true, default: 'Unassigned' },
    status: { type: String, enum: VEHICLE_STATUSES, required: true, default: 'Idle' },
    progress: { type: Number, required: true, min: 0, max: 100, default: 0 },
    assignedBay: { type: String, default: null },
    activeSku: { type: String, default: null },
    activeProductId: { type: Schema.Types.ObjectId, ref: 'Product', default: null },
    shipmentId: { type: String, default: null },
    manifest: { type: [manifestLineSchema], default: [] },
    fuel: { type: Number, min: 0, max: 100, default: 100 },
    battery: { type: Number, min: 0, max: 100, default: 100 },
    zone: { type: String, trim: true, default: '' },
    taskStartedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

yardVehicleSchema.index({ siteCode: 1, code: 1 }, { unique: true });
yardVehicleSchema.index({ siteCode: 1, kind: 1, status: 1 });

export const YardVehicle = model<IYardVehicleDocument>('YardVehicle', yardVehicleSchema);
