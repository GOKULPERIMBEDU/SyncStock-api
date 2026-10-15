import { FacilitySite } from '../../models/FacilitySite';
import { Product } from '../../models/Product.model';
import { ShipmentTracker } from '../../models/ShipmentTracker';
import { YardPallet } from '../../models/YardPallet';
import type { MaterialCategoryDto, MaterialDto, MaterialLocationDto, MaterialsDto, ShipmentsListDto, StockBadge } from '../../types/warehouse';
import { toShipmentDto } from './overview';
import { resolveSite } from './dispatcher';

function badge(quantity: number, reorderPoint: number): StockBadge {
  if (quantity <= 0) return 'Out of Stock';
  if (quantity <= reorderPoint) return 'Low Stock';
  return 'In Stock';
}

interface LocationAccumulator extends MaterialLocationDto {
  key: string;
}

/**
 * The Yard & Racks read model: every material in the ledger (any category) with the sites, racks, staging cells and
 * outbound lanes that physically hold it. Dock pallets are not listed - they are a view of the truck's manifest, not
 * extra stock.
 */
export async function buildMaterials(): Promise<MaterialsDto> {
  const [products, sites, pallets, openShipments] = await Promise.all([
    Product.find().sort({ category: 1, name: 1 }),
    FacilitySite.find().select('code name').lean(),
    YardPallet.find({ locationType: { $in: ['Rack', 'Staging'] } }).sort({ siteCode: 1, code: 1 }),
    ShipmentTracker.find({ completedAt: null }),
  ]);

  const siteNames = new Map(sites.map((site) => [site.code, site.name]));

  const locations = new Map<string, Map<string, LocationAccumulator>>();
  for (const pallet of pallets) {
    const lane = pallet.locationType === 'Staging' && (pallet.row ?? 0) >= 6;
    const kind: MaterialLocationDto['kind'] = pallet.locationType === 'Rack' ? 'Rack' : lane ? 'Outbound lane' : 'Staging';
    const place = pallet.locationType === 'Rack' ? `Rack ${pallet.rackCode}` : lane ? `Lane cell r${pallet.row}·c${pallet.col}` : `${pallet.zone} r${pallet.row}·c${pallet.col}`;
    const key = `${pallet.siteCode}|${kind}|${pallet.locationType === 'Rack' ? pallet.rackCode : 'cells'}`;
    const perProduct = locations.get(String(pallet.productId)) ?? new Map<string, LocationAccumulator>();
    const existing = perProduct.get(key);
    if (existing) {
      existing.units += pallet.quantity;
      existing.pallets += 1;
    } else {
      perProduct.set(key, {
        key,
        siteCode: pallet.siteCode,
        siteName: siteNames.get(pallet.siteCode) ?? pallet.siteCode,
        kind,
        place: kind === 'Rack' ? place : kind === 'Outbound lane' ? 'Outbound lane' : pallet.zone,
        zone: pallet.zone,
        units: pallet.quantity,
        pallets: 1,
      });
    }
    locations.set(String(pallet.productId), perProduct);
  }

  const inbound = new Map<string, number>();
  const outboundPending = new Map<string, number>();
  for (const shipment of openShipments) {
    for (const line of shipment.manifest) {
      const id = String(line.productId);
      if (shipment.direction === 'Inbound') inbound.set(id, (inbound.get(id) ?? 0) + Math.max(0, line.quantity - (line.done ?? 0)));
      else if (shipment.stage === 'Order Confirmed') outboundPending.set(id, (outboundPending.get(id) ?? 0) + line.quantity);
    }
  }

  const materials: MaterialDto[] = products.map((product) => {
    const id = String(product._id);
    const rows = [...(locations.get(id)?.values() ?? [])].map(({ key: _key, ...row }) => row);
    const onHand = rows.filter((row) => row.kind === 'Rack' || row.kind === 'Staging').reduce((sum, row) => sum + row.units, 0);
    const inMotion = rows.filter((row) => row.kind === 'Outbound lane').reduce((sum, row) => sum + row.units, 0);
    return {
      id,
      sku: product.sku,
      name: product.name,
      category: product.category,
      unitPrice: product.price,
      currentStock: product.currentStock,
      lowStockThreshold: product.lowStockThreshold,
      status: badge(product.currentStock, product.lowStockThreshold),
      onHand,
      inMotion,
      inbound: inbound.get(id) ?? 0,
      outboundPending: outboundPending.get(id) ?? 0,
      locations: rows,
      sites: [...new Set(rows.map((row) => row.siteCode))].sort(),
    };
  });

  const categoryMap = new Map<string, MaterialCategoryDto>();
  for (const material of materials) {
    const entry = categoryMap.get(material.category) ?? { name: material.category, products: 0, units: 0, value: 0 };
    entry.products += 1;
    entry.units += material.currentStock;
    entry.value += material.currentStock * material.unitPrice;
    categoryMap.set(material.category, entry);
  }

  return {
    generatedAt: new Date().toISOString(),
    categories: [...categoryMap.values()].sort((a, b) => a.name.localeCompare(b.name)),
    materials,
  };
}

/** Every open shipment network-wide plus the latest completed ones: the data behind the 2D shipment ledger links. */
export async function listShipments(siteId?: string): Promise<ShipmentsListDto> {
  const filter = siteId ? { siteCode: (await resolveSite(siteId))?.code } : {};
  const shipments = await ShipmentTracker.find(filter).sort({ createdAt: -1 }).limit(120);
  return { shipments: shipments.map(toShipmentDto) };
}
