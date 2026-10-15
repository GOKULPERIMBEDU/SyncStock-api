import { YardPallet } from '../../models/YardPallet';

/** Where a pallet's units are in the yard. `lane` and `dock` units have already left the ledger's stock figure. */
export type PalletBucket = 'rack' | 'staging' | 'lane' | 'dock';

export interface PhysicalRow {
  siteCode: string;
  productId: string;
  sku: string;
  bucket: PalletBucket;
  units: number;
  pallets: number;
}

/** Physical units per site / product / bucket, straight from the pallet documents (the yard's source of truth). */
export async function physicalRows(): Promise<PhysicalRow[]> {
  const rows = await YardPallet.aggregate<{
    _id: { siteCode: string; productId: unknown; sku: string; bucket: PalletBucket };
    units: number;
    pallets: number;
  }>([
    {
      $group: {
        _id: {
          siteCode: '$siteCode',
          productId: '$productId',
          sku: '$sku',
          bucket: {
            $switch: {
              branches: [
                { case: { $eq: ['$locationType', 'Rack'] }, then: 'rack' },
                { case: { $eq: ['$locationType', 'Dock'] }, then: 'dock' },
                { case: { $gte: [{ $ifNull: ['$row', 0] }, 6] }, then: 'lane' },
              ],
              default: 'staging',
            },
          },
        },
        units: { $sum: '$quantity' },
        pallets: { $sum: 1 },
      },
    },
  ]);
  return rows.map((row) => ({
    siteCode: row._id.siteCode,
    productId: String(row._id.productId),
    sku: row._id.sku,
    bucket: row._id.bucket,
    units: row.units,
    pallets: row.pallets,
  }));
}

/** Units on shelves or loose in staging (the stock that counts towards the ledger), per product, for one site or the network. */
export function onHandByProduct(rows: PhysicalRow[], siteCode?: string): Map<string, number> {
  const result = new Map<string, number>();
  for (const row of rows) {
    if (row.bucket !== 'rack' && row.bucket !== 'staging') continue;
    if (siteCode && row.siteCode !== siteCode) continue;
    result.set(row.productId, (result.get(row.productId) ?? 0) + row.units);
  }
  return result;
}

export function totalUnits(map: Map<string, number>): number {
  let total = 0;
  for (const value of map.values()) total += value;
  return total;
}
