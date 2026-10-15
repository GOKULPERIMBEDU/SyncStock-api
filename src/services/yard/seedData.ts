import type { IFacilitySite } from '../../models/FacilitySite';
import type { DockStatus } from '../../models/DockBay';
import type { ShipmentDirection, ShipmentStage } from '../../models/ShipmentTracker';
import type { YardVehicleStatus } from '../../models/YardVehicle';
import { YARD_PRODUCTS } from './constants';

/**
 * Pure seed definitions for the five Chennai / Bengaluru sites. SKUs are plain strings here; the seeder resolves them
 * to real `Product` ObjectIds. WH-02 mirrors the demo yard the web app used to hard-code; the other four are variants.
 */
export interface SeedLine {
  sku: string;
  quantity: number;
}

export interface DockSeed {
  code: string;
  name: string;
  status: DockStatus;
  truck: string | null;
  shipment: string | null;
  /** Wall-clock `HH:mm` (IST, today) the bay entered this status. */
  since: string;
}

export interface TruckSeed {
  code: string;
  model: string;
  carrier: string;
  driver: string;
  status: YardVehicleStatus;
  dock: string | null;
  fuel: number;
  progress: number;
  shipment: string | null;
  manifest: SeedLine[];
}

export interface ForkliftSeed {
  code: string;
  model: string;
  operator: string;
  status: YardVehicleStatus;
  battery: number;
  zone: string;
  bay: string | null;
  sku: string | null;
}

export interface RackSeed {
  code: string;
  zone: string;
  occupied: number;
  sku: string;
}

export interface PalletSeed {
  code: string;
  sku: string;
  units: number;
  layers: number;
  zone: string;
  row: number;
  col: number;
}

export interface ShipmentSeed {
  code: string;
  direction: ShipmentDirection;
  stage: ShipmentStage;
  origin: string;
  destination: string;
  truck: string | null;
  dock: string | null;
  /** Fixed wall-clock ETA (`HH:mm`, IST today), or a number of minutes from now. */
  eta: string | number | null;
  manifest: SeedLine[];
  /** True when the truck is already on the road (outbound `In Transit`). */
  departed?: boolean;
}

export interface SiteSeed {
  site: IFacilitySite;
  docks: DockSeed[];
  trucks: TruckSeed[];
  forklifts: ForkliftSeed[];
  racks: RackSeed[];
  pallets: PalletSeed[];
  shipments: ShipmentSeed[];
}

const CB = 'PKG-CB-0450';
const PC = 'PKG-PC-1120';
const SH = 'PPE-SH-0021';
const WP = 'LOG-WP-1200';
const SW = 'PKG-SW-0500';

const skus = YARD_PRODUCTS.map((product) => product.sku);
const sum = (lines: SeedLine[]) => lines.reduce((total, line) => total + line.quantity, 0);

/** The demo staging layout: Zone A (rows 0-1), Zone B (rows 2-3) and the outbound lane (rows 6-9, column 2). */
const STAGING_LAYOUT: Array<Omit<PalletSeed, 'sku'> & { slot: number }> = [
  { code: 'PAL-1021', slot: 0, units: 240, layers: 1, zone: 'Staging A', row: 0, col: 0 },
  { code: 'PAL-1022', slot: 0, units: 480, layers: 2, zone: 'Staging A', row: 0, col: 1 },
  { code: 'PAL-1023', slot: 1, units: 96, layers: 3, zone: 'Staging A', row: 0, col: 2 },
  { code: 'PAL-1024', slot: 1, units: 64, layers: 2, zone: 'Staging A', row: 1, col: 0 },
  { code: 'PAL-1025', slot: 4, units: 72, layers: 3, zone: 'Staging A', row: 1, col: 1 },
  { code: 'PAL-1026', slot: 2, units: 48, layers: 1, zone: 'Staging A', row: 1, col: 2 },
  { code: 'PAL-1027', slot: 3, units: 40, layers: 3, zone: 'Staging B', row: 2, col: 0 },
  { code: 'PAL-1028', slot: 0, units: 240, layers: 1, zone: 'Staging B', row: 2, col: 1 },
  { code: 'PAL-1029', slot: 2, units: 38, layers: 2, zone: 'Staging B', row: 2, col: 2 },
  { code: 'PAL-1030', slot: 4, units: 60, layers: 2, zone: 'Staging B', row: 3, col: 0 },
  { code: 'PAL-1031', slot: 1, units: 96, layers: 3, zone: 'Staging B', row: 3, col: 1 },
  { code: 'PAL-1032', slot: 3, units: 20, layers: 1, zone: 'Staging B', row: 3, col: 2 },
  { code: 'PAL-1033', slot: 0, units: 480, layers: 2, zone: 'Outbound lane', row: 6, col: 2 },
  { code: 'PAL-1034', slot: 4, units: 40, layers: 1, zone: 'Outbound lane', row: 7, col: 2 },
  { code: 'PAL-1035', slot: 1, units: 64, layers: 2, zone: 'Outbound lane', row: 8, col: 2 },
  { code: 'PAL-1036', slot: 3, units: 30, layers: 2, zone: 'Outbound lane', row: 9, col: 2 },
];

/** Staging pallets with each layout slot's SKU shifted by `rotate`, keeping the first `count` cells. */
function stagingPallets(rotate: number, count: number): PalletSeed[] {
  return STAGING_LAYOUT.slice(0, count).map(({ slot, ...pallet }) => ({
    ...pallet,
    sku: skus[(slot + rotate) % skus.length],
  }));
}

const northgate: SiteSeed = {
  site: {
    code: 'WH-02',
    name: 'Northgate DC',
    location: 'Oragadam Logistics Park, Chennai',
    city: 'Chennai',
    status: 'Operational',
    palletCapacity: 4190,
    palletsStored: 3310,
    utilization: 79,
    palletsDelta: 35,
    trucksDelta: 2,
    onTimeRate: 98.2,
    onTimeDelta: 0.4,
    inboundToday: 128,
    outboundToday: 342,
    kpis: {
      stockDelta: 4.2,
      onTimeTrend: [91, 92, 90, 93, 94, 93, 95, 95, 97, 98.2],
      trucksTrend: [3, 4, 3, 5, 4, 6, 5, 5, 6, 6],
      staffTrend: [3, 4, 4, 5, 4, 5, 6, 5, 5, 5],
    },
  },
  docks: [
    { code: 'D1', name: 'Bay 01', status: 'Loading', truck: 'TRK-204', shipment: 'SHP-20931', since: '08:42' },
    { code: 'D2', name: 'Bay 02', status: 'Available', truck: null, shipment: null, since: '09:15' },
    { code: 'D3', name: 'Bay 03', status: 'Unloading', truck: 'TRK-118', shipment: 'SHP-20918', since: '09:58' },
    { code: 'D4', name: 'Bay 04', status: 'Occupied', truck: 'TRK-342', shipment: 'SHP-20944', since: '10:21' },
    { code: 'D5', name: 'Bay 05', status: 'Maintenance', truck: null, shipment: null, since: '07:30' },
  ],
  trucks: [
    { code: 'TRK-204', model: 'Volvo FH16', carrier: 'BlueLine Logistics', driver: 'Ravi Kumar', status: 'Loading', dock: 'D1', fuel: 72, progress: 64, shipment: 'SHP-20931', manifest: [{ sku: CB, quantity: 480 }, { sku: PC, quantity: 120 }, { sku: SH, quantity: 24 }] },
    { code: 'TRK-118', model: 'Tata Prima 5530', carrier: 'Coastal Freight', driver: 'Meera Iyer', status: 'Unloading', dock: 'D3', fuel: 41, progress: 35, shipment: 'SHP-20918', manifest: [{ sku: WP, quantity: 60 }, { sku: SW, quantity: 40 }] },
    { code: 'TRK-342', model: 'Ashok Leyland 4825', carrier: 'Northstar Haulage', driver: 'Arjun Das', status: 'Idle', dock: 'D4', fuel: 88, progress: 0, shipment: 'SHP-20944', manifest: [{ sku: CB, quantity: 900 }, { sku: WP, quantity: 40 }] },
    { code: 'TRK-077', model: 'BharatBenz 2823', carrier: 'BlueLine Logistics', driver: 'Kavya Nair', status: 'Idle', dock: null, fuel: 23, progress: 0, shipment: 'SHP-20950', manifest: [{ sku: PC, quantity: 300 }] },
    { code: 'TRK-415', model: 'Volvo FM 420', carrier: 'Coastal Freight', driver: 'Imran Shaikh', status: 'In Transit', dock: null, fuel: 58, progress: 100, shipment: 'SHP-20902', manifest: [{ sku: CB, quantity: 1200 }, { sku: SH, quantity: 40 }] },
    { code: 'TRK-509', model: 'Eicher Pro 6049', carrier: 'Northstar Haulage', driver: 'Deepa Rao', status: 'In Transit', dock: null, fuel: 66, progress: 0, shipment: 'SHP-20927', manifest: [{ sku: SW, quantity: 180 }] },
  ],
  forklifts: [
    { code: 'FL-01', model: 'Toyota 8FBE', operator: 'Sanjay P.', status: 'Loading', battery: 64, zone: 'Staging A', bay: 'D1', sku: CB },
    { code: 'FL-02', model: 'Linde E20', operator: 'Lakshmi R.', status: 'Unloading', battery: 52, zone: 'Dock apron', bay: 'D3', sku: WP },
    { code: 'FL-03', model: 'Jungheinrich EFG', operator: 'Unassigned', status: 'Charging', battery: 37, zone: 'Charging bay', bay: null, sku: null },
    { code: 'FL-04', model: 'Toyota 8FBE', operator: 'Vikram S.', status: 'Idle', battery: 81, zone: 'Staging B', bay: null, sku: null },
  ],
  racks: [
    { code: 'R-01', zone: 'Rack row A', occupied: 7, sku: CB },
    { code: 'R-02', zone: 'Rack row A', occupied: 9, sku: CB },
    { code: 'R-03', zone: 'Rack row A', occupied: 6, sku: PC },
    { code: 'R-04', zone: 'Rack row B', occupied: 9, sku: PC },
    { code: 'R-05', zone: 'Rack row B', occupied: 4, sku: CB },
    { code: 'R-06', zone: 'Rack row B', occupied: 5, sku: PC },
  ],
  pallets: stagingPallets(0, 16),
  shipments: [
    { code: 'SHP-20931', direction: 'Outbound', stage: 'Loading', origin: 'Northgate DC', destination: 'Chennai Central DC', truck: 'TRK-204', dock: 'D1', eta: '14:30', manifest: [{ sku: CB, quantity: 480 }, { sku: PC, quantity: 120 }, { sku: SH, quantity: 24 }] },
    { code: 'SHP-20918', direction: 'Inbound', stage: 'Delivered', origin: 'Pune Plant', destination: 'Northgate DC', truck: 'TRK-118', dock: 'D3', eta: null, manifest: [{ sku: WP, quantity: 60 }, { sku: SW, quantity: 40 }] },
    { code: 'SHP-20944', direction: 'Outbound', stage: 'Picked', origin: 'Northgate DC', destination: 'Hosur Retail Park', truck: 'TRK-342', dock: 'D4', eta: '16:10', manifest: [{ sku: CB, quantity: 900 }, { sku: WP, quantity: 40 }] },
    { code: 'SHP-20950', direction: 'Outbound', stage: 'Order Confirmed', origin: 'Northgate DC', destination: 'Vellore Depot', truck: 'TRK-077', dock: null, eta: '18:45', manifest: [{ sku: PC, quantity: 300 }] },
    { code: 'SHP-20902', direction: 'Outbound', stage: 'In Transit', origin: 'Northgate DC', destination: 'Bengaluru DC', truck: 'TRK-415', dock: null, eta: '13:05', manifest: [{ sku: CB, quantity: 1200 }, { sku: SH, quantity: 40 }], departed: true },
    { code: 'SHP-20927', direction: 'Inbound', stage: 'In Transit', origin: 'Coimbatore Mill', destination: 'Northgate DC', truck: 'TRK-509', dock: null, eta: 4, manifest: [{ sku: SW, quantity: 180 }] },
  ],
};

interface VariantSpec {
  site: IFacilitySite;
  /** Number used to build shipment codes, e.g. `WH-01` -> 1. */
  number: number;
  rotate: number;
  trucks: Array<{ code: string; model: string; carrier: string; driver: string }>;
  customers: string[];
  suppliers: string[];
  maintenanceDock: boolean;
  rackLevels: number[];
}

/** Builds a plausible, smaller yard for a sibling site: one loading, one unloading, one queued and one departed truck. */
function variant(spec: VariantSpec): SiteSeed {
  const { site, number, rotate, trucks, customers, suppliers } = spec;
  const skuAt = (offset: number) => skus[(rotate + offset) % skus.length];
  const shp = (n: number) => `SHP-${21000 + number * 10 + n}`;
  const [loadingTruck, unloadingTruck, queuedTruck, transitTruck] = trucks;

  const loadingManifest: SeedLine[] = [{ sku: skuAt(0), quantity: 240 + rotate * 40 }, { sku: skuAt(1), quantity: 96 }];
  const unloadingManifest: SeedLine[] = [{ sku: skuAt(2), quantity: 120 }, { sku: skuAt(3), quantity: 60 }];
  const queuedManifest: SeedLine[] = [{ sku: skuAt(4), quantity: 180 }];
  const transitManifest: SeedLine[] = [{ sku: skuAt(0), quantity: 600 }];

  return {
    site,
    docks: [
      { code: 'D1', name: 'Bay 01', status: 'Loading', truck: loadingTruck.code, shipment: shp(1), since: '08:20' },
      { code: 'D2', name: 'Bay 02', status: 'Available', truck: null, shipment: null, since: '09:05' },
      { code: 'D3', name: 'Bay 03', status: 'Unloading', truck: unloadingTruck.code, shipment: shp(2), since: '09:40' },
      { code: 'D4', name: 'Bay 04', status: 'Available', truck: null, shipment: null, since: '10:10' },
      { code: 'D5', name: 'Bay 05', status: spec.maintenanceDock ? 'Maintenance' : 'Available', truck: null, shipment: null, since: '07:45' },
    ],
    trucks: [
      { ...loadingTruck, status: 'Loading', dock: 'D1', fuel: 55 + rotate * 6, progress: 28 + rotate * 11, shipment: shp(1), manifest: loadingManifest },
      { ...unloadingTruck, status: 'Unloading', dock: 'D3', fuel: 47 + rotate * 5, progress: 52 - rotate * 6, shipment: shp(2), manifest: unloadingManifest },
      { ...queuedTruck, status: 'Idle', dock: null, fuel: 72, progress: 0, shipment: shp(3), manifest: queuedManifest },
      { ...transitTruck, status: 'In Transit', dock: null, fuel: 64, progress: 100, shipment: shp(4), manifest: transitManifest },
    ],
    forklifts: [
      { code: 'FL-01', model: 'Toyota 8FBE', operator: 'Sanjay P.', status: 'Loading', battery: 70 - rotate * 4, zone: 'Staging A', bay: 'D1', sku: loadingManifest[0].sku },
      { code: 'FL-02', model: 'Linde E20', operator: 'Lakshmi R.', status: 'Unloading', battery: 58 + rotate * 3, zone: 'Dock apron', bay: 'D3', sku: unloadingManifest[0].sku },
      { code: 'FL-03', model: 'Jungheinrich EFG', operator: 'Unassigned', status: 'Charging', battery: 30 + rotate * 9, zone: 'Charging bay', bay: null, sku: null },
      { code: 'FL-04', model: 'Toyota 8FBE', operator: 'Vikram S.', status: 'Idle', battery: 86 - rotate * 5, zone: 'Staging B', bay: null, sku: null },
    ],
    racks: spec.rackLevels.map((occupied, index) => ({
      code: `R-0${index + 1}`,
      zone: index < 3 ? 'Rack row A' : 'Rack row B',
      occupied,
      sku: skuAt([0, 0, 1, 1, 3, 4][index]),
    })),
    pallets: stagingPallets(rotate, 10 + rotate).map((pallet, index) => ({ ...pallet, code: `PAL-${1021 + index}` })),
    shipments: [
      { code: shp(1), direction: 'Outbound', stage: 'Loading', origin: site.name, destination: customers[0], truck: loadingTruck.code, dock: 'D1', eta: '15:20', manifest: loadingManifest },
      { code: shp(2), direction: 'Inbound', stage: 'Delivered', origin: suppliers[0], destination: site.name, truck: unloadingTruck.code, dock: 'D3', eta: null, manifest: unloadingManifest },
      { code: shp(3), direction: 'Outbound', stage: 'Order Confirmed', origin: site.name, destination: customers[1], truck: queuedTruck.code, dock: null, eta: '19:00', manifest: queuedManifest },
      { code: shp(4), direction: 'Outbound', stage: 'In Transit', origin: site.name, destination: customers[2], truck: transitTruck.code, dock: null, eta: '12:40', manifest: transitManifest, departed: true },
    ],
  };
}

const baseKpis = (stockDelta: number, onTime: number) => ({
  stockDelta,
  onTimeTrend: [88, 90, 91, 92, 91, 93, 94, 94, 95, onTime],
  trucksTrend: [2, 3, 3, 4, 3, 4, 5, 4, 4, 4],
  staffTrend: [3, 3, 4, 4, 4, 5, 4, 4, 5, 5],
});

const riverside = variant({
  number: 1,
  rotate: 0,
  site: { code: 'WH-01', name: 'Riverside Hub', location: 'SIPCOT Industrial Park, Chennai', city: 'Chennai', status: 'Operational', palletCapacity: 3641, palletsStored: 2840, utilization: 78, palletsDelta: 22, trucksDelta: 1, onTimeRate: 96.4, onTimeDelta: 1.8, inboundToday: 112, outboundToday: 296, kpis: baseKpis(4.2, 96.4) },
  trucks: [
    { code: 'TRK-231', model: 'Tata Signa 4825', carrier: 'BlueLine Logistics', driver: 'Mohan Raj' },
    { code: 'TRK-306', model: 'Ashok Leyland 4225', carrier: 'Coastal Freight', driver: 'Selvam K.' },
    { code: 'TRK-188', model: 'BharatBenz 2823', carrier: 'Northstar Haulage', driver: 'Faisal Ahmed' },
    { code: 'TRK-452', model: 'Volvo FM 420', carrier: 'BlueLine Logistics', driver: 'Gopal S.' },
  ],
  customers: ['Chennai Central DC', 'Tiruvallur Depot', 'Pondicherry Mart'],
  suppliers: ['Madurai Plant'],
  maintenanceDock: false,
  rackLevels: [8, 9, 5, 7, 6, 3],
});

const eastport = variant({
  number: 3,
  rotate: 1,
  site: { code: 'WH-03', name: 'Eastport Cold Store', location: 'Ennore Port Road, Chennai', city: 'Chennai', status: 'Operational', palletCapacity: 1324, palletsStored: 1205, utilization: 91, palletsDelta: -18, trucksDelta: 0, onTimeRate: 97.5, onTimeDelta: 0.2, inboundToday: 84, outboundToday: 210, kpis: baseKpis(-1.4, 97.5) },
  trucks: [
    { code: 'TRK-412', model: 'Eicher Pro 6049', carrier: 'Coastal Freight', driver: 'Dinesh B.' },
    { code: 'TRK-267', model: 'Tata Prima 5530', carrier: 'Northstar Haulage', driver: 'Joseph Antony' },
    { code: 'TRK-139', model: 'Ashok Leyland 4825', carrier: 'BlueLine Logistics', driver: 'Prakash V.' },
    { code: 'TRK-478', model: 'Volvo FH16', carrier: 'Coastal Freight', driver: 'Rizwan Khan' },
  ],
  customers: ['Ennore Port Terminal', 'Ponneri Cold Chain', 'Chennai Fresh Hub'],
  suppliers: ['Kakinada Exports'],
  maintenanceDock: true,
  rackLevels: [9, 9, 8, 9, 7, 8],
});

const southfield = variant({
  number: 4,
  rotate: 2,
  site: { code: 'WH-04', name: 'Southfield Cross-Dock', location: 'Hosur Road, Bengaluru', city: 'Bengaluru', status: 'Degraded', palletCapacity: 3842, palletsStored: 1460, utilization: 38, palletsDelta: 12, trucksDelta: 1, onTimeRate: 94.7, onTimeDelta: -0.6, inboundToday: 156, outboundToday: 288, kpis: baseKpis(1.1, 94.7) },
  trucks: [
    { code: 'TRK-351', model: 'Tata Signa 4825', carrier: 'Northstar Haulage', driver: 'Harish Gowda' },
    { code: 'TRK-129', model: 'BharatBenz 3128', carrier: 'BlueLine Logistics', driver: 'Manjunath R.' },
    { code: 'TRK-486', model: 'Eicher Pro 6049', carrier: 'Coastal Freight', driver: 'Suresh Babu' },
    { code: 'TRK-217', model: 'Volvo FM 420', carrier: 'Northstar Haulage', driver: 'Imtiyaz Ali' },
  ],
  customers: ['Bengaluru DC', 'Electronic City Hub', 'Mysuru Retail'],
  suppliers: ['Hosur Plant'],
  maintenanceDock: false,
  rackLevels: [3, 4, 2, 5, 3, 2],
});

const lakeside = variant({
  number: 5,
  rotate: 3,
  site: { code: 'WH-05', name: 'Lakeside Fulfilment', location: 'Sriperumbudur, Chennai', city: 'Chennai', status: 'Operational', palletCapacity: 3000, palletsStored: 1920, utilization: 64, palletsDelta: 8, trucksDelta: -1, onTimeRate: 96.9, onTimeDelta: 0.3, inboundToday: 96, outboundToday: 305, kpis: baseKpis(2.6, 96.9) },
  trucks: [
    { code: 'TRK-094', model: 'Tata Prima 5530', carrier: 'BlueLine Logistics', driver: 'Karthikeyan M.' },
    { code: 'TRK-533', model: 'Ashok Leyland 4225', carrier: 'Coastal Freight', driver: 'Yusuf Pasha' },
    { code: 'TRK-368', model: 'Volvo FH16', carrier: 'Northstar Haulage', driver: 'Bala Murugan' },
    { code: 'TRK-244', model: 'BharatBenz 2823', carrier: 'BlueLine Logistics', driver: 'Nithin Raj' },
  ],
  customers: ['Sriperumbudur Assembly', 'Oragadam Mart', 'Kanchipuram Depot'],
  suppliers: ['Hyderabad Packaging'],
  maintenanceDock: true,
  rackLevels: [6, 7, 4, 6, 5, 4],
});

/** Ordered as the site dropdown shows them. */
export const SITE_SEEDS: SiteSeed[] = [riverside, northgate, eastport, southfield, lakeside];

export { sum as sumLines };
