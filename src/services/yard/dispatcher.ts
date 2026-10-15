import { Types } from 'mongoose';
import { DockBay, type IDockBayDocument } from '../../models/DockBay';
import { FacilitySite, type IFacilitySiteDocument } from '../../models/FacilitySite';
import { Notification } from '../../models/Notification';
import {
  ShipmentTracker,
  type IShipmentLine,
  type IShipmentTrackerDocument,
  type ShipmentDirection,
  type ShipmentLinkType,
} from '../../models/ShipmentTracker';
import { YardPallet } from '../../models/YardPallet';
import { YardVehicle, type IYardVehicleDocument } from '../../models/YardVehicle';
import { DEFAULT_SITE_CODE, FORKLIFT_MIN_BATTERY, TRANSIT_DELIVERY_MS, LANE_CELLS, layersFor, unitsPerPallet } from './constants';
import { AppError } from '../../utils/AppError';
import { withYardLock } from './lock';
import { freeLaneCells, loadFromLane, pickUnits, putAwayUnits, stageUnitsInLane } from './racks';

/** One product line of a ledger transaction that needs a physical move through the yard. */
export interface LedgerLine {
  productId: Types.ObjectId;
  sku: string;
  quantity: number;
}

export interface RegisterShipmentInput {
  direction: ShipmentDirection;
  siteCode?: string;
  lines: LedgerLine[];
  linkType: ShipmentLinkType;
  /** Ledger reference, e.g. `ORD-10503` / `INV-009`. */
  linkRef: string;
  /** Receipts against the same key merge into one open shipment. */
  sourceKey: string;
  /** Supplier (inbound) or customer (outbound). */
  partyName?: string;
  orderId?: string;
  saleId?: string;
  /** Units the whole ledger document asks for (an order's full quantity), when known. */
  expectedUnits?: number;
}

export interface RegisteredShipment {
  siteCode: string;
  shipmentCode: string;
  truckCode: string | null;
}

const TRUCK_MODELS = ['Tata Prima 5530', 'Ashok Leyland 4825', 'BharatBenz 2823', 'Eicher Pro 6049', 'Volvo FM 420'];
const CARRIERS = ['BlueLine Logistics', 'Coastal Freight', 'Northstar Haulage'];
const DRIVERS = ['Murugan S.', 'Anil Kumar', 'Rahim Khan', 'Senthil Raj', 'Vijay P.', 'Imran Shaikh'];

const ETA_MINUTES = { Inbound: 20, Outbound: 90 };
const WORKING = ['Loading', 'Unloading'] as const;

function numericSuffix(code: string): number {
  const match = /(\d+)$/.exec(code);
  return match ? Number(match[1]) : 0;
}

export async function resolveSite(siteCode?: string): Promise<IFacilitySiteDocument | null> {
  const code = (siteCode ?? DEFAULT_SITE_CODE).trim().toUpperCase();
  return (
    (await FacilitySite.findOne({ code })) ??
    (await FacilitySite.findOne({ code: DEFAULT_SITE_CODE })) ??
    (await FacilitySite.findOne().sort({ code: 1 }))
  );
}

async function nextShipmentCode(): Promise<string> {
  const rows = await ShipmentTracker.find().select('code').lean();
  const max = rows.reduce((highest, row) => Math.max(highest, numericSuffix(row.code)), 20000);
  return `SHP-${max + 1}`;
}

async function nextTruckCode(): Promise<string> {
  const rows = await YardVehicle.find({ kind: 'Truck' }).select('code').lean();
  const max = rows.reduce((highest, row) => Math.max(highest, numericSuffix(row.code)), 600);
  return `TRK-${max + 1}`;
}

/** Ledger-visible breadcrumbs: dispatch, delivery and put-away show up in the Alerts feed next to stock alerts. */
async function notifyLedger(shipment: IShipmentTrackerDocument, event: 'dispatched' | 'delivered' | 'put-away'): Promise<void> {
  if (shipment.linkType !== 'SalesInvoice' && shipment.linkType !== 'PurchaseReceipt') return;
  const party = shipment.partyName || (shipment.direction === 'Inbound' ? shipment.origin : shipment.destination);
  const truck = shipment.truckId ?? 'truck';
  const copy = {
    dispatched: { title: `${shipment.linkRef} dispatched`, message: `${shipment.units} units for ${party} left ${shipment.siteCode} on ${truck} (${shipment.code}).` },
    delivered: { title: `${shipment.linkRef} delivered`, message: `${party} has received ${shipment.units} units (${shipment.code}).` },
    'put-away': { title: `${shipment.linkRef} put away`, message: `${shipment.units} units from ${party} are racked at ${shipment.siteCode} (${shipment.code}).` },
  }[event];
  try {
    await Notification.create({ ...copy, isRead: false, date: new Date() });
  } catch (error) {
    console.error('[yard] could not write the ledger notification', error);
  }
}

/** An idle truck from the site pool, a returning one, or - when the carrier pool is empty - a newly arrived one. */
async function takeTruck(siteCode: string): Promise<IYardVehicleDocument> {
  const idle = await YardVehicle.findOne({ siteCode, kind: 'Truck', status: 'Idle', assignedBay: null, shipmentId: null });
  if (idle) return idle;

  const returning = await YardVehicle.findOne({ siteCode, kind: 'Truck', status: 'In Transit', shipmentId: null });
  if (returning) {
    returning.status = 'Idle';
    returning.progress = 0;
    return returning;
  }

  const code = await nextTruckCode();
  const n = numericSuffix(code);
  return YardVehicle.create({
    siteCode,
    kind: 'Truck',
    code,
    vehicleModel: TRUCK_MODELS[n % TRUCK_MODELS.length],
    carrier: CARRIERS[n % CARRIERS.length],
    operator: DRIVERS[n % DRIVERS.length],
    status: 'Idle',
    fuel: 60 + (n % 35),
  });
}

function toLines(lines: IShipmentLine[]) {
  return lines.map((line) => ({ productId: line.productId, sku: line.sku, quantity: line.quantity }));
}

/** Pallets sitting in a bay while its truck is worked, one per manifest line. Rebuilt whenever the manifest changes. */
export async function syncDockPallets(siteCode: string, dockCode: string, shipment: IShipmentTrackerDocument): Promise<void> {
  await YardPallet.deleteMany({ siteCode, locationType: 'Dock', dockCode });
  const docs = shipment.manifest.slice(0, 4).map((line, index) => ({
    siteCode,
    code: `DP-${dockCode}-${shipment.code}-${index + 1}`,
    productId: line.productId,
    sku: line.sku,
    quantity: line.quantity,
    layers: layersFor(line.sku, line.quantity),
    locationType: 'Dock' as const,
    zone: `Dock ${dockCode}`,
    dockCode,
    shipmentId: shipment.code,
  }));
  if (docs.length > 0) await YardPallet.insertMany(docs);
}

/** Gives the bay a forklift. Returns true when one is (or already was) working it. */
export async function assignForklift(
  siteCode: string,
  dockCode: string,
  status: 'Loading' | 'Unloading',
  line?: { sku: string | null; productId?: Types.ObjectId | null }
): Promise<boolean> {
  const existing = await YardVehicle.findOne({ siteCode, kind: 'Forklift', assignedBay: dockCode });
  if (existing) return true;

  const forklift = await YardVehicle.findOne({
    siteCode,
    kind: 'Forklift',
    status: 'Idle',
    assignedBay: null,
    battery: { $gte: FORKLIFT_MIN_BATTERY },
  }).sort({ battery: -1 });
  if (!forklift) return false;

  forklift.status = status;
  forklift.assignedBay = dockCode;
  forklift.activeSku = line?.sku ?? null;
  forklift.activeProductId = line?.productId ?? null;
  forklift.zone = 'Dock apron';
  forklift.taskStartedAt = new Date();
  await forklift.save();
  return true;
}

export async function releaseForklifts(siteCode: string, dockCode: string): Promise<void> {
  await YardVehicle.updateMany(
    { siteCode, kind: 'Forklift', assignedBay: dockCode },
    { $set: { status: 'Idle', assignedBay: null, activeSku: null, activeProductId: null, zone: 'Staging B', taskStartedAt: null } }
  );
}

/** Backs `truck` into `dock` for `shipment`: inbound trucks start unloading at once, outbound trucks wait for pick/load. */
async function dockTruck(
  dock: IDockBayDocument,
  truck: IYardVehicleDocument,
  shipment: IShipmentTrackerDocument
): Promise<void> {
  const inbound = shipment.direction === 'Inbound';
  const first = shipment.manifest[0];
  const now = new Date();

  truck.assignedBay = dock.code;
  truck.shipmentId = shipment.code;
  truck.manifest = toLines(shipment.manifest) as IYardVehicleDocument['manifest'];
  truck.activeSku = first?.sku ?? null;
  truck.activeProductId = first?.productId ?? null;
  truck.progress = 0;
  truck.status = inbound ? 'Unloading' : 'Idle';
  truck.taskStartedAt = inbound ? now : null;
  await truck.save();

  dock.status = inbound ? 'Unloading' : 'Occupied';
  dock.assignedTruckId = truck.code;
  dock.assignedShipmentId = shipment.code;
  dock.since = now;
  await dock.save();

  shipment.truckId = truck.code;
  shipment.dockId = dock.code;
  if (inbound) shipment.stage = 'Delivered';
  await shipment.save();

  await syncDockPallets(dock.siteCode, dock.code, shipment);
  await assignForklift(dock.siteCode, dock.code, inbound ? 'Unloading' : 'Loading', { sku: first?.sku ?? null, productId: first?.productId ?? null });
}

/** Puts every shipment that is waiting for a bay onto the next free one. */
export async function assignQueuedShipments(siteCode: string): Promise<void> {
  const queued = await ShipmentTracker.find({
    siteCode,
    completedAt: null,
    dockId: null,
    $or: [
      { stage: { $in: ['Order Confirmed', 'Picked'] } },
      // An inbound truck only backs in once there is something to unload (a purchase receipt that has been booked in).
      { direction: 'Inbound', stage: 'In Transit', etaAt: { $lte: new Date() }, 'manifest.0': { $exists: true } },
    ],
  }).sort({ createdAt: 1 });

  for (const shipment of queued) {
    const dock = await DockBay.findOne({ siteCode, status: 'Available', assignedTruckId: null }).sort({ code: 1 });
    if (!dock) return;
    const truck = (shipment.truckId ? await YardVehicle.findOne({ siteCode, kind: 'Truck', code: shipment.truckId }) : null) ?? (await takeTruck(siteCode));
    await dockTruck(dock, truck, shipment);
  }
}

/**
 * Order Confirmed -> Picked (the units come off the racks into the outbound lane) -> Loading (a forklift is on the bay
 * and the truck starts filling). The simulation only moves `autopilot` shipments; `onlyCode` moves exactly one shipment
 * (the operator's "Trigger Pick" / "Load Truck" buttons), whatever its autopilot flag.
 */
export async function advanceOutboundStages(siteCode: string, onlyCode?: string): Promise<void> {
  const shipments = await ShipmentTracker.find({
    siteCode,
    direction: 'Outbound',
    completedAt: null,
    dockId: { $ne: null },
    stage: { $in: ['Order Confirmed', 'Picked'] },
    ...(onlyCode ? { code: onlyCode } : { autopilot: true }),
  }).sort({ createdAt: 1 });

  for (const shipment of shipments) {
    const dockCode = shipment.dockId as string;
    const truck = shipment.truckId ? await YardVehicle.findOne({ siteCode, kind: 'Truck', code: shipment.truckId }) : null;
    if (!truck) continue;

    if (shipment.stage === 'Order Confirmed') {
      const laneLines = shipment.manifest.slice(0, LANE_CELLS.length);
      if ((await freeLaneCells(siteCode)) < laneLines.length) continue;
      for (const line of laneLines) {
        await stageUnitsInLane(siteCode, { productId: line.productId, sku: line.sku, quantity: line.quantity }, shipment.code);
      }
      // Lines beyond the lane's capacity are drawn straight off the shelves onto the truck.
      for (const line of shipment.manifest.slice(LANE_CELLS.length)) {
        await pickUnits(siteCode, line.sku, line.quantity);
      }
      shipment.stage = 'Picked';
      await shipment.save();
      continue;
    }

    const first = shipment.manifest[0];
    if (!(await assignForklift(siteCode, dockCode, 'Loading', { sku: first?.sku ?? null, productId: first?.productId ?? null }))) continue;

    const now = new Date();
    truck.status = 'Loading';
    truck.progress = 0;
    truck.taskStartedAt = now;
    await truck.save();
    await DockBay.updateOne({ siteCode, code: dockCode }, { $set: { status: 'Loading', since: now } });
    shipment.stage = 'Loading';
    await shipment.save();
  }
}

/** Every working truck should have a forklift on its bay; hand out idle ones as they free up. */
async function staffWorkingBays(siteCode: string): Promise<void> {
  const trucks = await YardVehicle.find({ siteCode, kind: 'Truck', status: { $in: [...WORKING] }, assignedBay: { $ne: null } });
  for (const truck of trucks) {
    await assignForklift(siteCode, truck.assignedBay as string, truck.status as 'Loading' | 'Unloading', {
      sku: truck.activeSku,
      productId: truck.activeProductId,
    });
  }
}

/** Outbound shipments that have been on the road long enough are delivered and their trucks return to the pool. */
async function deliverArrivedShipments(siteCode: string): Promise<void> {
  const cutoff = new Date(Date.now() - TRANSIT_DELIVERY_MS);
  const arrived = await ShipmentTracker.find({
    siteCode,
    direction: 'Outbound',
    stage: 'In Transit',
    transitStartedAt: { $ne: null, $lte: cutoff },
  });
  for (const shipment of arrived) {
    await markDelivered(shipment);
  }
}

async function markDelivered(shipment: IShipmentTrackerDocument): Promise<void> {
  shipment.stage = 'Delivered';
  shipment.completedAt = shipment.completedAt ?? new Date();
  await shipment.save();
  await YardVehicle.updateOne(
    { siteCode: shipment.siteCode, kind: 'Truck', code: shipment.truckId, shipmentId: shipment.code, status: 'In Transit' },
    { $set: { status: 'Idle', shipmentId: null, manifest: [], progress: 0, activeSku: null, activeProductId: null } }
  );
  await notifyLedger(shipment, 'delivered');
}

export interface DispatchOptions {
  /** Also move shipments through their stages. Left off when a ledger hook only wants to place the new shipment. */
  advance?: boolean;
}

/** One pass of the yard dispatcher: places queued shipments, advances stages and staffs working bays. */
export async function dispatchSite(siteCode: string, options: DispatchOptions = {}): Promise<void> {
  await deliverArrivedShipments(siteCode);
  await assignQueuedShipments(siteCode);
  if (options.advance) await advanceOutboundStages(siteCode);
  await staffWorkingBays(siteCode);
}

/**
 * Inbound work: puts pallets of the shipment's goods on racks as the truck empties. Whole pallets are put away as soon
 * as they are "unloaded"; the last partial pallet goes on when the truck finishes (`final`). Unit counts are exact, so
 * rack stock always equals what the ledger booked in.
 */
async function unloadShipment(siteCode: string, shipment: IShipmentTrackerDocument, progress: number, final: boolean): Promise<void> {
  let changed = false;
  for (const line of shipment.manifest) {
    const target = final ? line.quantity : Math.floor((line.quantity * progress) / 100);
    let toMove = target - (line.done ?? 0);
    const perPallet = unitsPerPallet(line.sku);

    while (toMove > 0) {
      const chunk = final ? Math.min(perPallet, toMove) : toMove >= perPallet ? perPallet : 0;
      if (chunk <= 0) break;
      const placed = await putAwayUnits(siteCode, { productId: line.productId, sku: line.sku, quantity: chunk }, shipment.code);
      if (placed <= 0) break;
      line.done = (line.done ?? 0) + placed;
      toMove -= placed;
      changed = true;
      if (placed < chunk) break;
    }
  }
  if (changed) {
    shipment.markModified('manifest');
    await shipment.save();
  }
}

/** Outbound work: the picked pallets in the lane shrink as the truck fills, and are gone when it leaves. */
async function loadShipment(siteCode: string, shipment: IShipmentTrackerDocument, progress: number, final: boolean): Promise<void> {
  for (const line of shipment.manifest) {
    const loaded = final ? line.quantity : Math.floor((line.quantity * progress) / 100);
    await loadFromLane(siteCode, shipment.code, line.sku, line.quantity - loaded);
    line.done = loaded;
  }
  shipment.markModified('manifest');
  await shipment.save();
}

/** Moves the pallets for a truck's current progress (called by the simulation every tick). */
export async function workShipment(siteCode: string, truck: IYardVehicleDocument): Promise<void> {
  if (!truck.shipmentId) return;
  const shipment = await ShipmentTracker.findOne({ code: truck.shipmentId });
  if (!shipment) return;
  if (truck.status === 'Unloading') await unloadShipment(siteCode, shipment, truck.progress, false);
  else if (truck.status === 'Loading') await loadShipment(siteCode, shipment, truck.progress, false);
}

/** Wraps up a truck that has reached 100%: frees its bay and forklift, then departs (outbound) or leaves empty (inbound). */
export async function completeTruckTask(siteCode: string, truck: IYardVehicleDocument): Promise<void> {
  const now = new Date();
  const inbound = truck.status === 'Unloading';
  const dockCode = truck.assignedBay;
  const shipment = truck.shipmentId ? await ShipmentTracker.findOne({ code: truck.shipmentId }) : null;

  if (dockCode) {
    await DockBay.updateOne(
      { siteCode, code: dockCode },
      { $set: { status: 'Available', assignedTruckId: null, assignedShipmentId: null, since: now } }
    );
    await releaseForklifts(siteCode, dockCode);
    await YardPallet.deleteMany({ siteCode, locationType: 'Dock', dockCode });
  }

  if (shipment) {
    if (inbound) {
      await unloadShipment(siteCode, shipment, 100, true);
      shipment.stage = 'Delivered';
    } else {
      await loadShipment(siteCode, shipment, 100, true);
      shipment.stage = 'In Transit';
      shipment.transitStartedAt = now;
      await YardPallet.deleteMany({ siteCode, locationType: 'Staging', shipmentId: shipment.code });
    }
    shipment.completedAt = now;
    shipment.dockId = null;
    await shipment.save();
    await notifyLedger(shipment, inbound ? 'put-away' : 'dispatched');
  }

  truck.status = 'In Transit';
  truck.assignedBay = null;
  truck.taskStartedAt = null;
  if (inbound) {
    truck.shipmentId = null;
    truck.manifest = [];
    truck.activeSku = null;
    truck.activeProductId = null;
    truck.progress = 0;
  } else {
    truck.progress = 100;
  }
  await truck.save();
}

function mergeLines(shipment: IShipmentTrackerDocument, lines: LedgerLine[]): void {
  for (const line of lines) {
    const existing = shipment.manifest.find((entry) => entry.sku === line.sku);
    if (existing) existing.quantity += line.quantity;
    else shipment.manifest.push({ productId: line.productId, sku: line.sku, quantity: line.quantity, done: 0 });
  }
  shipment.units = shipment.manifest.reduce((sum, line) => sum + line.quantity, 0);
  shipment.expectedUnits = Math.max(shipment.expectedUnits ?? 0, shipment.units);
}

/**
 * Turns a ledger transaction into yard work. Creates (or extends) the inbound/outbound `ShipmentTracker`, then lets the
 * dispatcher give it a truck, a bay and a forklift. Safe to call for every transaction; repeats merge by `sourceKey`.
 * A purchase order that already has an open shipment (it may have been planned at another facility) is received there.
 */
export function registerShipment(input: RegisterShipmentInput): Promise<RegisteredShipment | null> {
  return withYardLock(async () => {
    if (input.lines.length === 0) return null;

    const inbound = input.direction === 'Inbound';
    const mergeable = inbound ? ['Order Confirmed', 'In Transit', 'Delivered'] : ['Order Confirmed', 'Picked'];
    let shipment = await ShipmentTracker.findOne({
      direction: input.direction,
      sourceKey: input.sourceKey,
      completedAt: null,
      stage: { $in: mergeable },
      ...(input.siteCode && !inbound ? { siteCode: input.siteCode.trim().toUpperCase() } : {}),
    }).sort({ createdAt: 1 });

    const site = await resolveSite(shipment?.siteCode ?? input.siteCode);
    if (!site) return null;
    if (shipment && shipment.siteCode !== site.code) shipment = null;

    if (shipment) {
      mergeLines(shipment, input.lines);
      if (input.expectedUnits) shipment.expectedUnits = Math.max(shipment.expectedUnits, input.expectedUnits);
      if (inbound && shipment.stage === 'In Transit') {
        // The goods have been booked in, so the waiting truck is let into a bay.
        shipment.stage = 'Order Confirmed';
        shipment.etaAt = new Date();
      }
      await shipment.save();
      if (shipment.truckId) {
        await YardVehicle.updateOne(
          { siteCode: site.code, kind: 'Truck', code: shipment.truckId },
          { $set: { manifest: toLines(shipment.manifest) } }
        );
      }
      if (shipment.dockId) await syncDockPallets(site.code, shipment.dockId, shipment);
    } else {
      const party = input.partyName?.trim() || (inbound ? 'Supplier' : 'Customer');
      const origin = inbound ? party : site.name;
      const destination = inbound ? site.name : party;
      shipment = new ShipmentTracker({
        code: await nextShipmentCode(),
        siteCode: site.code,
        direction: input.direction,
        stage: 'Order Confirmed',
        linkType: input.linkType,
        linkRef: input.linkRef,
        sourceKey: input.sourceKey,
        orderId: input.orderId ? new Types.ObjectId(input.orderId) : null,
        saleId: input.saleId ? new Types.ObjectId(input.saleId) : null,
        partyName: party,
        expectedUnits: input.expectedUnits ?? 0,
        // Ledger-linked outbound work waits for an operator; everything else runs on the yard's own clock.
        autopilot: !(input.linkType === 'SalesInvoice' || input.linkType === 'PurchaseReceipt'),
        origin,
        destination,
        route: `${origin} → ${destination}`,
        etaAt: new Date(Date.now() + ETA_MINUTES[input.direction] * 60_000),
      });
      mergeLines(shipment, input.lines);
      await shipment.save();
    }

    await dispatchSite(site.code);
    const fresh = await ShipmentTracker.findById(shipment._id);
    return { siteCode: site.code, shipmentCode: shipment.code, truckCode: fresh?.truckId ?? null };
  });
}

export interface AdvancedShipment {
  siteCode: string;
  shipmentCode: string;
  previousStage: string;
  stage: string;
}

function signature(shipment: IShipmentTrackerDocument | null): string {
  return shipment ? `${shipment.stage}|${shipment.dockId ?? '-'}|${shipment.completedAt?.getTime() ?? '-'}` : '';
}

/**
 * Operator shortcut behind the "Advance Shipment Stage" action: moves one open shipment exactly one step right away
 * instead of waiting for the yard simulation.
 * - Outbound: Trigger Pick (units come off the racks into the lane) -> Load Truck -> Dispatch Shipment -> Mark Delivered.
 * - Inbound: let the booked-in truck into a bay, or Complete Put-Away for a truck that is unloading.
 * A purchase order that has not been received yet is received by the warehouse service before this is reached.
 */
export function advanceShipment(code: string): Promise<AdvancedShipment> {
  return withYardLock(async () => {
    const shipment = await ShipmentTracker.findOne({ code });
    if (!shipment) throw new AppError(404, `Shipment ${code} was not found`);
    if (shipment.stage === 'Delivered' && shipment.completedAt !== null) throw new AppError(409, `Shipment ${code} is already delivered`);

    const siteCode = shipment.siteCode;
    const previousStage = shipment.stage;
    const before = signature(shipment);
    const inbound = shipment.direction === 'Inbound';
    const truck = shipment.truckId ? await YardVehicle.findOne({ siteCode, kind: 'Truck', code: shipment.truckId }) : null;

    if (inbound) {
      if (previousStage === 'In Transit' && shipment.manifest.length === 0) {
        throw new AppError(409, `Nothing has been received on ${shipment.linkRef} yet. Receive the purchase order first.`);
      }
      if (truck && truck.status === 'Unloading' && truck.assignedBay) {
        truck.progress = 100;
        await completeTruckTask(siteCode, truck);
      } else {
        if (shipment.stage === 'In Transit') {
          shipment.stage = 'Order Confirmed';
          shipment.etaAt = new Date();
          await shipment.save();
        }
        await assignQueuedShipments(siteCode);
      }
    } else if (previousStage === 'In Transit') {
      await markDelivered(shipment);
    } else if (previousStage === 'Loading' && truck && truck.status === 'Loading' && truck.assignedBay) {
      truck.progress = 100;
      await completeTruckTask(siteCode, truck);
    } else {
      await assignQueuedShipments(siteCode);
      await advanceOutboundStages(siteCode, code);
    }

    const fresh = await ShipmentTracker.findOne({ code });
    if (signature(fresh) === before) {
      throw new AppError(409, `${code} cannot move yet: no free dock bay, forklift or outbound-lane space at ${siteCode}.`);
    }
    return { siteCode, shipmentCode: code, previousStage, stage: fresh?.stage ?? previousStage };
  });
}
