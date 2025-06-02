import express from 'express';
import cors from 'cors';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import winston from 'winston';
import connectDB from './config/db.js';
import userRoutes from './routes/userRoutes.js';
import productRoutes from './routes/productRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import { notFound, errorHandler } from './middleware/errorMiddleware.js';

// Resolve __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '.env') });

// Configure Winston logger
const winstonLogger = winston.createLogger({
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

// Debug environment variables
winstonLogger.info('Environment Variables Loaded:', {
    NODE_ENV: process.env.NODE_ENV,
    MONGO_URI: process.env.MONGO_URI ? 'Defined' : 'Undefined',
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ? 'Defined' : 'Undefined',
    SENDGRID_API_KEY: process.env.SENDGRID_API_KEY ? 'Defined' : 'Undefined',
    EMAIL_USER: process.env.EMAIL_USER,
    REACT_APP_ADMIN_USERNAME: process.env.REACT_APP_ADMIN_USERNAME,
    REACT_APP_ADMIN_PASSWORD: process.env.REACT_APP_ADMIN_PASSWORD ? 'Defined' : 'Undefined',
    PORT: process.env.PORT,
});

// Validate critical environment variables
const requiredEnvVars = [
    'MONGO_URI',
    'JWT_SECRET',
    'SESSION_SECRET',
    'STRIPE_SECRET_KEY',
    'SENDGRID_API_KEY',
    'EMAIL_USER',
    'REACT_APP_ADMIN_USERNAME',
    'REACT_APP_ADMIN_PASSWORD',
];
const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);
if (missingVars.length > 0) {
    winstonLogger.error('Missing required environment variables:', { missingVars });
    process.exit(1);
}

// Validate STRIPE_SECRET_KEY format
if (!process.env.STRIPE_SECRET_KEY.startsWith('sk_test_') && !process.env.STRIPE_SECRET_KEY.startsWith('rk_test_')) {
    winstonLogger.error('STRIPE_SECRET_KEY must start with "sk_test_" or "rk_test_" for test mode');
    process.exit(1);
}

// Validate SENDGRID_API_KEY format
if (!process.env.SENDGRID_API_KEY.startsWith('SG.')) {
    winstonLogger.error('SENDGRID_API_KEY must start with "SG."');
    process.exit(1);
}

// Initialize express app
const app = express();
const port = process.env.PORT || 5000;

// Enhanced CORS configuration
const corsOptions = {
    origin: [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:3002',
        'http://localhost:3005',
        'http://localhost:3006',
        'http://localhost:3004',
        'https://www.uwearuk.com',
        'https://admin.uwearuk.com',
        'https://admin-dashboard-h9cx.onrender.com',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    optionsSuccessStatus: 200, // Some legacy browsers choke on 204
};

app.use(cors(corsOptions));

// Explicit preflight handler
app.options('*', cors(corsOptions));

app.use(cookieParser());

// Webhook route (raw body for Stripe)
app.use('/api/orders/webhook', express.raw({ type: 'application/json' }));

// JSON body parser for other routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files for uploaded images
app.use('/Uploads', express.static(path.join(__dirname, 'Uploads')));

// Session configuration
app.use(
    session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        store: MongoStore.create({ mongoUrl: process.env.MONGO_URI, dbName: 'uwear' }),
        cookie: {
            secure: process.env.NODE_ENV === 'production' ? true : false,
            httpOnly: true,
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            maxAge: 24 * 60 * 60 * 1000,
        },
    })
);

// Multer storage configuration for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const productFolder = path.join('Uploads', req.body.serialNumber || 'default');
        if (!fs.existsSync(productFolder)) {
            fs.mkdirSync(productFolder, { recursive: true });
        }
        cb(null, productFolder);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    },
});
const upload = multer({ storage });

// Admin login endpoint
app.post('/api/admin/login', async (req, res) => {
    const { username, password } = req.body;
    winstonLogger.info('Admin login attempt:', { username });
    if (username === process.env.REACT_APP_ADMIN_USERNAME && password === process.env.REACT_APP_ADMIN_PASSWORD) {
        req.session.isAdmin = true;
        req.session.save((err) => {
            if (err) {
                winstonLogger.error('Session save error:', err);
                return res.status(500).json({ message: 'Session error' });
            }
            res.cookie('connect.sid', req.session.id, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production' ? true : false,
                sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
                maxAge: 24 * 60 * 60 * 1000,
            });
            winstonLogger.info('Admin session created:', { sessionId: req.session.id, connectSid: req.session.id });
            return res.status(200).json({ message: 'Admin logged in', isAdmin: true });
        });
    } else {
        winstonLogger.warn('Admin login failed: Invalid credentials');
        return res.status(401).json({ message: 'Invalid admin credentials' });
    }
});

// Admin logout endpoint
app.post('/api/admin/logout', (req, res) => {
    winstonLogger.info('Admin logout attempt:', { sessionId: req.session.id });
    req.session.destroy((err) => {
        if (err) {
            winstonLogger.error('Session destroy error:', err);
            return res.status(500).json({ message: 'Logout failed' });
        }
        res.clearCookie('connect.sid', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production' ? true : false,
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        });
        winstonLogger.info('Admin logged out');
        res.status(200).json({ message: 'Admin logged out' });
    });
});

// Admin auth check endpoint
app.get('/api/admin/checkAuth', (req, res) => {
    winstonLogger.info('Admin auth check:', { sessionId: req.session.id, isAdmin: req.session.isAdmin });
    if (req.session.isAdmin) {
        return res.json({ isAdmin: true });
    }
    winstonLogger.warn('Admin auth check: Not authenticated');
    res.status(401).json({ message: 'Not authenticated' });
});

// Root route
app.get('/', (req, res) => {
    res.status(200).json({ message: 'Server is running' });
});

// Favicon route
app.get('/favicon.ico', (req, res) => {
    res.status(204).end();
});

// Routes
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/orders', (req, res, next) => {
    winstonLogger.info('Order route hit', { method: req.method, url: req.originalUrl, body: req.body });
    orderRoutes(req, res, next);
});
app.use('/api/admin', (req, res, next) => {
    winstonLogger.info('Admin route hit', { method: req.method, url: req.originalUrl, sessionId: req.session.id });
    adminRoutes(req, res, next);
});

// Error handling middleware
app.use(notFound);
app.use((err, req, res, next) => {
    const statusCode = res.statusCode === 200 ? err.status || 500 : res.statusCode;
    const message = err.message || 'Server error';
    winstonLogger.error('Server error', {
        message,
        stack: err.stack,
        status: statusCode,
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        body: req.body,
        sessionId: req.session?.id,
    });

    res.status(statusCode).json({
        message,
        stack: process.env.NODE_ENV === 'production' ? null : err.stack,
    });
});

// Connect to MongoDB
connectDB().catch((err) => {
    winstonLogger.error('MongoDB connection error:', err);
    process.exit(1);
});

// Start server
app.listen(port, () => {
    winstonLogger.info(`Server is running on port ${port}`);
});