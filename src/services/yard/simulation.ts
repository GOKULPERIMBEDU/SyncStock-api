import { FacilitySite } from '../../models/FacilitySite';
import { YardVehicle } from '../../models/YardVehicle';
import { FORKLIFT_MIN_BATTERY, YARD_TICK_MS } from './constants';
import { completeTruckTask, dispatchSite, workShipment } from './dispatcher';
import { withYardLock } from './lock';

function log(message: string, error?: unknown): void {
  if (error) console.error(`[yard] ${message}`, error);
  else console.log(`[yard] ${message}`);
}

async function tickTrucks(siteCode: string): Promise<void> {
  const trucks = await YardVehicle.find({ siteCode, kind: 'Truck', status: { $in: ['Loading', 'Unloading'] } });
  for (const truck of trucks) {
    const before = truck.progress;
    const after = Math.min(100, before + 1 + (Math.random() < 0.5 ? 1 : 0));
    truck.progress = after;
    truck.activeSku = truck.manifest[Math.floor(after / 10) % Math.max(1, truck.manifest.length)]?.sku ?? truck.activeSku;
    await truck.save();

    if (after >= 100) {
      await completeTruckTask(siteCode, truck);
      continue;
    }
    // Pallets follow the truck's progress: whole pallets reach the racks while unloading, the lane empties while loading.
    await workShipment(siteCode, truck);

    if (truck.assignedBay && truck.activeSku) {
      const line = truck.manifest.find((entry) => entry.sku === truck.activeSku);
      await YardVehicle.updateMany(
        { siteCode, kind: 'Forklift', assignedBay: truck.assignedBay },
        { $set: { activeSku: truck.activeSku, activeProductId: line?.productId ?? null } }
      );
    }
  }
}

/** Working forklifts drain, charging ones recharge, and tired idle ones head to the charger. */
async function tickForklifts(siteCode: string): Promise<void> {
  const forklifts = await YardVehicle.find({ siteCode, kind: 'Forklift' });
  for (const forklift of forklifts) {
    if (forklift.status === 'Charging') {
      forklift.battery = Math.min(100, forklift.battery + 2);
      if (forklift.battery >= 80) {
        forklift.status = 'Idle';
        forklift.zone = 'Staging B';
      }
    } else if (forklift.status === 'Loading' || forklift.status === 'Unloading') {
      if (Math.random() < 0.5) forklift.battery = Math.max(12, forklift.battery - 1);
    } else if (forklift.status === 'Idle' && forklift.battery < FORKLIFT_MIN_BATTERY) {
      forklift.status = 'Charging';
      forklift.assignedBay = null;
      forklift.zone = 'Charging bay';
    } else {
      continue;
    }
    await forklift.save();
  }
}

/** Advances one site by one tick. Callers must hold the yard lock. */
async function tickSite(siteCode: string): Promise<void> {
  await tickTrucks(siteCode);
  await tickForklifts(siteCode);
  await dispatchSite(siteCode, { advance: true });
}

/** One simulation step across every facility. */
export function tickYard(): Promise<void> {
  return withYardLock(async () => {
    const sites = await FacilitySite.find().select('code').lean();
    for (const site of sites) {
      try {
        await tickSite(site.code);
      } catch (error) {
        log(`Tick failed for ${site.code}`, error);
      }
    }
  });
}

let timer: NodeJS.Timeout | null = null;
let running = false;

/** Starts the background yard simulation (idempotent). Truck progress, rack slots and forklift tasks are server-owned. */
export function startYardSimulation(): void {
  if (timer) return;
  timer = setInterval(() => {
    if (running) return;
    running = true;
    tickYard()
      .catch((error) => log('Simulation tick failed', error))
      .finally(() => {
        running = false;
      });
  }, YARD_TICK_MS);
  timer.unref();
  log(`Yard simulation running every ${YARD_TICK_MS} ms`);
}

export function stopYardSimulation(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
