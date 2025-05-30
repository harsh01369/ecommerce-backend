import asyncHandler from 'express-async-handler';
import winston from 'winston';
import User from '../models/userModel.js';
import Order from '../models/orderModel.js';
import Product from '../models/productModel.js';

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' }),
        new winston.transports.Console(),
    ],
});

const getDashboardMetrics = asyncHandler(async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const totalOrders = await Order.countDocuments();
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const newUsers = await User.countDocuments({ createdAt: { $gte: sevenDaysAgo } });

        const response = { totalUsers, totalOrders, newUsers };
        logger.info('Dashboard metrics fetched', { metrics: response });
        res.json(response);
    } catch (err) {
        logger.error('Error in getDashboardMetrics', { error: err.message, stack: err.stack });
        throw err;
    }
});

const getRecentOrders = asyncHandler(async (req, res) => {
    try {
        const orders = await Order.find({})
            .populate('user', 'email')
            .sort({ createdAt: -1 })
            .limit(5);
        logger.info('Recent orders fetched', { count: orders.length });
        res.json(orders);
    } catch (err) {
        logger.error('Error in getRecentOrders', { error: err.message, stack: err.stack });
        throw err;
    }
});

const getRecentUsers = asyncHandler(async (req, res) => {
    try {
        const users = await User.find({})
            .select('firstName lastName email createdAt')
            .sort({ createdAt: -1 })
            .limit(5);
        logger.info('Recent users fetched', { count: users.length });
        res.json(users);
    } catch (err) {
        logger.error('Error in getRecentUsers', { error: err.message, stack: err.stack });
        throw err;
    }
});

const getLowStockProducts = asyncHandler(async (req, res) => {
    try {
        const products = await Product.find({ stock: { $lte: 10 } })
            .select('name stock')
            .limit(5);
        logger.info('Low stock products fetched', { count: products.length });
        res.json(products);
    } catch (err) {
        logger.error('Error in getLowStockProducts', { error: err.message, stack: err.stack });
        throw err;
    }
});

export { getDashboardMetrics, getRecentOrders, getRecentUsers, getLowStockProducts };