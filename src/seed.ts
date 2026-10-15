import bcrypt from 'bcryptjs';
import mongoose, { Types } from 'mongoose';
import { assertRequiredEnv, env } from './config/env';
import { Account } from './models/Account';
import { Customer } from './models/Customer';
import { Notification } from './models/Notification';
import { Order } from './models/Order';
import { Payment } from './models/Payment';
import { Product } from './models/Product.model';
import { Sale } from './models/Sale';
import { Staff } from './models/Staff';
import { MigrationRecord } from './models/MigrationRecord';
import { StockMovement } from './models/StockMovement.model';
import { SystemSetting } from './models/SystemSetting';
import { User } from './models/User';
import { runMigrations } from './migrations/runner';

function id(): Types.ObjectId {
  return new Types.ObjectId();
}

async function hash(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

function inr(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

function lineTotal(items: Array<{ qty?: number; quantity?: number; price?: number; unitPrice?: number }>): number {
  return items.reduce((sum, item) => sum + (item.qty ?? item.quantity ?? 0) * (item.price ?? item.unitPrice ?? 0), 0);
}

async function seed(): Promise<void> {
  assertRequiredEnv();
  await mongoose.connect(env.mongodbUri);
  console.log('[seed] Connected to MongoDB');

  await Promise.all([
    User.deleteMany({}),
    Customer.deleteMany({}),
    Sale.deleteMany({}),
    Notification.deleteMany({}),
    SystemSetting.deleteMany({}),
    Staff.deleteMany({}),
    Product.deleteMany({}),
    Order.deleteMany({}),
    Payment.deleteMany({}),
    Account.deleteMany({}),
    StockMovement.deleteMany({}),
    MigrationRecord.deleteMany({}),
  ]);
  console.log('[seed] Cleared all collections');

  const adminId = id();
  const managerId = id();
  const staffId = id();

  await User.insertMany([
    {
      _id: adminId,
      name: 'Perimbedu Gokul',
      email: 'gokulperimbedu@gmail.com',
      password: await hash('Admin@12345'),
      role: 'Admin',
    },
    {
      _id: managerId,
      name: 'Arun',
      email: 'arun@syncstock.io',
      password: await hash('Manager@12345'),
      role: 'Manager',
    },
    {
      _id: staffId,
      name: 'Karthik',
      email: 'karthik@syncstock.io',
      password: await hash('Staff@12345'),
      role: 'Staff',
    },
  ]);

  const staffIds = [id(), id(), id(), id(), id()];
  await Staff.insertMany([
    { _id: staffIds[0], name: 'Perimbedu Gokul', email: 'gokulperimbedu@gmail.com', role: 'Admin', status: 'Active', joinedDate: new Date('2024-01-12') },
    { _id: staffIds[1], name: 'Arun', email: 'arun@syncstock.io', role: 'Manager', status: 'Active', joinedDate: new Date('2024-03-04') },
    { _id: staffIds[2], name: 'Priya Sharma', email: 'priya.sharma@syncstock.io', role: 'Manager', status: 'Active', joinedDate: new Date('2024-06-18') },
    { _id: staffIds[3], name: 'Karthik', email: 'karthik@syncstock.io', role: 'Staff', status: 'Active', joinedDate: new Date('2025-02-09') },
    { _id: staffIds[4], name: 'Meera Iyer', email: 'meera.iyer@syncstock.io', role: 'Staff', status: 'Inactive', joinedDate: new Date('2023-11-21') },
  ]);

  const productIds = Array.from({ length: 15 }, id);
  const products = [
    { name: 'Arzopa Portable Monitor 16.1"', sku: 'DSP-ARZ-161', category: 'Displays', price: 12500, currentStock: 42, lowStockThreshold: 12 },
    { name: 'ASUS ROG Swift 27" 240Hz', sku: 'DSP-ROG-27Q', category: 'Displays', price: 42990, currentStock: 8, lowStockThreshold: 10 },
    { name: 'Samsung Odyssey G8 OLED', sku: 'DSP-SAM-G8', category: 'Displays', price: 79990, currentStock: 3, lowStockThreshold: 5 },
    { name: 'LG UltraFine 5K 27"', sku: 'DSP-LG-5K27', category: 'Displays', price: 89990, currentStock: 6, lowStockThreshold: 3 },
    { name: 'Keychron Q1 Max Mechanical', sku: 'KB-KCH-Q1M', category: 'Peripherals', price: 4500, currentStock: 0, lowStockThreshold: 6 },
    { name: 'HHKB Professional Hybrid', sku: 'KB-HHKB-HYB', category: 'Peripherals', price: 19990, currentStock: 11, lowStockThreshold: 4 },
    { name: 'Logitech MX Master 3S', sku: 'PER-LOG-MX3S', category: 'Peripherals', price: 8490, currentStock: 64, lowStockThreshold: 15 },
    { name: 'Logitech MX Keys S', sku: 'PER-LOG-MXKS', category: 'Peripherals', price: 9990, currentStock: 27, lowStockThreshold: 8 },
    { name: 'Framework Laptop 16 Mainboard', sku: 'MB-FWK-16-7840', category: 'Components', price: 85000, currentStock: 5, lowStockThreshold: 4 },
    { name: 'Framework 2.8K Display Module', sku: 'MB-FWK-DSP', category: 'Components', price: 28990, currentStock: 9, lowStockThreshold: 4 },
    { name: 'Corsair Vengeance 64GB DDR5', sku: 'RAM-COR-64D5', category: 'Components', price: 18500, currentStock: 31, lowStockThreshold: 8 },
    { name: 'Samsung 990 Pro 2TB NVMe', sku: 'SSD-SAM-990P', category: 'Components', price: 14500, currentStock: 22, lowStockThreshold: 10 },
    { name: 'CalDigit TS4 Thunderbolt Dock', sku: 'DOCK-CAL-TS4', category: 'Peripherals', price: 27990, currentStock: 7, lowStockThreshold: 3 },
    { name: 'Anker 747 GaNPrime 150W', sku: 'PWR-ANK-747', category: 'Peripherals', price: 7490, currentStock: 18, lowStockThreshold: 6 },
    { name: 'Sony WH-1000XM5', sku: 'AUD-SNY-XM5', category: 'Peripherals', price: 26990, currentStock: 14, lowStockThreshold: 5 },
  ].map((product, index) => ({ _id: productIds[index], ...product }));

  await Product.insertMany(products);
  const price = products.map((product) => product.price);

  const customerIds = Array.from({ length: 8 }, id);
  await Customer.insertMany([
    { _id: customerIds[0], name: 'Rajesh Kumar', email: 'rajesh.kumar@balajielectronics.in', phone: '+91-98410-11223', address: 'T Nagar, Chennai' },
    { _id: customerIds[1], name: 'Priya Sharma', email: 'priya.sharma@technova.in', phone: '+91-98200-44556', address: 'Andheri West, Mumbai' },
    { _id: customerIds[2], name: 'TechNova India Pvt Ltd', email: 'purchase@technova.in', phone: '+91-80-4123-7788', address: 'Koramangala, Bengaluru' },
    { _id: customerIds[3], name: 'Balaji Electronics', email: 'sales@balajielectronics.in', phone: '+91-44-2461-3300', address: 'Mount Road, Chennai' },
    { _id: customerIds[4], name: 'Ananya Reddy', email: 'ananya.reddy@hyderabadtech.in', phone: '+91-90000-22110', address: 'HITEC City, Hyderabad' },
    { _id: customerIds[5], name: 'Vikram Singh', email: 'vikram.singh@punjabretail.in', phone: '+91-98140-55667', address: 'Sector 17, Chandigarh' },
    { _id: customerIds[6], name: 'Meera Nair', email: 'meera.nair@kochiit.in', phone: '+91-484-2661-220', address: 'Infopark, Kochi' },
    { _id: customerIds[7], name: 'Suresh Patel', email: 'suresh.patel@gujarattrade.in', phone: '+91-79-2658-4411', address: 'CG Road, Ahmedabad' },
  ]);

  const saleIds = Array.from({ length: 8 }, id);
  const sales = [
    {
      _id: saleIds[0],
      invoiceNumber: 'INV-001',
      customerRef: customerIds[0],
      items: [
        { productRef: productIds[0], qty: 6, price: price[0] },
        { productRef: productIds[6], qty: 4, price: price[6] },
      ],
      status: 'COMPLETE',
      createdBy: managerId,
      createdAt: new Date('2026-09-12T15:00:00.000Z'),
    },
    {
      _id: saleIds[1],
      invoiceNumber: 'INV-002',
      customerRef: customerIds[1],
      items: [{ productRef: productIds[5], qty: 2, price: price[5] }],
      status: 'COMPLETE',
      createdBy: staffId,
      createdAt: new Date('2026-09-14T11:20:00.000Z'),
    },
    {
      _id: saleIds[2],
      invoiceNumber: 'INV-003',
      customerRef: customerIds[2],
      items: [{ productRef: productIds[2], qty: 1, price: price[2] }],
      status: 'COMPLETE',
      createdBy: adminId,
      createdAt: new Date('2026-09-16T09:12:00.000Z'),
    },
    {
      _id: saleIds[3],
      invoiceNumber: 'INV-004',
      customerRef: customerIds[3],
      items: [{ productRef: productIds[7], qty: 4, price: price[7] }],
      status: 'COMPLETE',
      createdBy: managerId,
      createdAt: new Date('2026-09-17T12:40:00.000Z'),
    },
    {
      _id: saleIds[4],
      invoiceNumber: 'INV-005',
      customerRef: customerIds[4],
      items: [
        { productRef: productIds[8], qty: 1, price: price[8] },
        { productRef: productIds[11], qty: 2, price: price[11] },
      ],
      status: 'COMPLETE',
      createdBy: adminId,
      createdAt: new Date('2026-09-18T10:05:00.000Z'),
    },
    {
      _id: saleIds[5],
      invoiceNumber: 'INV-006',
      customerRef: customerIds[5],
      items: [{ productRef: productIds[14], qty: 3, price: price[14] }],
      status: 'COMPLETE',
      createdBy: staffId,
      createdAt: new Date('2026-09-18T16:30:00.000Z'),
    },
    {
      _id: saleIds[6],
      invoiceNumber: 'INV-007',
      customerRef: customerIds[6],
      items: [{ productRef: productIds[12], qty: 2, price: price[12] }],
      status: 'COMPLETE',
      createdBy: managerId,
      createdAt: new Date('2026-09-19T13:18:00.000Z'),
    },
    {
      _id: saleIds[7],
      invoiceNumber: 'INV-008',
      customerRef: customerIds[7],
      items: [
        { productRef: productIds[1], qty: 1, price: price[1] },
        { productRef: productIds[13], qty: 2, price: price[13] },
      ],
      status: 'PENDING',
      createdBy: staffId,
      createdAt: new Date('2026-09-20T08:45:00.000Z'),
    },
  ].map((sale) => ({ ...sale, totalAmount: lineTotal(sale.items) }));

  await Sale.insertMany(sales);

  const orderIds = Array.from({ length: 10 }, id);
  const orders = [
    { _id: orderIds[0], orderNumber: 'ORD-10482', partyName: 'Croma Wholesale', kind: 'PURCHASE', status: 'COMPLETE', emailSent: true, items: [{ productId: productIds[0], quantity: 8, received: 8, unitPrice: price[0] }], createdAt: new Date('2026-09-12T09:10:00.000Z') },
    { _id: orderIds[1], orderNumber: 'ORD-10491', partyName: 'Redington India', kind: 'PURCHASE', status: 'PENDING', emailSent: false, items: [{ productId: productIds[1], quantity: 4, received: 0, unitPrice: price[1] }], createdAt: new Date('2026-09-16T14:22:00.000Z') },
    { _id: orderIds[2], orderNumber: 'ORD-10503', partyName: 'Balaji Electronics', kind: 'PURCHASE', status: 'PARTIAL', emailSent: true, items: [{ productId: productIds[4], quantity: 6, received: 2, unitPrice: price[4] }], createdAt: new Date('2026-09-17T11:04:00.000Z') },
    { _id: orderIds[3], orderNumber: 'ORD-10511', partyName: 'Ingram Micro India', kind: 'PURCHASE', status: 'PENDING', emailSent: false, items: [{ productId: productIds[6], quantity: 20, received: 0, unitPrice: price[6] }], createdAt: new Date('2026-09-18T08:40:00.000Z') },
    { _id: orderIds[4], orderNumber: 'ORD-10518', partyName: 'TechNova India Pvt Ltd', kind: 'PURCHASE', status: 'PARTIAL', emailSent: true, items: [{ productId: productIds[8], quantity: 4, received: 2, unitPrice: price[8] }], createdAt: new Date('2026-09-18T16:15:00.000Z') },
    { _id: orderIds[5], orderNumber: 'ORD-10524', partyName: 'Reliance Digital Supply', kind: 'PURCHASE', status: 'COMPLETE', emailSent: true, items: [{ productId: productIds[10], quantity: 14, received: 14, unitPrice: price[10] }], createdAt: new Date('2026-09-19T10:28:00.000Z') },
    { _id: orderIds[6], orderNumber: 'ORD-1092', partyName: 'Rajesh Kumar', kind: 'SALE', status: 'COMPLETE', emailSent: true, items: [{ productId: productIds[0], quantity: 6, received: 6, unitPrice: price[0] }, { productId: productIds[6], quantity: 4, received: 4, unitPrice: price[6] }], createdAt: new Date('2026-09-19T15:00:00.000Z') },
    { _id: orderIds[7], orderNumber: 'ORD-1098', partyName: 'Priya Sharma', kind: 'SALE', status: 'COMPLETE', emailSent: true, items: [{ productId: productIds[5], quantity: 2, received: 2, unitPrice: price[5] }], createdAt: new Date('2026-09-18T11:20:00.000Z') },
    { _id: orderIds[8], orderNumber: 'ORD-1104', partyName: 'TechNova India Pvt Ltd', kind: 'SALE', status: 'PENDING', emailSent: false, items: [{ productId: productIds[2], quantity: 2, received: 0, unitPrice: price[2] }], createdAt: new Date('2026-09-20T09:12:00.000Z') },
    { _id: orderIds[9], orderNumber: 'ORD-1110', partyName: 'Balaji Electronics', kind: 'SALE', status: 'PARTIAL', emailSent: true, items: [{ productId: productIds[7], quantity: 10, received: 4, unitPrice: price[7] }], createdAt: new Date('2026-09-20T12:40:00.000Z') },
  ].map((order) => ({ ...order, totalAmount: lineTotal(order.items) }));

  await Order.insertMany(orders);

  await Payment.insertMany([
    { paymentId: 'PAY-2201', orderRef: orderIds[0], amount: orders[0].totalAmount, paymentMethod: 'BANK', status: 'COMPLETED', paymentDate: new Date('2026-09-12T12:00:00.000Z') },
    { paymentId: 'PAY-2208', orderRef: orderIds[1], amount: orders[1].totalAmount, paymentMethod: 'CARD', status: 'PENDING', paymentDate: new Date('2026-09-16T15:00:00.000Z') },
    { paymentId: 'PAY-2214', orderRef: orderIds[2], amount: 2 * price[4], paymentMethod: 'CASH', status: 'COMPLETED', paymentDate: new Date('2026-09-17T13:10:00.000Z') },
    { paymentId: 'PAY-2220', orderRef: orderIds[4], amount: 2 * price[8], paymentMethod: 'BANK', status: 'PENDING', paymentDate: new Date('2026-09-18T17:00:00.000Z') },
    { paymentId: 'PAY-2226', orderRef: orderIds[5], amount: orders[5].totalAmount, paymentMethod: 'BANK', status: 'COMPLETED', paymentDate: new Date('2026-09-19T11:00:00.000Z') },
    { paymentId: 'PAY-3301', saleRef: saleIds[0], amount: sales[0].totalAmount, paymentMethod: 'CARD', status: 'COMPLETED', paymentDate: new Date('2026-09-12T16:10:00.000Z') },
    { paymentId: 'PAY-3302', saleRef: saleIds[1], amount: sales[1].totalAmount, paymentMethod: 'CASH', status: 'COMPLETED', paymentDate: new Date('2026-09-14T12:05:00.000Z') },
    { paymentId: 'PAY-3303', saleRef: saleIds[2], amount: sales[2].totalAmount, paymentMethod: 'CARD', status: 'COMPLETED', paymentDate: new Date('2026-09-16T10:00:00.000Z') },
    { paymentId: 'PAY-3304', saleRef: saleIds[4], amount: sales[4].totalAmount, paymentMethod: 'BANK', status: 'COMPLETED', paymentDate: new Date('2026-09-18T11:20:00.000Z') },
    { paymentId: 'PAY-3305', saleRef: saleIds[7], amount: sales[7].totalAmount, paymentMethod: 'CARD', status: 'PENDING', paymentDate: new Date('2026-09-20T09:00:00.000Z') },
  ]);

  await Account.insertMany([
    { transactionId: 'TXN-8801', type: 'DEBIT', amount: orders[0].totalAmount, date: new Date('2026-09-12T12:00:00.000Z'), description: 'Payment for Order #ORD-10482', orderRef: orderIds[0] },
    { transactionId: 'TXN-8808', type: 'DEBIT', amount: 2 * price[4], date: new Date('2026-09-17T13:10:00.000Z'), description: 'Partial payment for Order #ORD-10503', orderRef: orderIds[2] },
    { transactionId: 'TXN-8814', type: 'DEBIT', amount: orders[5].totalAmount, date: new Date('2026-09-19T11:00:00.000Z'), description: 'Payment for Order #ORD-10524', orderRef: orderIds[5] },
    { transactionId: 'TXN-8820', type: 'CREDIT', amount: sales[0].totalAmount, date: new Date('2026-09-12T16:10:00.000Z'), description: 'Payment received for Sale #INV-001', orderRef: orderIds[6] },
    { transactionId: 'TXN-8826', type: 'CREDIT', amount: sales[1].totalAmount, date: new Date('2026-09-14T12:05:00.000Z'), description: 'Payment received for Sale #INV-002', orderRef: orderIds[7] },
    { transactionId: 'TXN-8832', type: 'DEBIT', amount: orders[1].totalAmount, date: new Date('2026-09-16T15:00:00.000Z'), description: 'Pending settlement for Order #ORD-10491', orderRef: orderIds[1] },
    { transactionId: 'TXN-8838', type: 'CREDIT', amount: sales[2].totalAmount, date: new Date('2026-09-16T10:00:00.000Z'), description: 'Payment received for Sale #INV-003', orderRef: orderIds[8] },
    { transactionId: 'TXN-8844', type: 'DEBIT', amount: 2 * price[8], date: new Date('2026-09-18T17:00:00.000Z'), description: 'Payment for Order #ORD-10518', orderRef: orderIds[4] },
  ]);

  await StockMovement.insertMany([
    { productId: productIds[0], quantity: 8, type: 'IN', reason: 'PO ORD-10482', previousStock: 40, newStock: 48, handledBy: adminId },
    { productId: productIds[0], quantity: 6, type: 'OUT', reason: 'Sale #INV-001', previousStock: 48, newStock: 42, handledBy: managerId },
    { productId: productIds[6], quantity: 4, type: 'OUT', reason: 'Sale #INV-001', previousStock: 68, newStock: 64, handledBy: managerId },
    { productId: productIds[5], quantity: 2, type: 'OUT', reason: 'Sale #INV-002', previousStock: 13, newStock: 11, handledBy: staffId },
    { productId: productIds[2], quantity: 1, type: 'OUT', reason: 'Sale #INV-003', previousStock: 4, newStock: 3, handledBy: adminId },
    { productId: productIds[7], quantity: 4, type: 'OUT', reason: 'Sale #INV-004', previousStock: 31, newStock: 27, handledBy: managerId },
    { productId: productIds[8], quantity: 1, type: 'OUT', reason: 'Sale #INV-005', previousStock: 6, newStock: 5, handledBy: adminId },
    { productId: productIds[11], quantity: 2, type: 'OUT', reason: 'Sale #INV-005', previousStock: 24, newStock: 22, handledBy: adminId },
    { productId: productIds[14], quantity: 3, type: 'OUT', reason: 'Sale #INV-006', previousStock: 17, newStock: 14, handledBy: staffId },
    { productId: productIds[12], quantity: 2, type: 'OUT', reason: 'Sale #INV-007', previousStock: 9, newStock: 7, handledBy: managerId },
    { productId: productIds[4], quantity: 2, type: 'IN', reason: 'Partial receive ORD-10503', previousStock: 0, newStock: 2, handledBy: staffId },
    { productId: productIds[8], quantity: 2, type: 'IN', reason: 'Partial receive ORD-10518', previousStock: 3, newStock: 5, handledBy: managerId },
    { productId: productIds[10], quantity: 14, type: 'IN', reason: 'PO ORD-10524', previousStock: 17, newStock: 31, handledBy: adminId },
  ]);

  await Notification.insertMany([
    { title: 'Low Stock Alert for ASUS ROG Swift 27" 240Hz', message: 'ASUS ROG Swift 27" 240Hz (DSP-ROG-27Q) is at 8 units. Threshold: 10.', isRead: false, date: new Date('2026-09-16T09:20:00.000Z') },
    { title: 'Low Stock Alert for Samsung Odyssey G8 OLED', message: 'Samsung Odyssey G8 OLED (DSP-SAM-G8) is at 3 units. Threshold: 5.', isRead: false, date: new Date('2026-09-16T09:13:00.000Z') },
    { title: 'Low Stock Alert for Keychron Q1 Max Mechanical', message: 'Keychron Q1 Max Mechanical (KB-KCH-Q1M) is at 0 units. Threshold: 6.', isRead: false, date: new Date('2026-09-17T11:10:00.000Z') },
    { title: 'Low Stock Alert for Framework Laptop 16 Mainboard', message: 'Framework Laptop 16 Mainboard (MB-FWK-16-7840) is at 5 units. Threshold: 4.', isRead: true, date: new Date('2026-09-18T10:06:00.000Z') },
    { userRef: adminId, title: 'Welcome to SyncStock', message: 'Indian warehouse demo is seeded. Invoices INV-001 through INV-008 are linked to customers, products, and users.', isRead: false, date: new Date('2026-09-20T08:00:00.000Z') },
    { userRef: managerId, title: 'Pending invoice INV-008', message: `Suresh Patel still has an unpaid card capture for ${inr(sales[7].totalAmount)}.`, isRead: false, date: new Date('2026-09-20T08:50:00.000Z') },
    { userRef: staffId, title: 'Shift reminder', message: 'Receive remaining Keychron units on ORD-10503 before close.', isRead: true, date: new Date('2026-09-19T18:00:00.000Z') },
  ]);

  // The migration runner finishes the job exactly as it does on an existing database: workspace profiles, role
  // normalisation, ledger reconciliation (INV-008 stock-out, Keychron, ORD-1104) and the ledger-linked yard layer.
  const migrations = await runMigrations();
  if (migrations.failed) throw new Error(`Migration ${migrations.failed} failed`);
  console.log(`[seed] Applied migrations: ${migrations.applied.join(', ')}`);

  console.log('[seed] Demo users:');
  console.log('  Admin   gokulperimbedu@gmail.com   Admin@12345');
  console.log('  Manager arun@syncstock.io          Manager@12345');
  console.log('  Staff   karthik@syncstock.io       Staff@12345');
  console.log('[seed] Inserted Indian customers, INR catalog, sales, payments, movements, notifications, settings');
  console.log('[seed] Linked ObjectIds: Sale.customerRef/items.productRef/createdBy, Payment.saleRef, StockMovement.handledBy');
  await mongoose.disconnect();
}

seed().catch(async (error) => {
  console.error('[seed] Failed', error);
  await mongoose.disconnect();
  process.exit(1);
});
