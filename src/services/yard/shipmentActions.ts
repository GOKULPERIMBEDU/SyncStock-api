import type { ShipmentDirection, ShipmentStage } from '../../models/ShipmentTracker';

/** The operator button a shipment currently offers (the label the 2D pages and the 3D inspector show). */
export type ShipmentAction =
  | 'Trigger Pick'
  | 'Load Truck'
  | 'Dispatch Shipment'
  | 'Mark Delivered'
  | 'Receive / Put-Away'
  | 'Assign Dock'
  | 'Complete Put-Away';

export interface ActionContext {
  direction: ShipmentDirection;
  stage: ShipmentStage;
  completedAt: Date | null;
  /** Units that have actually arrived (manifest total); an inbound shipment with none is still waiting for its receipt. */
  units: number;
  dockId: string | null;
}

/**
 * Outbound: Order Confirmed -> Trigger Pick -> Load Truck -> Dispatch Shipment -> Mark Delivered.
 * Inbound: Receive / Put-Away (ledger receipt, forklift unloads) -> Complete Put-Away (rest of the pallets go on racks).
 */
export function nextActionFor(context: ActionContext): ShipmentAction | null {
  const { direction, stage, completedAt, units, dockId } = context;
  if (stage === 'Delivered' && completedAt !== null) return null;

  if (direction === 'Outbound') {
    if (stage === 'Order Confirmed') return 'Trigger Pick';
    if (stage === 'Picked') return 'Load Truck';
    if (stage === 'Loading') return 'Dispatch Shipment';
    if (stage === 'In Transit') return 'Mark Delivered';
    return null;
  }

  if (stage === 'In Transit') return units === 0 ? 'Receive / Put-Away' : 'Assign Dock';
  if (stage === 'Order Confirmed' && !dockId) return 'Assign Dock';
  if (stage === 'Delivered') return 'Complete Put-Away';
  return 'Receive / Put-Away';
}

/** `Inbound from Redington India` / `Outbound to Balaji Electronics`. */
export function partyLabel(shipment: { direction: ShipmentDirection; partyName?: string; origin: string; destination: string }): string {
  const inbound = shipment.direction === 'Inbound';
  const party = shipment.partyName?.trim() || (inbound ? shipment.origin : shipment.destination);
  return inbound ? `Inbound from ${party}` : `Outbound to ${party}`;
}
