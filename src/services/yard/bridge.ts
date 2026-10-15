import { Types } from 'mongoose';
import { StockMovement } from '../../models/StockMovement.model';
import { registerShipment, type LedgerLine, type RegisteredShipment } from './dispatcher';

/**
 * Ledger -> yard bridge. The stock, order and sales services call these after a transaction has been committed.
 * A yard problem must never undo or fail a ledger write, so every entry point swallows (and logs) its errors.
 */
export interface YardSource {
  /** `PURCHASE` receipts come from orders; `SALE` invoices from the sales module. */
  kind: 'PURCHASE' | 'SALE';
  /** `ORD-10503` / `INV-009`. */
  ref: string;
  partyName?: string;
  /** Mongo id of the order or sale. */
  id?: string;
  /** Total units the whole order asks for (a receipt may only book part of it). */
  expectedUnits?: number;
}

export interface YardHookOptions {
  /** Facility the goods physically move through; defaults to the primary site. */
  siteCode?: string;
  source?: YardSource;
}

export interface YardLedgerLine extends LedgerLine {
  /** The `StockMovement` the ledger just wrote for this line, linked back to the shipment afterwards. */
  movementId?: Types.ObjectId;
}

async function linkMovements(lines: YardLedgerLine[], result: RegisteredShipment): Promise<void> {
  const ids = lines.map((line) => line.movementId).filter((id): id is Types.ObjectId => Boolean(id));
  if (ids.length === 0) return;
  await StockMovement.updateMany(
    { _id: { $in: ids } },
    { $set: { siteCode: result.siteCode, shipmentCode: result.shipmentCode, ...(result.truckCode ? { truckCode: result.truckCode } : {}) } }
  );
}

async function safely(label: string, work: () => Promise<void>): Promise<void> {
  try {
    await work();
  } catch (error) {
    console.error(`[yard] ${label} failed; the ledger entry is unaffected`, error);
  }
}

/** A purchase receipt or stock-in: an inbound truck takes a bay, unloads, and forklifts put the pallets on racks. */
export function yardAfterStockIn(line: YardLedgerLine, options: YardHookOptions = {}): Promise<void> {
  return safely('Inbound shipment hook', async () => {
    const source = options.source;
    const result = await registerShipment({
      direction: 'Inbound',
      siteCode: options.siteCode,
      lines: [line],
      linkType: source?.kind === 'PURCHASE' ? 'PurchaseReceipt' : 'StockIn',
      linkRef: source?.ref ?? 'Stock-in',
      sourceKey: source ? `PO:${source.ref}` : `STOCK-IN:${String(line.productId)}`,
      partyName: source?.partyName ?? 'Direct stock-in',
      orderId: source?.kind === 'PURCHASE' ? source.id : undefined,
      expectedUnits: source?.expectedUnits,
    });
    if (result) await linkMovements([line], result);
  });
}

/** A stock-out without an invoice: an outbound shipment is raised so pallets still leave the yard by truck. */
export function yardAfterStockOut(line: YardLedgerLine, options: YardHookOptions = {}): Promise<void> {
  return safely('Outbound shipment hook', async () => {
    const result = await registerShipment({
      direction: 'Outbound',
      siteCode: options.siteCode,
      lines: [line],
      linkType: 'StockOut',
      linkRef: options.source?.ref ?? 'Stock-out',
      sourceKey: `STOCK-OUT:${String(line.productId)}`,
      partyName: options.source?.partyName ?? 'Direct dispatch',
    });
    if (result) await linkMovements([line], result);
  });
}

/** A sales invoice: one outbound shipment carrying every invoice line, starting at Order Confirmed. */
export function yardAfterSale(
  invoice: { invoiceNumber: string; saleId: string; customerName: string; lines: YardLedgerLine[] },
  options: Pick<YardHookOptions, 'siteCode'> = {}
): Promise<void> {
  return safely('Sales invoice shipment hook', async () => {
    const result = await registerShipment({
      direction: 'Outbound',
      siteCode: options.siteCode,
      lines: invoice.lines,
      linkType: 'SalesInvoice',
      linkRef: invoice.invoiceNumber,
      sourceKey: `INV:${invoice.invoiceNumber}`,
      partyName: invoice.customerName,
      saleId: invoice.saleId,
    });
    if (result) await linkMovements(invoice.lines, result);
  });
}
