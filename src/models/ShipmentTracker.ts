import { Document, Schema, Types, model } from 'mongoose';

export const SHIPMENT_STAGES = ['Order Confirmed', 'Picked', 'Loading', 'In Transit', 'Delivered'] as const;
export type ShipmentStage = (typeof SHIPMENT_STAGES)[number];
export type ShipmentDirection = 'Inbound' | 'Outbound';
export type ShipmentLinkType = 'PurchaseReceipt' | 'SalesInvoice' | 'StockIn' | 'StockOut' | 'Seed';

export interface IShipmentLine {
  productId: Types.ObjectId;
  sku: string;
  quantity: number;
  /** Units already moved by the yard: put away on racks (inbound) or loaded onto the truck (outbound). */
  done?: number;
}

/**
 * An inbound or outbound shipment (`SHP-20931`). Inbound shipments follow the ledger's purchase receipts / stock-ins,
 * outbound ones follow sales invoices / stock-outs, so the yard always has a business reason for a truck being on site.
 */
export interface IShipmentTracker {
  /** `SHP-20931`. */
  code: string;
  siteCode: string;
  direction: ShipmentDirection;
  stage: ShipmentStage;
  linkType: ShipmentLinkType;
  /** Business reference in the ledger, e.g. `ORD-10503` or `INV-009`. */
  linkRef: string;
  /** Idempotency key so repeat receipts against one order merge into one shipment. */
  sourceKey: string;
  orderId?: Types.ObjectId | null;
  saleId?: Types.ObjectId | null;
  /** Supplier (inbound) or customer (outbound), shown as `Inbound from X` / `Outbound to X`. */
  partyName: string;
  /** Units the ledger document asks for (an order's full quantity); `units` is what has actually arrived. */
  expectedUnits: number;
  /** When false the yard waits for an operator to pick / load / dispatch (ledger-linked shipments). */
  autopilot: boolean;
  origin: string;
  destination: string;
  route: string;
  /** `YardVehicle.code` of the assigned truck. */
  truckId: string | null;
  /** `DockBay.code` of the assigned bay. */
  dockId: string | null;
  units: number;
  manifest: IShipmentLine[];
  etaAt: Date | null;
  /** When the truck left the yard (outbound) or finished unloading (inbound). */
  completedAt: Date | null;
  /** When an outbound truck entered transit; drives the delivered transition. */
  transitStartedAt: Date | null;
}

export interface IShipmentTrackerDocument extends IShipmentTracker, Document {
  createdAt: Date;
  updatedAt: Date;
}

const shipmentLineSchema = new Schema<IShipmentLine>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    sku: { type: String, required: true, trim: true, uppercase: true },
    quantity: { type: Number, required: true, min: 1 },
    done: { type: Number, min: 0, default: 0 },
  },
  { _id: false }
);

const shipmentTrackerSchema = new Schema<IShipmentTrackerDocument>(
  {
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    siteCode: { type: String, required: true, trim: true, uppercase: true, index: true },
    direction: { type: String, enum: ['Inbound', 'Outbound'], required: true },
    stage: { type: String, enum: SHIPMENT_STAGES, required: true, default: 'Order Confirmed' },
    linkType: {
      type: String,
      enum: ['PurchaseReceipt', 'SalesInvoice', 'StockIn', 'StockOut', 'Seed'],
      required: true,
    },
    linkRef: { type: String, required: true, trim: true },
    sourceKey: { type: String, required: true, trim: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', default: null },
    saleId: { type: Schema.Types.ObjectId, ref: 'Sale', default: null },
    partyName: { type: String, trim: true, default: '' },
    expectedUnits: { type: Number, min: 0, default: 0 },
    autopilot: { type: Boolean, default: true },
    origin: { type: String, required: true, trim: true },
    destination: { type: String, required: true, trim: true },
    route: { type: String, required: true, trim: true },
    truckId: { type: String, default: null },
    dockId: { type: String, default: null },
    units: { type: Number, required: true, min: 0 },
    manifest: { type: [shipmentLineSchema], default: [] },
    etaAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    transitStartedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

shipmentTrackerSchema.index({ siteCode: 1, direction: 1, sourceKey: 1 });
shipmentTrackerSchema.index({ siteCode: 1, createdAt: -1 });
shipmentTrackerSchema.index({ linkRef: 1 });

export const ShipmentTracker = model<IShipmentTrackerDocument>('ShipmentTracker', shipmentTrackerSchema);
