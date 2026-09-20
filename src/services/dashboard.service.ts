import { accountRepository } from '../repositories/account.repository';
import { orderRepository } from '../repositories/order.repository';
import { paymentRepository } from '../repositories/payment.repository';
import { productRepository } from '../repositories/product.repository';
import { saleRepository } from '../repositories/sale.repository';
import { staffRepository } from '../repositories/staff.repository';
import { stockMovementRepository } from '../repositories/stockMovement.repository';
import { userRepository } from '../repositories/user.repository';

export class DashboardService {
  async getSummary() {
    const [totals, outOfStock, lowStock, recentMovements, pendingOrders, completedSales, staffResult, payments, accounts] =
      await Promise.all([
        productRepository.aggregateStockValue(),
        productRepository.findOutOfStock(),
        productRepository.findLowStock(),
        stockMovementRepository.findRecent({ limit: 8 }),
        orderRepository.countByStatus('PENDING'),
        saleRepository.sumCompleted(),
        Promise.all([staffRepository.countActive(), userRepository.findAll()]),
        paymentRepository.findAll(),
        accountRepository.findAll(),
      ]);

    const inStock = Math.max(totals.totalProducts - outOfStock.length - lowStock.length, 0);

    return {
      totalProducts: totals.totalProducts,
      totalStockValue: totals.totalStockValue,
      outOfStockCount: outOfStock.length,
      lowStockCount: lowStock.length,
      inStockCount: inStock,
      pendingOrders,
      completedSales,
      activeStaff: staffResult[0] + staffResult[1].length,
      outOfStock,
      lowStock,
      recentMovements,
      recentPayments: payments.slice(0, 5),
      recentAccounts: accounts.slice(0, 5),
    };
  }
}

export const dashboardService = new DashboardService();
