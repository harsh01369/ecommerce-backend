import express from 'express';
import upload from '../middleware/uploadMiddleware.js'; // Import the shared upload middleware
import { protectAdminSession } from '../middleware/authMiddleware.js';
import {
    getProducts,
    getAllProducts,
    createProduct,
    updateProduct,
    getProductById,
    deleteProduct
} from '../controllers/productController.js';

const router = express.Router();

// Routes
router.route('/')
    .get(getProducts)
    .post(protectAdminSession, upload.array('images', 10), createProduct);

router.route('/admin')
    .get(protectAdminSession, getAllProducts);

router.route('/:id')
    .get(getProductById)
    .put(protectAdminSession, upload.array('images', 10), updateProduct)
    .delete(protectAdminSession, deleteProduct);

export default router;