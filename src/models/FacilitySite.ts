import { Document, Schema, model } from 'mongoose';

export type FacilityStatus = 'Operational' | 'Degraded' | 'Offline';

export interface IFacilityKpis {
  /** Day-over-day change in yard stock, percent. Recomputed live; this value is only the seed fallback. */
  stockDelta: number;
  onTimeTrend: number[];
  trucksTrend: number[];
  staffTrend: number[];
}

/** A named warehouse site (Chennai / Bengaluru network). One document per physical facility. */
export interface IFacilitySite {
  /** Short business code used everywhere in the yard plane, e.g. `WH-02`. */
  code: string;
  name: string;
  location: string;
  city: 'Chennai' | 'Bengaluru';
  status: FacilityStatus;
  /** Pallet positions the facility can hold. */
  palletCapacity: number;
  /** Pallet positions currently occupied. */
  palletsStored: number;
  /** `palletsStored / palletCapacity` as a whole percentage; kept in sync by the yard services. */
  utilization: number;
  palletsDelta: number;
  trucksDelta: number;
  onTimeRate: number;
  onTimeDelta: number;
  inboundToday: number;
  outboundToday: number;
  kpis: IFacilityKpis;
}

export interface IFacilitySiteDocument extends IFacilitySite, Document {
  createdAt: Date;
  updatedAt: Date;
}

const facilitySiteSchema = new Schema<IFacilitySiteDocument>(
  {
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    location: { type: String, required: true, trim: true },
    city: { type: String, enum: ['Chennai', 'Bengaluru'], required: true },
    status: { type: String, enum: ['Operational', 'Degraded', 'Offline'], required: true, default: 'Operational' },
    palletCapacity: { type: Number, required: true, min: 1 },
    palletsStored: { type: Number, required: true, min: 0, default: 0 },
    utilization: { type: Number, required: true, min: 0, max: 100, default: 0 },
    palletsDelta: { type: Number, required: true, default: 0 },
    trucksDelta: { type: Number, required: true, default: 0 },
    onTimeRate: { type: Number, required: true, min: 0, max: 100, default: 95 },
    onTimeDelta: { type: Number, required: true, default: 0 },
    inboundToday: { type: Number, required: true, min: 0, default: 0 },
    outboundToday: { type: Number, required: true, min: 0, default: 0 },
    kpis: {
      stockDelta: { type: Number, default: 0 },
      onTimeTrend: { type: [Number], default: [] },
      trucksTrend: { type: [Number], default: [] },
      staffTrend: { type: [Number], default: [] },
    },
  },
  { timestamps: true }
);

export const FacilitySite = model<IFacilitySiteDocument>('FacilitySite', facilitySiteSchema);
