import { Types } from 'mongoose';
import { DockBay, type IDockBayDocument } from '../../models/DockBay';
import { FacilitySite, type IFacilitySiteDocument } from '../../models/FacilitySite';
import { Product, type IProductDocument } from '../../models/Product.model';
import { Sale } from '../../models/Sale';
import { ShipmentTracker, type IShipmentTrackerDocument } from '../../models/ShipmentTracker';
import { Staff } from '../../models/Staff';
import { StockMovement } from '../../models/StockMovement.model';
import { StorageRack } from '../../models/StorageRack';
import { YardPallet } from '../../models/YardPallet';
import { YardVehicle, type IYardVehicleDocument } from '../../models/YardVehicle';
import { orderRepository } from '../../repositories/order.repository';
import { saleRepository } from '../../repositories/sale.repository';
import type {
  DockDto,
  ForkliftDto,
  InventoryItemDto,
  KpisDto,
  MovementDto,
  SaleOrderDto,
  ShipmentDto,
  ShipmentStageDto,
  SiteDto,
  StaffDto,
  StockBadge,
  TruckDto,
  WarehouseOverviewDto,
} from '../../types/warehouse';
import { AppError } from '../../utils/AppError';
import { YARD_PRODUCTS } from './constants';
import { clock, iconForProduct } from './format';
import { resolveSite } from './dispatcher';
import { nextActionFor, partyLabel } from './shipmentActions';
import { onHandByProduct, physicalRows, totalUnits } from './stock';

const STAGE_MAP: Record<IShipmentTrackerDocument['stage'], ShipmentStageDto> = {
  'Order Confirmed': 'confirmed',
  Picked: 'picked',
  Loading: 'loading',
  'In Transit': 'transit',
  Delivered: 'delivered',
};

/** Ordering for the shipment tracker: what is being worked now comes first. */
function stageRank(shipment: IShipmentTrackerDocument): number {
  if (shipment.stage === 'Loading') return 0;
  if (shipment.stage === 'Delivered' && shipment.completedAt === null) return 1;
  if (shipment.stage === 'Picked') return 2;
  if (shipment.stage === 'Order Confirmed') return 3;
  if (shipment.stage === 'In Transit') return 4;
  return 5;
}

function badge(quantity: number, reorderPoint: number): StockBadge {
  if (quantity <= 0) return 'Out of Stock';
  if (quantity <= reorderPoint) return 'Low Stock';
  return 'In Stock';
}

function shiftFor(joined: Date, index: number): StaffDto['shift'] {
  return (['Morning', 'Evening', 'Night'] as const)[(joined.getMonth() + index) % 3];
}

function toSiteDto(
  site: IFacilitySiteDocument,
  docks: IDockBayDocument[],
  trucks: IYardVehicleDocument[],
  inboundOpen: number
): SiteDto {
  return {
    id: site.code,
    name: site.name,
    location: site.location,
    city: site.city,
    palletCapacity: site.palletCapacity,
    capacity: site.utilization,
    docked: docks.filter((dock) => dock.assignedTruckId !== null).length,
    docks: docks.length,
    pallets: site.palletsStored,
    palletsDelta: site.palletsDelta,
    trucksOnSite: trucks.filter((truck) => truck.status !== 'In Transit').length,
    trucksInbound: inboundOpen,
    trucksDelta: site.trucksDelta,
    onTime: site.onTimeRate,
    onTimeDelta: site.onTimeDelta,
  };
}

function actionFor(shipment: IShipmentTrackerDocument): string | null {
  return nextActionFor({
    direction: shipment.direction,
    stage: shipment.stage,
    completedAt: shipment.completedAt ?? null,
    units: shipment.manifest.reduce((sum, line) => sum + line.quantity, 0),
    dockId: shipment.dockId ?? null,
  });
}

function toDockDto(dock: IDockBayDocument, shipments: Map<string, IShipmentTrackerDocument>): DockDto {
  const shipment = dock.assignedShipmentId ? shipments.get(dock.assignedShipmentId) : undefined;
  return {
    id: dock.code,
    name: dock.name,
    partyLabel: shipment ? partyLabel(shipment) : null,
    nextAction: shipment ? actionFor(shipment) : null,
    status: dock.status === 'Available' ? 'Available' : dock.status === 'Maintenance' ? 'Maintenance' : 'Occupied',
    detailStatus: dock.status,
    vehicleId: dock.assignedTruckId,
    shipmentId: dock.assignedShipmentId,
    since: clock(dock.since),
  };
}

function toTruckDto(truck: IYardVehicleDocument, shipments: Map<string, IShipmentTrackerDocument>): TruckDto {
  const shipment = truck.shipmentId ? shipments.get(truck.shipmentId) : undefined;
  return {
    partyLabel: shipment ? partyLabel(shipment) : null,
    partyName: shipment?.partyName ?? null,
    origin: shipment?.origin ?? null,
    destination: shipment?.destination ?? null,
    kind: 'truck',
    id: truck.code,
    model: truck.vehicleModel,
    carrier: truck.carrier ?? 'Independent carrier',
    driver: truck.operator,
    status: truck.status,
    dockId: truck.assignedBay,
    fuel: truck.fuel,
    loadProgress: truck.progress,
    shipmentId: truck.shipmentId,
    manifest: truck.manifest.map((line) => ({ itemId: String(line.productId), quantity: line.quantity })),
  };
}

function chargerFor(code: string): string {
  const n = Number(/(\d+)$/.exec(code)?.[1] ?? 1);
  return `C${((n - 1) % 3) + 1}`;
}

function toForkliftDto(forklift: IYardVehicleDocument, truckCode?: string | null): ForkliftDto {
  const bay = forklift.assignedBay;
  const working = forklift.status === 'Loading' || forklift.status === 'Unloading';
  const taskLabel = working && truckCode && bay
    ? `${forklift.status} ${truckCode} at ${bay}`
    : forklift.status === 'Charging'
      ? `Charging at ${chargerFor(forklift.code)}`
      : forklift.status === 'Idle'
        ? 'Idle'
        : forklift.status;
  return {
    kind: 'forklift',
    id: forklift.code,
    model: forklift.vehicleModel,
    operator: forklift.operator,
    status: forklift.status,
    battery: forklift.battery,
    zone: forklift.zone,
    dockId: forklift.assignedBay,
    taskSku: forklift.activeSku,
    taskLabel,
    chargerId: chargerFor(forklift.code),
  };
}

export function toShipmentDto(shipment: IShipmentTrackerDocument): ShipmentDto {
  const arrived = shipment.stage === 'Delivered';
  const units = shipment.manifest.reduce((sum, line) => sum + line.quantity, 0);
  return {
    linkType: shipment.linkType,
    siteCode: shipment.siteCode,
    partyName: shipment.partyName || (shipment.direction === 'Inbound' ? shipment.origin : shipment.destination),
    partyLabel: partyLabel(shipment),
    dockId: shipment.dockId ?? null,
    expectedUnits: Math.max(shipment.expectedUnits ?? 0, units),
    nextAction: actionFor(shipment),
    manual: shipment.autopilot === false,
    id: shipment.code,
    vehicleId: shipment.truckId ?? '',
    origin: shipment.origin,
    destination: shipment.destination,
    stage: STAGE_MAP[shipment.stage],
    eta: arrived ? (shipment.direction === 'Inbound' ? 'Arrived' : 'Delivered') : clock(shipment.etaAt),
    units: shipment.units,
    direction: shipment.direction,
    route: shipment.route,
    linkRef: shipment.linkRef,
  };
}

/** The products that physically sit in, or are moving through, a site's yard. */
function yardProductIds(
  racks: Array<{ assignedProductId: Types.ObjectId | null }>,
  pallets: Array<{ productId: Types.ObjectId }>,
  trucks: IYardVehicleDocument[],
  shipments: IShipmentTrackerDocument[]
): Types.ObjectId[] {
  const ids = new Map<string, Types.ObjectId>();
  const add = (id: Types.ObjectId | null | undefined) => {
    if (id) ids.set(String(id), id);
  };
  racks.forEach((rack) => add(rack.assignedProductId));
  pallets.forEach((pallet) => add(pallet.productId));
  trucks.forEach((truck) => truck.manifest.forEach((line) => add(line.productId)));
  shipments.forEach((shipment) => shipment.manifest.forEach((line) => add(line.productId)));
  return [...ids.values()];
}

function sortInventory(products: IProductDocument[]): IProductDocument[] {
  const rank = (sku: string) => {
    const index = YARD_PRODUCTS.findIndex((spec) => spec.sku === sku);
    return index === -1 ? YARD_PRODUCTS.length : index;
  };
  return [...products].sort((a, b) => rank(a.sku) - rank(b.sku) || a.name.localeCompare(b.name));
}

export type OverviewScope = 'site' | 'network';

/** `network` shows the whole ledger's stock; `site` (default) shows the requested facility's share of it. */
export function parseScope(value: unknown): OverviewScope {
  return value === 'network' ? 'network' : 'site';
}

function startOfToday(): Date {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return start;
}

/** Units that physically finished moving at a site today (inbound put-away / outbound dispatch). */
async function movedToday(siteCode: string): Promise<{ inbound: number; outbound: number }> {
  const rows = await ShipmentTracker.aggregate<{ _id: string; units: number }>([
    { $match: { siteCode, completedAt: { $gte: startOfToday() } } },
    { $group: { _id: '$direction', units: { $sum: '$units' } } },
  ]);
  const byDirection = new Map(rows.map((row) => [row._id, row.units]));
  return { inbound: byDirection.get('Inbound') ?? 0, outbound: byDirection.get('Outbound') ?? 0 };
}

/** Rebuilds a 10-point stock series by walking recent movements backwards from today's yard stock. */
function stockSeries(current: number, movements: Array<{ previousStock: number; newStock: number }>): number[] {
  const series = [current];
  let running = current;
  for (const movement of movements.slice(0, 9)) {
    running -= movement.newStock - movement.previousStock;
    series.unshift(Math.max(0, running));
  }
  while (series.length < 10) series.unshift(series[0]);
  return series;
}

async function recentSales(): Promise<SaleOrderDto[]> {
  const sales = await Sale.find({ status: { $ne: 'CANCELLED' } })
    .sort({ createdAt: -1 })
    .limit(5)
    .populate('customerRef', 'name');
  return sales.map((sale) => ({
    id: sale.invoiceNumber,
    customer: (sale.customerRef as unknown as { name?: string } | null)?.name ?? 'Customer',
    amount: sale.totalAmount,
    status: sale.status === 'COMPLETE' ? 'Completed' : 'Pending',
    date: sale.createdAt.toISOString().slice(0, 10),
  }));
}

/**
 * The single read model behind both dashboards: ledger aggregates (Mongo `Product`, `Sale`, `StockMovement`,
 * `Staff`) plus the live yard state for one site. `siteId` defaults to the primary site.
 */
export async function buildOverview(siteId?: string, scope: OverviewScope = 'site'): Promise<WarehouseOverviewDto> {
  const site = await resolveSite(siteId);
  if (!site) throw new AppError(503, 'Facility data has not been seeded yet');
  const siteCode = site.code;
  const physical = await physicalRows();
  const networkOnHand = onHandByProduct(physical);
  const siteOnHand = onHandByProduct(physical, siteCode);
  const networkUnits = totalUnits(networkOnHand);
  // This facility's share of every unit sitting on shelves / in staging across the network.
  const share = scope === 'network' || networkUnits === 0 ? 1 : totalUnits(siteOnHand) / networkUnits;
  const today = await movedToday(siteCode);

  const [sites, allDocks, allTrucks, inboundOpen, docks, vehicles, racks, stagingPallets, openShipments, deliveredShipments, staff] =
    await Promise.all([
      FacilitySite.find().sort({ code: 1 }),
      DockBay.find().sort({ siteCode: 1, code: 1 }),
      YardVehicle.find({ kind: 'Truck' }).select('siteCode status'),
      ShipmentTracker.aggregate<{ _id: string; count: number }>([
        { $match: { direction: 'Inbound', completedAt: null, stage: { $in: ['Order Confirmed', 'In Transit'] } } },
        { $group: { _id: '$siteCode', count: { $sum: 1 } } },
      ]),
      DockBay.find({ siteCode }).sort({ code: 1 }),
      YardVehicle.find({ siteCode }).sort({ _id: 1 }),
      StorageRack.find({ siteCode }).sort({ code: 1 }),
      YardPallet.find({ siteCode, locationType: 'Staging' }).sort({ code: 1 }),
      ShipmentTracker.find({ siteCode, $or: [{ completedAt: null }, { stage: { $ne: 'Delivered' } }] }).sort({ createdAt: 1 }),
      ShipmentTracker.find({ siteCode, stage: 'Delivered', completedAt: { $ne: null } }).sort({ completedAt: -1 }).limit(4),
      Staff.find().sort({ joinedDate: 1 }),
    ]);

  const trucks = vehicles.filter((vehicle) => vehicle.kind === 'Truck');
  const forklifts = vehicles.filter((vehicle) => vehicle.kind === 'Forklift');
  const shipments = [...openShipments, ...deliveredShipments]
    .sort((a, b) => stageRank(a) - stageRank(b) || a.createdAt.getTime() - b.createdAt.getTime())
    .slice(0, 18);
  const shipmentsByCode = new Map(openShipments.map((shipment) => [shipment.code, shipment]));

  const productIds = yardProductIds(racks, stagingPallets, trucks, shipments);
  const physicalIds = physical.filter((row) => row.siteCode === siteCode).map((row) => new Types.ObjectId(row.productId));
  // A facility lists every material that is on its shelves or moving through its docks; the network view lists the whole catalogue.
  const products = sortInventory(
    scope === 'network' ? await Product.find() : await Product.find({ _id: { $in: [...productIds, ...physicalIds] } })
  );

  // Site view: the units physically on this facility's racks and staging pallets. Network view: the ledger's stock.
  const inventory: InventoryItemDto[] = products.map((product) => {
    const id = String(product._id);
    const productShare = (networkOnHand.get(id) ?? 0) > 0 ? (siteOnHand.get(id) ?? 0) / (networkOnHand.get(id) ?? 1) : 0;
    const quantity = scope === 'network' ? product.currentStock : (siteOnHand.get(id) ?? 0);
    const reorderPoint = scope === 'network' ? product.lowStockThreshold : Math.ceil(product.lowStockThreshold * productShare);
    return {
      id: String(product._id),
      name: product.name,
      sku: product.sku,
      quantity,
      reorderPoint,
      unitPrice: product.price,
      icon: iconForProduct(product),
      category: product.category,
      status: badge(quantity, reorderPoint),
    };
  });

  const movementDocs = await StockMovement.find({ $or: [{ siteCode }, { siteCode: { $exists: false } }] })
    .sort({ createdAt: -1 })
    .limit(8)
    .populate('productId', 'name sku');
  const linkedShipments = movementDocs.map((movement) => movement.shipmentCode).filter((code): code is string => Boolean(code));
  const shipmentTrucks = new Map(
    (await ShipmentTracker.find({ code: { $in: linkedShipments } }).select('code truckId')).map((shipment) => [shipment.code, shipment.truckId])
  );

  const movements: MovementDto[] = movementDocs.flatMap((movement) => {
    const product = movement.productId as unknown as { _id: Types.ObjectId; name: string; sku: string } | null;
    if (!product) return [];
    const type: 'IN' | 'OUT' = movement.type === 'ADJUSTMENT' ? (movement.newStock >= movement.previousStock ? 'IN' : 'OUT') : movement.type;
    const shipmentId = movement.shipmentCode ?? null;
    const truckId = movement.truckCode ?? (shipmentId ? shipmentTrucks.get(shipmentId) ?? null : null);
    const yardLabel = shipmentId ? `${type === 'OUT' ? 'Loading' : 'Unloading'} ${truckId ?? 'truck pending'} · ${shipmentId}` : null;
    return [
      {
        id: String(movement._id),
        itemId: String(product._id),
        itemName: product.name,
        sku: product.sku,
        type,
        quantity: movement.quantity,
        reason: yardLabel && !movement.reason.startsWith(yardLabel) ? `${yardLabel} · ${movement.reason}` : movement.reason,
        truckId,
        shipmentId,
        at: movement.createdAt.toISOString(),
      },
    ];
  });

  const yardMovements = await StockMovement.find({ productId: { $in: productIds } })
    .sort({ createdAt: -1 })
    .limit(9)
    .select('previousStock newStock');
  const stockUnits = inventory.reduce((sum, item) => sum + item.quantity, 0);
  const stockValue = inventory.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const stockTrend = stockSeries(
    stockUnits,
    yardMovements.map((movement) => ({ previousStock: movement.previousStock * share, newStock: movement.newStock * share }))
  );
  const stockDelta = stockTrend[0] > 0 ? Math.round(((stockTrend[stockTrend.length - 1] - stockTrend[0]) / stockTrend[0]) * 1000) / 10 : site.kpis.stockDelta;

  const [completedSales, pendingOrders, ledgerTotals, ledgerLow, ledgerOut, latestSales] = await Promise.all([
    saleRepository.sumCompleted(),
    orderRepository.countByStatus('PENDING'),
    Product.aggregate<{ total: number; value: number }>([
      { $group: { _id: null, total: { $sum: 1 }, value: { $sum: { $multiply: ['$price', '$currentStock'] } } } },
    ]),
    Product.countDocuments({ currentStock: { $gt: 0 }, $expr: { $lte: ['$currentStock', '$lowStockThreshold'] } }),
    Product.countDocuments({ currentStock: 0 }),
    recentSales(),
  ]);

  const trucksOnSite = trucks.filter((truck) => truck.status !== 'In Transit').length;
  const activeStaff = staff.filter((member) => member.status === 'Active').length;

  const inboundBySite = new Map(inboundOpen.map((row) => [row._id, row.count]));
  const siteDtos: SiteDto[] = sites.map((entry) =>
    toSiteDto(
      entry,
      allDocks.filter((dock) => dock.siteCode === entry.code),
      allTrucks.filter((truck) => truck.siteCode === entry.code),
      inboundBySite.get(entry.code) ?? 0
    )
  );

  const kpis: KpisDto = {
    stockDelta,
    trucksDelta: site.trucksDelta,
    onTimeRate: site.onTimeRate,
    onTimeDelta: site.onTimeDelta,
    stockTrend,
    trucksTrend: site.kpis.trucksTrend,
    onTimeTrend: site.kpis.onTimeTrend,
    staffTrend: site.kpis.staffTrend,
  };

  return {
    generatedAt: new Date().toISOString(),
    siteId: siteCode,
    scope,
    siteShare: Math.round(share * 1000) / 1000,
    sites: siteDtos,
    hub: {
      id: site.code,
      name: site.name,
      location: site.location,
      status: site.status,
      // Earlier-shift baseline stored on the site (never incremented) plus the units that actually moved today.
      outboundToday: site.outboundToday + today.outbound,
      inboundToday: site.inboundToday + today.inbound,
      putawaysToday: Math.round((site.inboundToday + today.inbound) / 24),
      arriving: inboundBySite.get(site.code) ?? 0,
      staged: stagingPallets.length,
      stockOnHand: site.palletsStored,
      stockCapacity: site.palletCapacity,
      utilization: site.utilization,
    },
    kpis,
    summary: {
      stockValue,
      stockUnits,
      totalSkus: inventory.length,
      lowStockCount: inventory.filter((item) => item.status === 'Low Stock').length,
      outOfStockCount: inventory.filter((item) => item.status === 'Out of Stock').length,
      completedSales,
      pendingOrders,
      activeStaff,
      totalStaff: staff.length,
      trucksOnSite,
      trucksEnRoute: trucks.length - trucksOnSite,
    },
    ledger: {
      totalProducts: ledgerTotals[0]?.total ?? 0,
      stockValue: ledgerTotals[0]?.value ?? 0,
      lowStockCount: ledgerLow,
      outOfStockCount: ledgerOut,
    },
    inventory,
    movements,
    sales: latestSales,
    staff: staff.map((member, index) => ({
      id: String(member._id),
      name: member.name,
      role: member.role,
      shift: shiftFor(member.joinedDate, index),
      active: member.status === 'Active',
    })),
    docks: docks.map((dock) => toDockDto(dock, shipmentsByCode)),
    trucks: trucks.map((truck) => toTruckDto(truck, shipmentsByCode)),
    forklifts: forklifts.map((forklift) => {
      const truck = trucks.find((entry) => entry.assignedBay === forklift.assignedBay && entry.kind === 'Truck');
      return toForkliftDto(forklift, truck?.code);
    }),
    racks: racks.map((rack) => ({
      id: rack.code,
      zone: rack.zone,
      levels: rack.levels,
      capacity: rack.capacity,
      occupiedSlots: rack.occupiedSlots,
      assignedSku: rack.assignedSku ?? '',
    })),
    pallets: stagingPallets.map((pallet) => ({
      id: pallet.code,
      itemId: String(pallet.productId),
      units: pallet.quantity,
      layers: pallet.layers,
      zone: pallet.zone,
      row: pallet.row ?? 0,
      col: pallet.col ?? 0,
    })),
    shipments: shipments.map(toShipmentDto),
  };
}
