import express from 'express';
import {
    registerUser,
    loginUser,
    logoutUser,
    getUserProfile,
    updateUserProfile,
    addUserAddress,
    deleteUserAddress,
    updateUserCart,
    updateUserWishlist,
    resendVerification,
    sendWelcomeEmail,
    sendEmailChangeConfirmation,
    getAllUsers,
    getUserById,
    updateUserById,
    deleteUserById,
    getUserOrders,
    forgotPassword,
    resetPassword,
} from '../controllers/userController.js';
import { protect, protectAdminSession } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public Routes
router.post('/signup', registerUser);
router.post('/login', loginUser);
router.post('/logout', logoutUser);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Protected Routes (Authenticated Users, JWT-based)
router.get('/profile', protect, getUserProfile);
router.put('/profile', protect, updateUserProfile);
router.post('/addresses', protect, addUserAddress);
router.delete('/addresses/:index', protect, deleteUserAddress);
router.put('/cart', protect, updateUserCart);
router.put('/wishlist', protect, updateUserWishlist);
router.post('/resend-verification', protect, resendVerification);
router.post('/send-welcome-email', protect, sendWelcomeEmail);
router.post('/send-email-change-confirmation', protect, sendEmailChangeConfirmation);
router.get('/orders', protect, getUserOrders);

// Admin Routes (Session-based)
router.get('/', protectAdminSession, getAllUsers);
router.get('/:id', protectAdminSession, getUserById);
router.put('/:id', protectAdminSession, updateUserById);
router.delete('/:id', protectAdminSession, deleteUserById);

export default router;