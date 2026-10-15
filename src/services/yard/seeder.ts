import { Types } from 'mongoose';
import { Customer } from '../../models/Customer';
import { DockBay } from '../../models/DockBay';
import { FacilitySite } from '../../models/FacilitySite';
import { Order } from '../../models/Order';
import { Product, type IProductDocument } from '../../models/Product.model';
import { Sale } from '../../models/Sale';
import { ShipmentTracker, type IShipmentLine, type ShipmentStage } from '../../models/ShipmentTracker';
import { StockMovement } from '../../models/StockMovement.model';
import { StorageRack } from '../../models/StorageRack';
import { YardPallet } from '../../models/YardPallet';
import { YardVehicle } from '../../models/YardVehicle';
import { DEFAULT_SITE_CODE, YARD_PRODUCTS, unitsPerPallet } from './constants';
import { advanceOutboundStages, assignQueuedShipments, workShipment } from './dispatcher';
import { todayAt } from './format';
import { putAwayUnits } from './racks';
import { SITE_SEEDS, type SiteSeed } from './seedData';

const log = (message: string) => console.log(`[yard] ${message}`);

/** Every facility collection, wiped by `reset`. */
async function clearFacilityCollections(): Promise<void> {
  await Promise.all([
    FacilitySite.deleteMany({}),
    DockBay.deleteMany({}),
    YardVehicle.deleteMany({}),
    StorageRack.deleteMany({}),
    YardPallet.deleteMany({}),
    ShipmentTracker.deleteMany({}),
  ]);
}

/**
 * Makes sure each yard SKU exists as a real `Product`, returning `sku -> _id`. Existing products are left untouched.
 */
export async function ensureYardProducts(): Promise<{ ids: Map<string, Types.ObjectId>; created: Set<string> }> {
  const ids = new Map<string, Types.ObjectId>();
  const created = new Set<string>();

  for (const spec of YARD_PRODUCTS) {
    const existing = await Product.findOne({ sku: spec.sku });
    if (existing) {
      ids.set(spec.sku, existing._id as Types.ObjectId);
      continue;
    }
    const product = await Product.create({
      name: spec.name,
      sku: spec.sku,
      category: spec.category,
      price: spec.price,
      currentStock: spec.currentStock,
      lowStockThreshold: spec.lowStockThreshold,
    });
    ids.set(spec.sku, product._id as Types.ObjectId);
    created.add(spec.sku);
  }
  return { ids, created };
}

/** A site with its bays, fleet and (empty) racks. Freight is added afterwards from the ledger. */
async function seedSiteShell(seed: SiteSeed): Promise<void> {
  const siteCode = seed.site.code;
  await FacilitySite.create(seed.site);

  await DockBay.insertMany(
    seed.docks.map((dock) => ({
      siteCode,
      code: dock.code,
      name: dock.name,
      status: dock.status === 'Maintenance' ? ('Maintenance' as const) : ('Available' as const),
      assignedTruckId: null,
      assignedShipmentId: null,
      since: todayAt(dock.since),
    }))
  );

  await YardVehicle.insertMany([
    ...seed.trucks.map((truck) => ({
      siteCode,
      kind: 'Truck' as const,
      code: truck.code,
      vehicleModel: truck.model,
      carrier: truck.carrier,
      operator: truck.driver,
      status: 'Idle' as const,
      progress: 0,
      assignedBay: null,
      shipmentId: null,
      manifest: [],
      activeSku: null,
      activeProductId: null,
      fuel: truck.fuel,
      taskStartedAt: null,
    })),
    ...seed.forklifts.map((forklift) => ({
      siteCode,
      kind: 'Forklift' as const,
      code: forklift.code,
      vehicleModel: forklift.model,
      operator: forklift.operator,
      status: forklift.status === 'Charging' ? ('Charging' as const) : ('Idle' as const),
      progress: 0,
      assignedBay: null,
      activeSku: null,
      activeProductId: null,
      battery: forklift.battery,
      zone: forklift.status === 'Charging' ? 'Charging bay' : 'Staging B',
      taskStartedAt: null,
    })),
  ]);

  await StorageRack.insertMany(
    seed.racks.map((rack) => ({
      siteCode,
      code: rack.code,
      zone: rack.zone,
      levels: 3,
      capacity: 9,
      occupiedSlots: 0,
      assignedSku: null,
      assignedProductId: null,
    }))
  );
}

interface FlowLine {
  productId: Types.ObjectId;
  sku: string;
  quantity: number;
}

interface OutboundPlan {
  invoice: string;
  saleId: Types.ObjectId;
  orderId: Types.ObjectId | null;
  customer: string;
  createdAt: Date;
  lines: FlowLine[];
  stage: ShipmentStage;
  code: string;
  siteCode: string;
}

const ACTIVE_OUTBOUND: ShipmentStage[] = ['Order Confirmed', 'Picked', 'Loading'];
const PALLETS_PER_RACK = 9;

function mergeFlowLines(lines: FlowLine[]): FlowLine[] {
  const merged = new Map<string, FlowLine>();
  for (const line of lines) {
    const existing = merged.get(line.sku);
    if (existing) existing.quantity += line.quantity;
    else merged.set(line.sku, { ...line });
  }
  return [...merged.values()];
}

const sumUnits = (lines: Array<{ quantity: number }>) => lines.reduce((total, line) => total + line.quantity, 0);

/**
 * Builds the yard's freight from the real ledger so the two planes agree by construction:
 * - every product's `currentStock` is slotted as unit-exact pallets across the five sites (racks first, staging after);
 * - every sales invoice becomes an outbound shipment (the newest ones are still in flight, the rest delivered);
 * - every purchase order becomes an inbound shipment for what has been received (put away) plus, when units are still
 *   outstanding, an open one waiting for its "Receive / Put-Away" click.
 * Ledger stock already excludes invoiced units, so units of in-flight invoices are put on the shelves first and then
 * genuinely picked / loaded by the dispatcher, which keeps `currentStock = shelves + booked-in - invoiced-but-unpicked`.
 */
async function seedLedgerWorkflow(): Promise<{ shipments: number; pallets: number }> {
  const [products, sales, orders, customers] = await Promise.all([
    Product.find(),
    Sale.find({ status: { $ne: 'CANCELLED' } }).sort({ createdAt: 1 }),
    Order.find().sort({ createdAt: 1 }),
    Customer.find().select('name').lean(),
  ]);
  const customerNames = new Map(customers.map((customer) => [String(customer._id), customer.name]));
  const byId = new Map<string, IProductDocument>(products.map((product) => [String(product._id), product]));
  const siteSeeds = new Map(SITE_SEEDS.map((seed) => [seed.site.code, seed]));
  const siteCodes = SITE_SEEDS.map((seed) => seed.site.code);
  const flowLine = (productId: Types.ObjectId, quantity: number): FlowLine | null => {
    const product = byId.get(String(productId));
    return product && quantity > 0 ? { productId: product._id as Types.ObjectId, sku: product.sku, quantity } : null;
  };

  // --- Sales invoices -> outbound plans (newest ones are still in flight) ---
  const saleOrders = orders.filter((order) => order.kind === 'SALE');
  const usedSaleOrders = new Set<string>();
  const outbound: OutboundPlan[] = sales.map((sale, index) => {
    const customer = customerNames.get(String(sale.customerRef)) ?? 'Customer';
    const lines = mergeFlowLines(sale.items.flatMap((item) => flowLine(item.productRef, item.qty) ?? []));
    const match = saleOrders.find(
      (order) =>
        !usedSaleOrders.has(String(order._id)) &&
        order.partyName === customer &&
        order.items.some((item) => lines.some((line) => String(line.productId) === String(item.productId)))
    );
    if (match) usedSaleOrders.add(String(match._id));

    const fromEnd = sales.length - 1 - index;
    const stages: ShipmentStage[] = ['Order Confirmed', 'Order Confirmed', 'Picked', 'Loading', 'In Transit'];
    return {
      invoice: sale.invoiceNumber,
      saleId: sale._id as Types.ObjectId,
      orderId: match ? (match._id as Types.ObjectId) : null,
      customer,
      createdAt: sale.createdAt,
      lines,
      stage: stages[fromEnd] ?? 'Delivered',
      code: '',
      siteCode: DEFAULT_SITE_CODE,
    };
  });
  const flows = outbound.filter((plan) => plan.lines.length > 0);

  // --- Shelf stock: the ledger's stock plus the invoiced units that have not left the shelves yet ---
  const shelfUnits = new Map<string, number>();
  for (const product of products) shelfUnits.set(String(product._id), product.currentStock);
  for (const plan of flows) {
    if (!ACTIVE_OUTBOUND.includes(plan.stage)) continue;
    for (const line of plan.lines) shelfUnits.set(String(line.productId), (shelfUnits.get(String(line.productId)) ?? 0) + line.quantity);
  }

  // Products moving on the same in-flight invoice must live at one site so the dispatcher can pick the whole invoice there.
  const parent = new Map<string, string>();
  const root = (id: string): string => {
    let current = id;
    while (parent.get(current) && parent.get(current) !== current) current = parent.get(current) as string;
    return current;
  };
  for (const plan of flows) {
    if (!ACTIVE_OUTBOUND.includes(plan.stage)) continue;
    const ids = plan.lines.map((line) => String(line.productId));
    ids.forEach((id) => {
      if (!parent.has(id)) parent.set(id, id);
    });
    ids.slice(1).forEach((id) => parent.set(root(id), root(ids[0])));
  }

  // --- Slotting: spread products over the five sites, a rack's worth (9 pallets) per site at most ---
  const racksPlanned = new Map(siteCodes.map((code) => [code, 0]));
  const groupSite = new Map<string, string>();
  const allocation = new Map<string, Array<{ siteCode: string; units: number }>>();
  const homeSite = new Map<string, string>();

  const targets = products
    .map((product) => ({ product, units: shelfUnits.get(String(product._id)) ?? 0 }))
    .filter((entry) => entry.units > 0)
    .sort((a, b) => Math.ceil(b.units / unitsPerPallet(b.product.sku)) - Math.ceil(a.units / unitsPerPallet(a.product.sku)));

  for (const { product, units } of targets) {
    const id = String(product._id);
    const size = unitsPerPallet(product.sku);
    const pallets = Math.ceil(units / size);
    const group = parent.has(id) ? root(id) : null;

    let chosen: string[];
    if (group && groupSite.has(group)) {
      chosen = [groupSite.get(group) as string];
    } else {
      const count = group ? 1 : Math.max(1, Math.ceil(pallets / PALLETS_PER_RACK));
      chosen = [...siteCodes]
        .sort((a, b) => (racksPlanned.get(a) ?? 0) - (racksPlanned.get(b) ?? 0) || siteCodes.indexOf(a) - siteCodes.indexOf(b))
        .slice(0, count);
      if (group) groupSite.set(group, chosen[0]);
    }

    const palletsPerSite = Math.ceil(pallets / chosen.length);
    let remaining = units;
    const parts: Array<{ siteCode: string; units: number }> = [];
    for (const siteCode of chosen) {
      const share = Math.min(remaining, palletsPerSite * size);
      if (share <= 0) break;
      parts.push({ siteCode, units: share });
      racksPlanned.set(siteCode, (racksPlanned.get(siteCode) ?? 0) + Math.ceil(share / size / PALLETS_PER_RACK));
      remaining -= share;
    }
    allocation.set(id, parts);
    homeSite.set(id, [...parts].sort((a, b) => b.units - a.units)[0].siteCode);
  }

  let palletWrites = 0;
  for (const [productId, parts] of allocation) {
    const product = byId.get(productId) as IProductDocument;
    for (const part of parts) {
      await putAwayUnits(part.siteCode, { productId: product._id as Types.ObjectId, sku: product.sku, quantity: part.units });
      palletWrites += Math.ceil(part.units / unitsPerPallet(product.sku));
    }
  }

  const siteOf = (productId: Types.ObjectId) => homeSite.get(String(productId)) ?? DEFAULT_SITE_CODE;
  const siteName = (code: string) => siteSeeds.get(code)?.site.name ?? code;
  const poolTruck = (code: string, index: number) => {
    const trucks = siteSeeds.get(code)?.trucks ?? [];
    return trucks.length > 0 ? trucks[index % trucks.length].code : null;
  };

  let sequence = 21000;
  const nextCode = () => `SHP-${++sequence}`;
  let created = 0;

  // --- Outbound shipments ---
  for (const [index, plan] of flows.entries()) {
    plan.code = nextCode();
    plan.siteCode = siteOf(plan.lines[0].productId);
    const done = plan.stage === 'Delivered' || plan.stage === 'In Transit';
    const historic = plan.stage === 'Delivered';
    const truckCode = done ? poolTruck(plan.siteCode, index) : null;
    const completedAt = historic ? new Date(plan.createdAt.getTime() + 6 * 3_600_000) : plan.stage === 'In Transit' ? new Date() : null;

    await ShipmentTracker.create({
      code: plan.code,
      siteCode: plan.siteCode,
      direction: 'Outbound',
      // In-flight invoices start at Order Confirmed and are walked forward by the real dispatcher below.
      stage: ACTIVE_OUTBOUND.includes(plan.stage) ? 'Order Confirmed' : plan.stage,
      linkType: 'SalesInvoice',
      linkRef: plan.invoice,
      sourceKey: `INV:${plan.invoice}`,
      orderId: plan.orderId,
      saleId: plan.saleId,
      partyName: plan.customer,
      expectedUnits: sumUnits(plan.lines),
      autopilot: false,
      origin: siteName(plan.siteCode),
      destination: plan.customer,
      route: `${siteName(plan.siteCode)} → ${plan.customer}`,
      truckId: truckCode,
      units: sumUnits(plan.lines),
      manifest: plan.lines.map((line): IShipmentLine => ({ ...line, done: done ? line.quantity : 0 })),
      etaAt: historic ? null : new Date(Date.now() + (60 + index * 11) * 60_000),
      completedAt,
      transitStartedAt: plan.stage === 'In Transit' ? new Date() : null,
      createdAt: plan.createdAt,
    });
    created += 1;

    if (plan.stage === 'In Transit' && truckCode) {
      await YardVehicle.updateOne(
        { siteCode: plan.siteCode, kind: 'Truck', code: truckCode },
        { $set: { status: 'In Transit', shipmentId: plan.code, progress: 100, manifest: plan.lines.map((line) => ({ ...line })) } }
      );
    }
  }

  // --- Inbound shipments: what a purchase order has delivered, and what is still on its way ---
  const purchaseOrders = orders.filter((order) => order.kind === 'PURCHASE');
  const inboundCodes = new Map<string, string>();
  for (const [index, order] of purchaseOrders.entries()) {
    const received = mergeFlowLines(order.items.flatMap((item) => flowLine(item.productId, item.received) ?? []));
    const outstanding = mergeFlowLines(order.items.flatMap((item) => flowLine(item.productId, item.quantity - item.received) ?? []));
    const allUnits = order.items.reduce((total, item) => total + item.quantity, 0);
    const siteCode = siteOf((received[0] ?? outstanding[0])?.productId ?? new Types.ObjectId());
    const common = {
      siteCode,
      direction: 'Inbound' as const,
      linkType: 'PurchaseReceipt' as const,
      linkRef: order.orderNumber,
      sourceKey: `PO:${order.orderNumber}`,
      orderId: order._id,
      partyName: order.partyName,
      autopilot: false,
      origin: order.partyName,
      destination: siteName(siteCode),
      route: `${order.partyName} → ${siteName(siteCode)}`,
    };

    if (received.length > 0) {
      const code = nextCode();
      inboundCodes.set(order.orderNumber, code);
      await ShipmentTracker.create({
        ...common,
        code,
        stage: 'Delivered',
        expectedUnits: allUnits,
        truckId: poolTruck(siteCode, index + 2),
        units: sumUnits(received),
        manifest: received.map((line): IShipmentLine => ({ ...line, done: line.quantity })),
        etaAt: null,
        completedAt: new Date(order.createdAt.getTime() + 24 * 3_600_000),
        createdAt: order.createdAt,
      });
      created += 1;
    }
    if (outstanding.length > 0) {
      await ShipmentTracker.create({
        ...common,
        code: nextCode(),
        stage: 'In Transit',
        expectedUnits: sumUnits(outstanding),
        truckId: null,
        units: 0,
        manifest: [],
        etaAt: new Date(Date.now() + (18 + index * 9) * 60_000),
        completedAt: null,
        createdAt: new Date(order.createdAt.getTime() + 1000),
      });
      created += 1;
    }
  }

  // --- Let the real dispatcher dock, pick and load the in-flight invoices ---
  for (const code of siteCodes) await assignQueuedShipments(code);

  for (const plan of flows) {
    if (plan.stage === 'Picked') {
      await advanceOutboundStages(plan.siteCode, plan.code);
    } else if (plan.stage === 'Loading') {
      await advanceOutboundStages(plan.siteCode, plan.code);
      await advanceOutboundStages(plan.siteCode, plan.code);
      const shipment = await ShipmentTracker.findOne({ code: plan.code });
      const truck = shipment?.truckId ? await YardVehicle.findOne({ siteCode: plan.siteCode, kind: 'Truck', code: shipment.truckId }) : null;
      if (truck && truck.status === 'Loading') {
        truck.progress = 35;
        await truck.save();
        await workShipment(plan.siteCode, truck);
      }
    }
  }

  // --- Re-link the ledger's movements to the shipments that realise them ---
  const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const plan of flows) {
    const shipment = await ShipmentTracker.findOne({ code: plan.code });
    await StockMovement.updateMany(
      { type: 'OUT', reason: new RegExp(`Sale #${escape(plan.invoice)}(?!\\d)`) },
      { $set: { siteCode: plan.siteCode, shipmentCode: plan.code, ...(shipment?.truckId ? { truckCode: shipment.truckId } : {}) } }
    );
  }
  for (const [orderNumber, code] of inboundCodes) {
    const shipment = await ShipmentTracker.findOne({ code });
    await StockMovement.updateMany(
      { type: 'IN', reason: new RegExp(`${escape(orderNumber)}(?!\\d)`) },
      { $set: { siteCode: shipment?.siteCode, shipmentCode: code, ...(shipment?.truckId ? { truckCode: shipment.truckId } : {}) } }
    );
  }

  return { shipments: created, pallets: palletWrites };
}

export interface SeedFacilityOptions {
  /** Wipe the facility collections first. Without it, seeding is skipped when sites already exist. */
  reset?: boolean;
}

/**
 * Populates the five sites, their docks, fleet and racks, then fills the yard from the ledger (see
 * `seedLedgerWorkflow`). The ledger itself is never modified here.
 */
export async function seedFacilityData(options: SeedFacilityOptions = {}): Promise<{ seeded: boolean }> {
  if (options.reset) {
    await clearFacilityCollections();
  } else if ((await FacilitySite.estimatedDocumentCount()) > 0) {
    return { seeded: false };
  }

  await ensureYardProducts();
  for (const seed of SITE_SEEDS) {
    await seedSiteShell(seed);
  }
  const { shipments, pallets } = await seedLedgerWorkflow();
  log(`Seeded ${SITE_SEEDS.length} facility sites, ${shipments} ledger-linked shipments and ~${pallets} pallets`);
  return { seeded: true };
}

/** Called on API boot: fills the facility layer only when it is empty. */
export async function ensureFacilityData(): Promise<void> {
  const { seeded } = await seedFacilityData();
  if (!seeded) log('Facility data already present');
}
