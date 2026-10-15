import { Types } from 'mongoose';
import { DEFAULT_TENANT_ID, WORKSPACE_PRESETS } from '../config/workspaces';
import { Account } from '../models/Account';
import { Order } from '../models/Order';
import { Payment } from '../models/Payment';
import { Product } from '../models/Product.model';
import { Sale } from '../models/Sale';
import { Staff } from '../models/Staff';
import { StockMovement } from '../models/StockMovement.model';
import { SystemSetting } from '../models/SystemSetting';
import { User } from '../models/User';
import { settingRepository } from '../repositories/setting.repository';
import { withYardLock } from '../services/yard/lock';
import { ensureYardProducts, seedFacilityData } from '../services/yard/seeder';
import type { Migration } from './runner';

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'workspace';

/** Next `PREFIX-1234` identifier after the highest one already in `values`. */
function nextId(prefix: string, values: string[], floor: number): string {
  const max = values.reduce((highest, value) => {
    const match = new RegExp(`^${prefix}-(\\d+)$`).exec(value);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, floor);
  return `${prefix}-${max + 1}`;
}

/** The single legacy settings row becomes the default workspace (its company name, currency and tax are kept). */
const workspaceProfiles: Migration = {
  id: '2026-10-001',
  name: 'Workspace profiles (multi-tenant settings)',
  async up(log) {
    const legacy = await SystemSetting.collection.find({ tenantId: { $exists: false } }).toArray();
    const taken = new Set((await SystemSetting.find().select('tenantId').lean()).map((row) => row.tenantId));
    const hasDefault = Boolean(await SystemSetting.exists({ isDefault: true }));

    for (const [index, row] of legacy.entries()) {
      const company = String(row.companyName ?? 'SyncStock India Pvt Ltd');
      // A default workspace for this very company already exists (e.g. two starts overlapped): the legacy row is a duplicate.
      if (await SystemSetting.exists({ tenantId: { $exists: true }, organizationName: company })) {
        await SystemSetting.collection.deleteOne({ _id: row._id });
        log(`Legacy settings "${company}" already has a workspace; duplicate row removed`);
        continue;
      }
      let tenantId = index === 0 && !taken.has(DEFAULT_TENANT_ID) ? DEFAULT_TENANT_ID : slugify(company);
      while (taken.has(tenantId)) tenantId = `${tenantId}-${index + 2}`;
      taken.add(tenantId);
      const preset = WORKSPACE_PRESETS.find((entry) => entry.tenantId === tenantId) ?? WORKSPACE_PRESETS[0];
      await SystemSetting.collection.updateOne(
        { _id: row._id },
        {
          $set: {
            tenantId,
            organizationName: company,
            companyName: company,
            industryType: preset.industryType,
            defaultSiteCode: preset.defaultSiteCode,
            customCategories: preset.customCategories,
            isDefault: index === 0 && !hasDefault,
          },
        }
      );
      log(`Legacy settings "${company}" is now workspace "${tenantId}"`);
    }

    const created = await settingRepository.ensurePresets();
    await settingRepository.ensureDefault();
    return `${legacy.length} legacy profile(s) upgraded, ${created} preset workspace(s) installed`;
  },
};

/** `Standard` (legacy staff label) becomes `Staff`, matching the login roles Admin / Manager / Staff. */
const normalizeRoles: Migration = {
  id: '2026-10-002',
  name: 'Normalise Staff / User role strings',
  async up(log) {
    const staff = await Staff.collection.updateMany({ role: { $nin: ['Admin', 'Manager', 'Staff'] } }, { $set: { role: 'Staff' } });
    const users = await User.collection.updateMany({ role: { $nin: ['Admin', 'Manager', 'Staff'] } }, { $set: { role: 'Staff' } });
    log(`Staff rows updated: ${staff.modifiedCount}, user rows updated: ${users.modifiedCount}`);
    return `staff ${staff.modifiedCount}, users ${users.modifiedCount}`;
  },
};

/**
 * Brings the ledger into agreement with itself before the yard is rebuilt from it:
 * - drops the orphan "Phase2 bridge test" stock movement and reverses its stock effect (Safety Helmet back to 86);
 * - records the stock-out for any invoice whose lines never got one (INV-008 in the seed data);
 * - Keychron's stock (0) contradicts its movement chain and the 2 units received on ORD-10503;
 * - aligns ORD-1104 with the single unit invoiced on INV-003;
 * - books the missing Payment + Account CREDIT for INV-009.
 */
const ledgerReconciliation: Migration = {
  id: '2026-10-003',
  name: 'Ledger reconciliation (orphan movement, INV-003/ORD-1104, INV-009 payment, stock-outs)',
  async up(log) {
    await ensureYardProducts();
    const notes: string[] = [];

    // 1. Orphan movement.
    const orphans = await StockMovement.find({ $or: [{ reason: /phase\s*2 bridge test/i }, { shipmentCode: 'SHP-21055' }] });
    for (const movement of orphans) {
      const product = await Product.findById(movement.productId);
      if (product) {
        const delta = movement.type === 'IN' ? -movement.quantity : movement.type === 'OUT' ? movement.quantity : 0;
        const before = product.currentStock;
        product.currentStock = Math.max(0, before + delta);
        await product.save();
        log(`${product.sku}: removed orphan movement "${movement.reason}", stock ${before} -> ${product.currentStock}`);
      }
      await movement.deleteOne();
    }
    notes.push(`${orphans.length} orphan movement(s) removed`);

    // 2. Invoices that never deducted stock.
    const sales = await Sale.find({ status: { $ne: 'CANCELLED' } }).sort({ createdAt: 1 });
    let backfilled = 0;
    for (const sale of sales) {
      for (const item of sale.items) {
        const recorded = await StockMovement.exists({
          productId: item.productRef,
          type: 'OUT',
          reason: new RegExp(`Sale #${escapeRegex(sale.invoiceNumber)}(?!\\d)`),
        });
        if (recorded) continue;
        const product = await Product.findById(item.productRef);
        if (!product || product.currentStock < item.qty) {
          log(`${sale.invoiceNumber}: cannot deduct ${item.qty} x ${product?.sku ?? 'unknown product'} (not enough stock) - left as is`);
          continue;
        }
        const previousStock = product.currentStock;
        product.currentStock = previousStock - item.qty;
        await product.save();
        await StockMovement.create({
          productId: product._id,
          quantity: item.qty,
          type: 'OUT',
          reason: `Sale #${sale.invoiceNumber}`,
          previousStock,
          newStock: product.currentStock,
          handledBy: sale.createdBy,
          createdAt: sale.createdAt,
          updatedAt: sale.createdAt,
        });
        backfilled += 1;
        log(`${sale.invoiceNumber}: stock-out recorded for ${product.sku} x ${item.qty} (${previousStock} -> ${product.currentStock})`);
      }
    }
    notes.push(`${backfilled} missing stock-out(s) recorded`);

    // 3. Keychron: received 2 on ORD-10503, never sold, but the stock figure says 0.
    const keychron = await Product.findOne({ sku: 'KB-KCH-Q1M' });
    if (keychron && keychron.currentStock === 0) {
      const receipt = await StockMovement.findOne({ productId: keychron._id, type: 'IN', newStock: { $gt: 0 } }).sort({ newStock: -1 });
      if (receipt) {
        log(`KB-KCH-Q1M: stock 0 -> ${receipt.newStock} (matches its "${receipt.reason}" movement)`);
        keychron.currentStock = receipt.newStock;
        await keychron.save();
        notes.push(`Keychron stock corrected to ${receipt.newStock}`);
      }
    }

    // 4. ORD-1104 orders 2 units of the Odyssey, INV-003 invoiced (and shipped) 1.
    const order = await Order.findOne({ orderNumber: 'ORD-1104', kind: 'SALE' });
    const invoice = await Sale.findOne({ invoiceNumber: 'INV-003' });
    if (order && invoice) {
      const item = order.items.find((entry) => invoice.items.some((line) => String(line.productRef) === String(entry.productId)));
      const line = item && invoice.items.find((entry) => String(entry.productRef) === String(item.productId));
      if (item && line && (item.quantity !== line.qty || item.received !== line.qty)) {
        log(`ORD-1104: quantity ${item.quantity}/received ${item.received} -> ${line.qty}/${line.qty} to match INV-003`);
        item.quantity = line.qty;
        item.received = line.qty;
        order.totalAmount = order.items.reduce((sum, entry) => sum + entry.quantity * entry.unitPrice, 0);
        order.status = order.items.every((entry) => entry.received >= entry.quantity) ? 'COMPLETE' : 'PARTIAL';
        await order.save();
        notes.push('ORD-1104 aligned with INV-003');
      }
    }

    // 5. INV-009 payment + ledger credit.
    const inv9 = await Sale.findOne({ invoiceNumber: 'INV-009' });
    if (inv9 && !(await Payment.exists({ saleRef: inv9._id }))) {
      const paidAt = new Date(inv9.createdAt.getTime() + 5 * 60_000);
      const paymentId = nextId('PAY', (await Payment.find().select('paymentId').lean()).map((row) => row.paymentId), 3305);
      await Payment.create({ paymentId, saleRef: inv9._id as Types.ObjectId, amount: inv9.totalAmount, paymentMethod: 'CARD', status: 'COMPLETED', paymentDate: paidAt });
      if (!(await Account.exists({ saleRef: inv9._id }))) {
        const transactionId = nextId('TXN', (await Account.find().select('transactionId').lean()).map((row) => row.transactionId), 8844);
        await Account.create({
          transactionId,
          type: 'CREDIT',
          amount: inv9.totalAmount,
          date: paidAt,
          description: 'Payment received for Sale #INV-009',
          saleRef: inv9._id as Types.ObjectId,
        });
      }
      log(`INV-009: payment ${paymentId} and CREDIT entry recorded`);
      notes.push('INV-009 payment + account credit added');
    }

    return notes.join('; ');
  },
};

/**
 * Rebuilds the yard layer from the ledger: unit-exact pallets for all products across the five sites, one shipment per
 * invoice and purchase order, trucks and docks to match. Movement -> shipment links are re-derived at the same time.
 * Safe to retry: it wipes and rebuilds the facility collections as a whole.
 */
const yardWorkflow: Migration = {
  id: '2026-10-004',
  name: 'Yard workflow v2 (ledger-linked shipments, unit-exact racks)',
  async up(log) {
    await StockMovement.updateMany({}, { $unset: { siteCode: '', shipmentCode: '', truckCode: '' } });

    // Early demo movements carried a "Loading TRK-204 · SHP-20931" label for shipments that no longer exist.
    const labelled = await StockMovement.find({ reason: /^(Loading|Unloading) TRK-\d+ · SHP-\d+/ });
    for (const movement of labelled) {
      movement.reason = movement.type === 'OUT' ? 'Outbound dispatch' : 'Inbound receipt';
      await movement.save();
    }
    if (labelled.length > 0) log(`${labelled.length} legacy movement label(s) cleaned`);

    await withYardLock(() => seedFacilityData({ reset: true }));
    return 'Facility layer rebuilt from the ledger';
  },
};

export const MIGRATIONS: Migration[] = [workspaceProfiles, normalizeRoles, ledgerReconciliation, yardWorkflow];
