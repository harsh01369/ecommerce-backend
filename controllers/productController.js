import asyncHandler from 'express-async-handler';
import Product from '../models/productModel.js';
import fs from 'fs';
import path from 'path';
import winston from 'winston';

// Logger setup
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

// @desc    Get all products
// @route   GET /api/products
// @access  Public
const getProducts = asyncHandler(async (req, res) => {
    const products = await Product.find({ onOff: true });
    logger.info('Public products retrieved', { count: products.length });
    res.json(products);
});

// @desc    Get all products for admin
// @route   GET /api/products/admin
// @access  Private/Admin
const getAllProducts = asyncHandler(async (req, res) => {
    const products = await Product.find();
    logger.info('Admin products retrieved', { count: products.length, sessionId: req.session.id });
    res.json(products);
});

// @desc    Create a product
// @route   POST /api/products
// @access  Private/Admin
const createProduct = asyncHandler(async (req, res) => {
    const {
        name, price, description, productCategory, interestCategory,
        genderCategory, saleCategory, isNewArrival, countInStock, size, onOff, serialNumber
    } = req.body;

    // Check for duplicate serial number
    const existingProduct = await Product.findOne({ serialNumber });
    if (existingProduct) {
        logger.warn('Duplicate serial number', { serialNumber, sessionId: req.session.id });
        res.status(400);
        throw new Error('Serial number already exists');
    }

    // Convert size to array if it's not already
    const sizes = Array.isArray(size) ? size : JSON.parse(size || '[]');

    // Handle images
    const images = req.files ? req.files.map(file => `/uploads/${serialNumber}/${file.filename}`) : [];

    const product = new Product({
        name,
        price: parseFloat(price),
        description,
        productCategory,
        interestCategory,
        genderCategory,
        saleCategory,
        isNewArrival: isNewArrival === 'true',
        isOnSale: req.body.isOnSale === 'true',
        countInStock: parseInt(countInStock),
        size: sizes,
        onOff: onOff === 'true',
        serialNumber,
        images,
    });

    const createdProduct = await product.save();
    logger.info('Product created', { productId: createdProduct._id, sessionId: req.session.id });
    res.status(201).json(createdProduct);
});

// @desc    Update a product
// @route   PUT /api/products/:id
// @access  Private/Admin
const updateProduct = asyncHandler(async (req, res) => {
    const {
        name, price, description, productCategory, interestCategory,
        genderCategory, saleCategory, isNewArrival, isOnSale, countInStock, size, onOff, serialNumber, existingImages
    } = req.body;

    const product = await Product.findById(req.params.id);
    if (!product) {
        logger.warn('Product not found', { productId: req.params.id, sessionId: req.session.id });
        res.status(404);
        throw new Error('Product not found');
    }

    // Convert size to array if it's not already
    const sizes = Array.isArray(size) ? size : JSON.parse(size || '[]');

    // Handle images
    const newImages = req.files ? req.files.map(file => `/uploads/${serialNumber}/${file.filename}`) : [];
    const updatedImages = existingImages ? [...JSON.parse(existingImages || '[]'), ...newImages] : [...product.images, ...newImages];

    product.name = name || product.name;
    product.price = price ? parseFloat(price) : product.price;
    product.description = description || product.description;
    product.productCategory = productCategory || product.productCategory;
    product.interestCategory = interestCategory || product.interestCategory;
    product.genderCategory = genderCategory || product.genderCategory;
    product.saleCategory = saleCategory || product.saleCategory;
    product.isNewArrival = isNewArrival === 'true';
    product.isOnSale = isOnSale === 'true';
    product.countInStock = countInStock ? parseInt(countInStock) : product.countInStock;
    product.size = sizes;
    product.onOff = onOff === 'true';
    product.serialNumber = serialNumber || product.serialNumber;
    product.images = updatedImages;

    const updatedProduct = await product.save();
    logger.info('Product updated', { productId: updatedProduct._id, sessionId: req.session.id });
    res.json(updatedProduct);
});

// @desc    Get product by ID
// @route   GET /api/products/:id
// @access  Public
const getProductById = asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id);
    if (product) {
        res.json(product);
    } else {
        logger.warn('Product not found', { productId: req.params.id });
        res.status(404);
        throw new Error('Product not found');
    }
});

// @desc    Delete a product
// @route   DELETE /api/products/:id
// @access  Private/Admin
const deleteProduct = asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id);
    if (product) {
        product.images.forEach(image => {
            const imagePath = path.join(__dirname, '..', image);
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
        });
        await product.remove();
        logger.info('Product deleted', { productId: req.params.id, sessionId: req.session.id });
        res.json({ message: 'Product removed' });
    } else {
        logger.warn('Product not found', { productId: req.params.id, sessionId: req.session.id });
        res.status(404);
        throw new Error('Product not found');
    }
});

export { getProducts, getAllProducts, createProduct, updateProduct, getProductById, deleteProduct };