import express from 'express';
import {
    getCategories,
    getCategoryById,
    deleteCategory,
    createCategory,
    updateCategory,
} from '../controllers/categoryController.js';
import { protect, protectAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/').get(getCategories).post(protect, protectAdmin, createCategory);
router
    .route('/:id')
    .get(getCategoryById)
    .delete(protect, protectAdmin, deleteCategory)
    .put(protect, protectAdmin, updateCategory);

export default router;
