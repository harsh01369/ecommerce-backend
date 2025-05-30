import jwt from 'jsonwebtoken';
import asyncHandler from 'express-async-handler';
import User from '../models/userModel.js';

const protect = asyncHandler(async (req, res, next) => {
    let token;

    // Check for Bearer token in Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        console.error('Authentication failed: No token provided', {
            method: req.method,
            url: req.url,
        });
        res.status(401);
        throw new Error('Not authorized, no token');
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = await User.findById(decoded.id).select('-password');
        if (!req.user) {
            console.error(`Authentication failed: User not found for ID ${decoded.id}`, {
                method: req.method,
                url: req.url,
            });
            res.status(401);
            throw new Error('Not authorized, user not found');
        }
        next();
    } catch (error) {
        console.error('Authentication failed: Invalid token', {
            message: error.message,
            method: req.method,
            url: req.url,
        });
        res.status(401);
        throw new Error('Not authorized, token failed');
    }
});

const protectAdmin = asyncHandler(async (req, res, next) => {
    if (req.user && req.user.isAdmin) {
        next();
    } else {
        console.error('Admin access denied', {
            userId: req.user ? req.user._id : 'unknown',
            method: req.method,
            url: req.url,
        });
        res.status(403);
        throw new Error('Not authorized as an admin');
    }
});

const protectAdminSession = asyncHandler(async (req, res, next) => {
    if (req.session && req.session.isAdmin) {
        console.log('Admin session verified', {
            sessionId: req.session.id,
            method: req.method,
            url: req.url,
        });
        next();
    } else {
        console.error('Admin session access denied', {
            sessionId: req.session?.id || 'none',
            method: req.method,

            url: req.url,
        });
        res.status(403);
        throw new Error('Not authorized as an admin');
    }
});

export { protect, protectAdmin, protectAdminSession };