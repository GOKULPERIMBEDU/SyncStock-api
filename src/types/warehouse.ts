/**
 * Wire format of `GET /api/warehouse/overview`. It is shaped for the web app's warehouse store (the 2D "Warehouse pulse"
 * dashboard and the 3D spatial yard read the very same object), so ids here are business codes (`TRK-204`, `D1`, `R-01`)
 * except inventory items, whose `id` is the real `Product` ObjectId.
 */
export type StockBadge = 'In Stock' | 'Low Stock' | 'Out of Stock';
export type InventoryIconDto = 'box' | 'container' | 'helmet' | 'pallet' | 'wrap' | 'vest';
export type VehicleStatusDto = 'Loading' | 'Unloading' | 'Idle' | 'Charging' | 'In Transit';
export type DockStatusDto = 'Occupied' | 'Available' | 'Maintenance';
export type ShipmentStageDto = 'confirmed' | 'picked' | 'loading' | 'transit' | 'delivered';

export interface SiteDto {
  id: string;
  name: string;
  location: string;
  city: 'Chennai' | 'Bengaluru';
  /** Pallet positions this facility can hold. */
  palletCapacity: number;
  /** Pallet-space utilisation, percent. */
  capacity: number;
  docked: number;
  docks: number;
  pallets: number;
  palletsDelta: number;
  trucksOnSite: number;
  trucksInbound: number;
  trucksDelta: number;
  onTime: number;
  onTimeDelta: number;
}

export interface HubDto {
  id: string;
  name: string;
  location: string;
  status: 'Operational' | 'Degraded' | 'Offline';
  outboundToday: number;
  inboundToday: number;
  /** Inbound pallets put away today (bounded; never a running tick counter). */
  putawaysToday: number;
  arriving: number;
  staged: number;
  stockOnHand: number;
  stockCapacity: number;
  utilization: number;
}

export interface KpisDto {
  stockDelta: number;
  trucksDelta: number;
  onTimeRate: number;
  onTimeDelta: number;
  stockTrend: number[];
  trucksTrend: number[];
  onTimeTrend: number[];
  staffTrend: number[];
}

export interface InventoryItemDto {
  /** `Product._id`. */
  id: string;
  name: string;
  sku: string;
  quantity: number;
  reorderPoint: number;
  unitPrice: number;
  icon: InventoryIconDto;
  category: string;
  status: StockBadge;
}

export interface MovementDto {
  id: string;
  itemId: string;
  itemName: string;
  sku: string;
  type: 'IN' | 'OUT';
  quantity: number;
  /** e.g. `Loading TRK-204 · SHP-20931 · Sale #INV-009`. */
  reason: string;
  truckId: string | null;
  shipmentId: string | null;
  at: string;
}

export interface SaleOrderDto {
  id: string;
  customer: string;
  amount: number;
  status: 'Completed' | 'Pending';
  date: string;
}

export interface StaffDto {
  id: string;
  name: string;
  role: string;
  shift: 'Morning' | 'Evening' | 'Night';
  active: boolean;
}

export interface ManifestLineDto {
  itemId: string;
  quantity: number;
}

export interface TruckDto {
  kind: 'truck';
  id: string;
  model: string;
  carrier: string;
  driver: string;
  status: VehicleStatusDto;
  dockId: string | null;
  fuel: number;
  loadProgress: number;
  shipmentId: string | null;
  manifest: ManifestLineDto[];
  /** Same label as the dock card: who the truck is collecting from / delivering to. */
  partyLabel: string | null;
  partyName: string | null;
  origin: string | null;
  destination: string | null;
}

export interface ForkliftDto {
  kind: 'forklift';
  id: string;
  model: string;
  operator: string;
  status: VehicleStatusDto;
  battery: number;
  zone: string;
  /** Bay the forklift has been tasked to, or null when free. */
  dockId: string | null;
  /** SKU it is moving right now. */
  taskSku: string | null;
  /** Human task line for the inspector, e.g. `Loading TRK-204 at Bay 1`. */
  taskLabel: string | null;
  chargerId: string | null;
}

export interface DockDto {
  id: string;
  name: string;
  /** `Inbound from Redington India` / `Outbound to Balaji Electronics` for the shipment at the bay. */
  partyLabel: string | null;
  /** The button the bay's shipment offers next, e.g. `Load Truck`. */
  nextAction: string | null;
  status: DockStatusDto;
  /** The backend status: Available | Occupied | Loading | Unloading | Maintenance. */
  detailStatus: string;
  vehicleId: string | null;
  shipmentId: string | null;
  since: string;
}

export interface ShipmentDto {
  id: string;
  vehicleId: string;
  origin: string;
  destination: string;
  stage: ShipmentStageDto;
  eta: string;
  units: number;
  direction: 'Inbound' | 'Outbound';
  route: string;
  /** Ledger reference this shipment realises (purchase receipt / sales invoice). */
  linkRef: string;
  linkType: string;
  siteCode: string;
  /** Supplier (inbound) or customer (outbound). */
  partyName: string;
  /** `Inbound from Redington India` / `Outbound to Balaji Electronics`. */
  partyLabel: string;
  dockId: string | null;
  /** Units the ledger document asks for in total (may be more than has arrived so far). */
  expectedUnits: number;
  /** The "Advance Shipment Stage" button label, or null once delivered. */
  nextAction: string | null;
  /** True while a ledger-linked shipment waits for an operator instead of the yard's own clock. */
  manual: boolean;
}

/** One row of the Yard & Racks view: a material and where each of its units physically sits. */
export interface MaterialLocationDto {
  siteCode: string;
  siteName: string;
  /** `Rack R-03`, `Staging Zone A`, ... */
  kind: 'Rack' | 'Staging' | 'Outbound lane' | 'Dock';
  /** Rack code, `Staging A (r1,c2)`, or `Dock D2`. */
  place: string;
  zone: string;
  units: number;
  pallets: number;
}

export interface MaterialDto {
  id: string;
  sku: string;
  name: string;
  category: string;
  unitPrice: number;
  currentStock: number;
  lowStockThreshold: number;
  status: StockBadge;
  /** Units physically on shelves / staging across the network. */
  onHand: number;
  /** Units picked into an outbound lane (already off the ledger, not yet on the road). */
  inMotion: number;
  /** Units booked in on the ledger that are still on a truck / at a dock waiting to be put away. */
  inbound: number;
  /** Units on open outbound shipments that the ledger has already deducted but that have not yet been picked off a shelf. */
  outboundPending: number;
  locations: MaterialLocationDto[];
  /** Sites that hold the material. */
  sites: string[];
}

export interface MaterialCategoryDto {
  name: string;
  products: number;
  units: number;
  value: number;
}

export interface MaterialsDto {
  generatedAt: string;
  categories: MaterialCategoryDto[];
  materials: MaterialDto[];
}

export interface ShipmentsListDto {
  shipments: ShipmentDto[];
}

export interface RackDto {
  id: string;
  zone: string;
  levels: number;
  capacity: number;
  occupiedSlots: number;
  assignedSku: string;
}

export interface PalletDto {
  id: string;
  itemId: string;
  units: number;
  layers: number;
  zone: string;
  row: number;
  col: number;
}

export interface WarehouseSummaryDto {
  stockValue: number;
  stockUnits: number;
  totalSkus: number;
  lowStockCount: number;
  outOfStockCount: number;
  completedSales: number;
  pendingOrders: number;
  activeStaff: number;
  totalStaff: number;
  trucksOnSite: number;
  trucksEnRoute: number;
}

export interface LedgerTotalsDto {
  totalProducts: number;
  stockValue: number;
  lowStockCount: number;
  outOfStockCount: number;
}

export interface WarehouseOverviewDto {
  generatedAt: string;
  siteId: string;
  /** `site`: stock figures are this facility's share of the ledger; `network`: the whole ledger. */
  scope: 'site' | 'network';
  /** This facility's share (0..1) of the network's stored pallets, used to apportion ledger stock. */
  siteShare: number;
  sites: SiteDto[];
  hub: HubDto;
  kpis: KpisDto;
  summary: WarehouseSummaryDto;
  /** Whole-ledger totals across every product, for comparison with the yard-scoped summary. */
  ledger: LedgerTotalsDto;
  inventory: InventoryItemDto[];
  movements: MovementDto[];
  sales: SaleOrderDto[];
  staff: StaffDto[];
  docks: DockDto[];
  trucks: TruckDto[];
  forklifts: ForkliftDto[];
  racks: RackDto[];
  pallets: PalletDto[];
  shipments: ShipmentDto[];
}
