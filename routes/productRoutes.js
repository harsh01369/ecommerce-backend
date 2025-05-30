import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
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

// Multer setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const serialNumber = req.body.serialNumber || 'temp';
        const dir = path.join('Uploads', serialNumber);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    },
});

const fileFilter = (req, file, cb) => {
    const fileTypes = /jpeg|jpg|png/;
    const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = fileTypes.test(file.mimetype);
    if (extname && mimetype) {
        cb(null, true);
    } else {
        cb(new Error('Only JPEG/PNG images are allowed'), false);
    }
};

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter,
}).array('images', 10);

router.route('/')
    .get(getProducts)
    .post(protectAdminSession, upload, createProduct);

router.route('/admin')
    .get(protectAdminSession, getAllProducts);

router.route('/:id')
    .get(getProductById)
    .put(protectAdminSession, upload, updateProduct)
    .delete(protectAdminSession, deleteProduct);

export default router;