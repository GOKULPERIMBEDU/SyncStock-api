import { Router } from 'express';
import { protect } from '../middleware/auth';
import accountRoutes from './account.routes';
import authRoutes from './auth.routes';
import customerRoutes from './customer.routes';
import dashboardRoutes from './dashboard.routes';
import movementRoutes from './movement.routes';
import notificationRoutes from './notification.routes';
import orderRoutes from './order.routes';
import paymentRoutes from './payment.routes';
import productRoutes from './product.routes';
import saleRoutes from './sale.routes';
import settingRoutes from './setting.routes';
import staffRoutes from './staff.routes';
import stockRoutes from './stock.routes';
import warehouseRoutes from './warehouse.routes';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', service: 'syncstock-api' } });
});

router.use('/auth', authRoutes);

router.use(protect);
router.use('/products', productRoutes);
router.use('/stock', stockRoutes);
router.use('/movements', movementRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/staff', staffRoutes);
router.use('/orders', orderRoutes);
router.use('/payments', paymentRoutes);
router.use('/accounts', accountRoutes);
router.use('/customers', customerRoutes);
router.use('/sales', saleRoutes);
router.use('/notifications', notificationRoutes);
router.use('/settings', settingRoutes);
router.use('/warehouse', warehouseRoutes);

export default router;
