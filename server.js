import express from 'express';
import cors from 'cors';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import dotenv from 'dotenv';
import path from 'path';
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

// Trust Render's proxy for secure cookies
app.set('trust proxy', 1);

// Middleware setup
app.use(cors({
    origin: [
        'http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002',
        'http://localhost:3005', 'http://localhost:3006', 'http://localhost:3004',
        'https://www.uwearuk.com', 'https://admin.uwearuk.com',
        'https://admin-dashboard-h9cx.onrender.com',
        'https://uwear-frontend.onrender.com'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Cookie'],
    exposedHeaders: ['Set-Cookie', 'Content-Length'],
}));

// Debug CORS and Set-Cookie headers
app.use((req, res, next) => {
    const origin = req.headers.origin;
    const allowedOrigins = [
        'http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002',
        'http://localhost:3005', 'http://localhost:3006', 'http://localhost:3004',
        'https://www.uwearuk.com', 'https://admin.uwearuk.com',
        'https://admin-dashboard-h9cx.onrender.com',
        'https://uwear-frontend.onrender.com'
    ];
    if (allowedOrigins.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Access-Control-Allow-Credentials', 'true');
        res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With,Cookie');
        res.header('Access-Control-Expose-Headers', 'Set-Cookie,Content-Length');
        console.log('CORS headers set for origin:', origin);
    }
    // Log Set-Cookie header if present
    const setCookie = res.getHeader('Set-Cookie');
    if (setCookie) {
        console.log('Set-Cookie header:', setCookie);
    }
    next();
});

// Explicitly handle CORS preflight requests
app.options('*', cors({
    origin: [
        'http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002',
        'http://localhost:3005', 'http://localhost:3006', 'http://localhost:3004',
        'https://www.uwearuk.com', 'https://admin.uwearuk.com',
        'https://admin-dashboard-h9cx.onrender.com',
        'https://uwear-frontend.onrender.com'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Cookie'],
    exposedHeaders: ['Set-Cookie', 'Content-Length'],
}));

app.use(cookieParser());

// JSON body parser for other routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files for uploaded images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Session configuration with debugging
app.use((req, res, next) => {
    console.log('Incoming request cookies:', req.cookies);
    console.log('Session ID:', req.sessionID);
    console.log('Session Data:', req.session);
    next();
});
app.use(
    session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        store: MongoStore.create({
            mongoUrl: process.env.MONGO_URI,
            dbName: 'uwear',
            autoRemove: 'native',
            ttl: 24 * 60 * 60, // 24 hours
            stringify: false, // Ensure session data is stored as plain object
        }),
        cookie: {
            secure: true, // Force secure for HTTPS (Render)
            httpOnly: true,
            sameSite: 'none', // Required for cross-origin requests in production
            maxAge: 24 * 60 * 60 * 1000,
        },
        name: 'connect.sid',
    })
);

// Root route
app.get('/', (req, res) => {
    res.status(200).json({ message: 'Server is running' });
});

// Routes with debug logging
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/orders', (req, res, next) => {
    console.log('Order route hit with URL:', req.originalUrl);
    winstonLogger.info('Order route hit', { method: req.method, url: req.originalUrl, body: req.body });
    orderRoutes(req, res, next);
});
app.use('/api/admin', adminRoutes);

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
        cookies: req.cookies,
    });

    res.status(statusCode).json({
        message: statusCode === 404 ? 'Resource not found' : message,
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