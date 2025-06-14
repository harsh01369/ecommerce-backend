import express from 'express';
import {
    createOrder,
    handleStripeWebhook,
    getUserOrders,
    getOrderBySession,
    cancelOrder,
    getAllOrders,
    updateOrder,
    deleteOrder,
    getOrderById,
    markOrderDelivered,
    moveOrdersToSales,
} from '../controllers/orderController.js';
import { protect, protectAdminSession } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public routes
router.post('/', protect, createOrder);
router.get('/session/:sessionId', getOrderBySession);
router.post('/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);

// Protected routes (authenticated users)
router.get('/myorders', protect, getUserOrders);
router.delete('/:id', protect, cancelOrder);

// Admin routes
router.get('/', protectAdminSession, getAllOrders);
router.get('/isPaid=true', protectAdminSession, (req, res) => {
    // Placeholder to handle the query parameter correctly
    // Replace with actual logic from getAllOrders or a new controller
    getAllOrders(req, res); // Reuse getAllOrders logic for now
});
router.put('/move-to-sales', protectAdminSession, moveOrdersToSales);
router.put('/:id', protectAdminSession, updateOrder);
router.delete('/:id', protectAdminSession, deleteOrder);
router.get('/:id', protect, getOrderById);
router.put('/:id/delivered', protectAdminSession, markOrderDelivered);

export default router;