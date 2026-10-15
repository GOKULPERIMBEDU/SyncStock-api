import { Types } from 'mongoose';
import { FacilitySite } from '../../models/FacilitySite';
import { StorageRack, type IStorageRackDocument } from '../../models/StorageRack';
import { YardPallet, type IYardPallet } from '../../models/YardPallet';
import { LANE_CELLS, STAGING_CELLS, layersFor, stagingZoneName, unitsPerPallet } from './constants';

export interface PalletLine {
  productId: Types.ObjectId;
  sku: string;
  quantity: number;
}

function numericSuffix(code: string): number {
  const match = /(\d+)$/.exec(code);
  return match ? Number(match[1]) : 0;
}

/** Builds the `Rack` pallet document for slot `slotIndex` of `rack`. `units` defaults to one full pallet (or the line). */
export function rackPalletDoc(
  rack: { siteCode: string; code: string; zone: string },
  slotIndex: number,
  line: PalletLine,
  units?: number,
  shipmentId?: string | null
): IYardPallet {
  const quantity = units ?? Math.min(line.quantity, unitsPerPallet(line.sku));
  return {
    siteCode: rack.siteCode,
    code: `RP-${rack.code}-${slotIndex + 1}`,
    productId: line.productId,
    sku: line.sku,
    quantity,
    layers: layersFor(line.sku, quantity),
    locationType: 'Rack',
    zone: rack.zone,
    rackCode: rack.code,
    slotIndex,
    shipmentId: shipmentId ?? null,
  };
}

/** Next free `PAL-####` code at a site. */
export async function nextPalletCode(siteCode: string): Promise<string> {
  const codes = await YardPallet.find({ siteCode, code: /^PAL-/ }).select('code').lean();
  const max = codes.reduce((highest, entry) => Math.max(highest, numericSuffix(entry.code)), 1000);
  return `PAL-${max + 1}`;
}

/** Applies a change in occupied pallet positions to the site totals and keeps the utilisation percentage in step. */
export async function adjustSitePallets(siteCode: string, delta: number): Promise<void> {
  await FacilitySite.updateOne({ code: siteCode }, [
    { $set: { palletsStored: { $max: [0, { $min: ['$palletCapacity', { $add: ['$palletsStored', delta] }] }] } } },
    { $set: { utilization: { $round: [{ $multiply: [{ $divide: ['$palletsStored', '$palletCapacity'] }, 100] }, 0] } } },
  ]);
}

/**
 * Puts one pallet (`line.quantity` units, at most one pallet's worth) on a rack: a rack already holding the SKU first,
 * then an empty rack (which is claimed for the SKU). Returns the rack used, or null when every suitable rack is full.
 */
export async function putAwayOnRack(siteCode: string, line: PalletLine, shipmentCode?: string): Promise<IStorageRackDocument | null> {
  const racks = await StorageRack.find({ siteCode }).sort({ code: 1 });
  const matching = racks.filter((rack) => rack.assignedSku === line.sku && rack.occupiedSlots < rack.capacity);
  const emptied = racks.filter((rack) => rack.occupiedSlots === 0 && rack.assignedSku !== line.sku);
  // Spread load: fill the emptiest matching rack first so the row evens out.
  const candidates = [...matching.sort((a, b) => a.occupiedSlots - b.occupiedSlots), ...emptied];

  for (const candidate of candidates) {
    const claim = candidate.assignedSku === line.sku ? {} : { assignedSku: line.sku, assignedProductId: line.productId };
    const updated = await StorageRack.findOneAndUpdate(
      // Guard on the occupancy we read, so a concurrent writer can never double-book a slot.
      { _id: candidate._id, occupiedSlots: candidate.occupiedSlots },
      { $inc: { occupiedSlots: 1 }, $set: claim },
      { new: true }
    );
    if (!updated) continue;
    await YardPallet.create(rackPalletDoc(updated, updated.occupiedSlots - 1, line, undefined, shipmentCode));
    await adjustSitePallets(siteCode, 1);
    return updated;
  }
  return null;
}

/** Free cells of `cells` on the staging grid. */
async function freeCells(siteCode: string, cells: Array<{ row: number; col: number }>) {
  const taken = await YardPallet.find({ siteCode, locationType: 'Staging' }).select('row col').lean();
  const used = new Set(taken.map((pallet) => `${pallet.row}:${pallet.col}`));
  return cells.filter((cell) => !used.has(`${cell.row}:${cell.col}`));
}

/** Number of outbound-lane cells still free at a site. */
export async function freeLaneCells(siteCode: string): Promise<number> {
  return (await freeCells(siteCode, LANE_CELLS)).length;
}

/** Stages overflow in Staging Zone A/B when no rack can take a pallet. Returns null when both zones are full. */
export async function stageInZone(siteCode: string, line: PalletLine, shipmentCode?: string): Promise<IYardPallet | null> {
  const [cell] = await freeCells(siteCode, STAGING_CELLS);
  if (!cell) return null;
  const quantity = Math.min(line.quantity, unitsPerPallet(line.sku));
  return YardPallet.create({
    siteCode,
    code: await nextPalletCode(siteCode),
    productId: line.productId,
    sku: line.sku,
    quantity,
    layers: layersFor(line.sku, quantity),
    locationType: 'Staging',
    zone: stagingZoneName(cell.row),
    row: cell.row,
    col: cell.col,
    shipmentId: shipmentCode ?? null,
  });
}

/**
 * Receives `line.quantity` units into the yard as real pallets of up to one pallet's worth each: racks first, Staging
 * Zone A/B when the racks are full. Returns the units actually placed (less than asked only when the yard is full).
 */
export async function putAwayUnits(siteCode: string, line: PalletLine, shipmentCode?: string): Promise<number> {
  const perPallet = unitsPerPallet(line.sku);
  let remaining = line.quantity;
  let placed = 0;

  while (remaining > 0) {
    const chunk = Math.min(perPallet, remaining);
    const part = { ...line, quantity: chunk };
    const rack = await putAwayOnRack(siteCode, part, shipmentCode);
    if (!rack && !(await stageInZone(siteCode, part, shipmentCode))) break;
    placed += chunk;
    remaining -= chunk;
  }
  return placed;
}

/**
 * Takes `units` of `sku` off the shelves: the fullest rack first (top pallet down), then loose Staging Zone A/B pallets.
 * Pallets shrink or disappear as they are drawn down. Returns the units actually taken.
 */
export async function pickUnits(siteCode: string, sku: string, units: number): Promise<number> {
  let remaining = units;

  while (remaining > 0) {
    const rack = await StorageRack.findOne({ siteCode, assignedSku: sku, occupiedSlots: { $gt: 0 } }).sort({ occupiedSlots: -1 });
    if (!rack) break;

    const slotIndex = rack.occupiedSlots - 1;
    const pallet = await YardPallet.findOne({ siteCode, rackCode: rack.code, locationType: 'Rack', slotIndex });
    const take = pallet ? Math.min(pallet.quantity, remaining) : 0;

    if (!pallet || take >= pallet.quantity) {
      if (pallet) await pallet.deleteOne();
      await StorageRack.updateOne({ _id: rack._id }, { $inc: { occupiedSlots: -1 } });
      await adjustSitePallets(siteCode, -1);
    } else {
      pallet.quantity -= take;
      pallet.layers = layersFor(sku, pallet.quantity);
      await pallet.save();
    }
    remaining -= take;
  }

  if (remaining > 0) {
    const loose = await YardPallet.find({ siteCode, sku, locationType: 'Staging', row: { $lt: 6 } }).sort({ quantity: 1 });
    for (const pallet of loose) {
      if (remaining <= 0) break;
      const take = Math.min(pallet.quantity, remaining);
      remaining -= take;
      if (take >= pallet.quantity) {
        await pallet.deleteOne();
      } else {
        pallet.quantity -= take;
        pallet.layers = layersFor(sku, pallet.quantity);
        await pallet.save();
      }
    }
  }

  return units - remaining;
}

/** Writes a pallet into the first free outbound-lane cell without touching the racks. Returns null when the lane is full. */
export async function placeLanePallet(siteCode: string, line: PalletLine, shipmentCode: string): Promise<IYardPallet | null> {
  const [cell] = await freeCells(siteCode, LANE_CELLS);
  if (!cell || line.quantity <= 0) return null;
  return YardPallet.create({
    siteCode,
    code: await nextPalletCode(siteCode),
    productId: line.productId,
    sku: line.sku,
    quantity: line.quantity,
    layers: layersFor(line.sku, line.quantity),
    locationType: 'Staging',
    zone: stagingZoneName(cell.row),
    row: cell.row,
    col: cell.col,
    shipmentId: shipmentCode,
  });
}

/** Picks `line.quantity` units off the shelves into one outbound-lane pallet for `shipmentCode`. */
export async function stageUnitsInLane(siteCode: string, line: PalletLine, shipmentCode: string): Promise<IYardPallet | null> {
  if ((await freeLaneCells(siteCode)) === 0) return null;
  const picked = await pickUnits(siteCode, line.sku, line.quantity);
  return placeLanePallet(siteCode, { ...line, quantity: picked }, shipmentCode);
}

/** Shrinks the lane pallets of `shipmentCode` / `sku` to `remainingUnits` as the truck is loaded (0 clears them). */
export async function loadFromLane(siteCode: string, shipmentCode: string, sku: string, remainingUnits: number): Promise<void> {
  const pallets = await YardPallet.find({ siteCode, locationType: 'Staging', shipmentId: shipmentCode, sku, row: { $gte: 6 } }).sort({ row: 1 });
  let remaining = Math.max(0, remainingUnits);
  for (const pallet of pallets) {
    const keep = Math.min(pallet.quantity, remaining);
    remaining -= keep;
    if (keep <= 0) {
      await pallet.deleteOne();
    } else if (keep !== pallet.quantity) {
      pallet.quantity = keep;
      pallet.layers = layersFor(sku, keep);
      await pallet.save();
    }
  }
}
