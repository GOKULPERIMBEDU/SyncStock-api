import { ShipmentTracker } from '../models/ShipmentTracker';
import { orderRepository } from '../repositories/order.repository';
import { AppError } from '../utils/AppError';
import { orderService } from './order.service';
import { advanceShipment, type AdvancedShipment } from './yard/dispatcher';
import { buildMaterials, listShipments } from './yard/materials';
import { buildOverview, parseScope } from './yard/overview';
import { withYardLock } from './yard/lock';
import { seedFacilityData } from './yard/seeder';

export class WarehouseService {
  /** Unified live state for one site: ledger aggregates plus docks, vehicles, racks, pallets and shipments. */
  getOverview(siteId?: string, scope?: string) {
    return buildOverview(siteId, parseScope(scope));
  }

  /** Yard & Racks: every material, filterable by any category, with the sites / racks / staging cells that hold it. */
  getMaterials() {
    return buildMaterials();
  }

  /** Shipments with their ledger links, party names and the next operator action. */
  getShipments(siteId?: string) {
    return listShipments(siteId);
  }

  /**
   * One step of the shipment's lifecycle (the "Advance Shipment Stage" action in the 2D pages and the 3D inspector).
   * An inbound shipment that is still waiting for its purchase order to be received is received first, through the
   * ledger (stock-in + inbound shipment), so `currentStock` and the racks stay in step. This happens outside the yard
   * lock because the receipt itself takes it.
   */
  async advanceShipment(code: string): Promise<AdvancedShipment> {
    const shipment = await ShipmentTracker.findOne({ code });
    if (!shipment) throw new AppError(404, `Shipment ${code} was not found`);

    const waitingForReceipt =
      shipment.direction === 'Inbound' &&
      shipment.stage === 'In Transit' &&
      shipment.completedAt === null &&
      shipment.manifest.length === 0 &&
      shipment.linkType === 'PurchaseReceipt';

    if (waitingForReceipt) {
      const order = shipment.orderId ? await orderRepository.findById(String(shipment.orderId)) : await orderRepository.findByNumber(shipment.linkRef);
      if (!order) throw new AppError(404, `Purchase order ${shipment.linkRef} was not found`);
      await orderService.receive(String(order._id), shipment.siteCode, { all: true });
      const received = await ShipmentTracker.findOne({ code });
      return { siteCode: shipment.siteCode, shipmentCode: code, previousStage: shipment.stage, stage: received?.stage ?? shipment.stage };
    }

    return advanceShipment(code);
  }

  /** Restores the demo facility layer (sites, docks, fleet, racks, pallets, shipments). The ledger is not touched. */
  reseed() {
    return withYardLock(async () => {
      await seedFacilityData({ reset: true });
      return { reseeded: true };
    });
  }
}

export const warehouseService = new WarehouseService();
