import express from 'express';
import { protectAdminSession } from '../middleware/authMiddleware.js';
import { getDashboardMetrics, getRecentOrders, getRecentUsers, getLowStockProducts } from '../controllers/adminController.js';

const router = express.Router();

router.get('/metrics', protectAdminSession, getDashboardMetrics);
router.get('/recent-orders', protectAdminSession, getRecentOrders);
router.get('/recent-users', protectAdminSession, getRecentUsers);
router.get('/low-stock', protectAdminSession, getLowStockProducts);

export default router;