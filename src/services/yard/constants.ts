/** Site that ledger transactions are routed to unless a request names another one (`X-Site-Id`). */
export const DEFAULT_SITE_CODE = 'WH-02';

/** How often the server-side yard simulation advances. */
export const YARD_TICK_MS = Number(process.env.YARD_TICK_MS ?? 5000);

/** Outbound trucks that have left stay "In Transit" this long before the shipment counts as delivered. */
export const TRANSIT_DELIVERY_MS = 4 * 60 * 1000;

/** One rack slot in the diorama stands for a block of this many pallet positions in the full facility. */
export const PALLETS_PER_SLOT = 6;

/** Forklifts below this charge head to the charger instead of taking work. */
export const FORKLIFT_MIN_BATTERY = 20;

/** Pallet grid cells the 3D yard can draw: Staging Zone A/B (rows 0-3) and the outbound lane (rows 6-9, column 2). */
export const STAGING_CELLS = Array.from({ length: 4 }, (_, row) => Array.from({ length: 3 }, (_, col) => ({ row, col }))).flat();
export const LANE_CELLS = [6, 7, 8, 9].map((row) => ({ row, col: 2 }));

export function stagingZoneName(row: number): string {
  if (row < 2) return 'Staging A';
  if (row < 6) return 'Staging B';
  return 'Outbound lane';
}

export const DOCK_CODES = ['D1', 'D2', 'D3', 'D4', 'D5'] as const;

export interface YardProductSpec {
  sku: string;
  name: string;
  category: string;
  price: number;
  currentStock: number;
  lowStockThreshold: number;
  /** Typical units on one pallet of this SKU. */
  unitsPerPallet: number;
}

/**
 * Packaging / PPE / pallet SKUs that physically move through the yard. The seeder makes sure each of these exists in
 * the `Product` collection so every pallet, rack and shipment line points at a real product.
 */
export const YARD_PRODUCTS: YardProductSpec[] = [
  { sku: 'PKG-CB-0450', name: 'Cardboard Box', category: 'Packaging', price: 38, currentStock: 4820, lowStockThreshold: 800, unitsPerPallet: 240 },
  { sku: 'PKG-PC-1120', name: 'Plastic Container', category: 'Packaging', price: 245, currentStock: 1240, lowStockThreshold: 300, unitsPerPallet: 96 },
  { sku: 'PPE-SH-0021', name: 'Safety Helmet', category: 'PPE', price: 420, currentStock: 86, lowStockThreshold: 120, unitsPerPallet: 48 },
  { sku: 'LOG-WP-1200', name: 'Wooden Pallet', category: 'Logistics', price: 650, currentStock: 640, lowStockThreshold: 150, unitsPerPallet: 40 },
  { sku: 'PKG-SW-0500', name: 'Stretch Wrap Roll', category: 'Packaging', price: 310, currentStock: 212, lowStockThreshold: 250, unitsPerPallet: 60 },
  { sku: 'PPE-HV-0007', name: 'Hi-Vis Vest', category: 'PPE', price: 180, currentStock: 0, lowStockThreshold: 60, unitsPerPallet: 50 },
];

/** Units on one pallet for the catalogue's hardware SKUs (monitors pack far fewer to a pallet than keyboards). */
const CATALOGUE_PALLET_SIZES: Record<string, number> = {
  'DSP-ARZ-161': 12,
  'DSP-ROG-27Q': 6,
  'DSP-SAM-G8': 4,
  'DSP-LG-5K27': 4,
  'KB-KCH-Q1M': 24,
  'KB-HHKB-HYB': 20,
  'PER-LOG-MX3S': 40,
  'PER-LOG-MXKS': 30,
  'DOCK-CAL-TS4': 12,
  'PWR-ANK-747': 24,
  'AUD-SNY-XM5': 20,
  'MB-FWK-16-7840': 6,
  'MB-FWK-DSP': 10,
  'RAM-COR-64D5': 20,
  'SSD-SAM-990P': 30,
};

/** Fallback pallet size for a material the yard has no specific figure for (any tenant-defined SKU). */
export const DEFAULT_UNITS_PER_PALLET = 50;

export function unitsPerPallet(sku: string): number {
  const key = sku.toUpperCase();
  return YARD_PRODUCTS.find((product) => product.sku === key)?.unitsPerPallet ?? CATALOGUE_PALLET_SIZES[key] ?? DEFAULT_UNITS_PER_PALLET;
}

/** Visual stack height (1-3 layers) for a pallet holding `units` of `sku`. */
export function layersFor(sku: string, units: number): number {
  const full = unitsPerPallet(sku);
  return Math.min(3, Math.max(1, Math.ceil((units / full) * 2)));
}
