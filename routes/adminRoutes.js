import express from 'express';
import { protectAdminSession } from '../middleware/authMiddleware.js';
import {
    getDashboardMetrics,
    getRecentOrders,
    getRecentUsers,
    getLowStockProducts,
} from '../controllers/adminController.js';

const router = express.Router();

// Admin Session Protected Routes
router.get('/metrics', protectAdminSession, getDashboardMetrics);
router.get('/recent-orders', protectAdminSession, getRecentOrders);
router.get('/recent-users', protectAdminSession, getRecentUsers);
router.get('/low-stock', protectAdminSession, getLowStockProducts);

// Admin Authentication Routes
router.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (username === process.env.REACT_APP_ADMIN_USERNAME && password === process.env.REACT_APP_ADMIN_PASSWORD) {
        req.session.isAdmin = true;
        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
                return res.status(500).json({ message: 'Session error' });
            }
            res.cookie('connect.sid', req.session.id, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production' ? true : false,
                sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
                maxAge: 24 * 60 * 60 * 1000,
            });
            console.log('Admin session created:', { sessionId: req.session.id });
            return res.status(200).json({ message: 'Admin logged in', isAdmin: true });
        });
    } else {
        console.warn('Admin login failed: Invalid credentials');
        return res.status(401).json({ message: 'Invalid admin credentials' });
    }
});

router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Session destroy error:', err);
            return res.status(500).json({ message: 'Logout failed' });
        }
        res.clearCookie('connect.sid', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production' ? true : false,
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        });
        console.log('Admin logged out');
        res.status(200).json({ message: 'Admin logged out' });
    });
});

router.get('/checkAuth', (req, res) => {
    if (req.session && req.session.isAdmin) {
        console.log('Admin auth check: Authenticated', { sessionId: req.session.id });
        return res.json({ isAdmin: true });
    }
    console.warn('Admin auth check: Not authenticated');
    res.status(401).json({ message: 'Not authenticated' });
});

export default router;