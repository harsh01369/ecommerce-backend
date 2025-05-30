import asyncHandler from 'express-async-handler';
import winston from 'winston';
import mongoose from 'mongoose';
import Order from '../models/orderModel.js';
import Product from '../models/productModel.js';
import User from '../models/userModel.js';
import Stripe from 'stripe';
import sgMail from '@sendgrid/mail';

// Configure Winston logger
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

// Validate STRIPE_SECRET_KEY
if (!process.env.STRIPE_SECRET_KEY) {
    logger.error('STRIPE_SECRET_KEY is not defined in environment variables');
    throw new Error('STRIPE_SECRET_KEY is not defined');
}

if (!process.env.STRIPE_SECRET_KEY.startsWith('sk_test_') && !process.env.STRIPE_SECRET_KEY.startsWith('rk_test_')) {
    logger.error('STRIPE_SECRET_KEY must start with "sk_test_" or "rk_test_" for test mode');
    throw new Error('Invalid STRIPE_SECRET_KEY format');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2023-10-16',
});

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Utility function to transform image paths into absolute, URL-encoded URLs
const getImageUrl = (imagePath) => {
    if (!imagePath) return 'https://via.placeholder.com/50';
    const baseUrl = process.env.NODE_ENV === 'production' ? 'https://uwearuk.com' : 'http://localhost:5000';
    const cleanPath = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
    const encodedPath = cleanPath.split('/').map(segment => encodeURIComponent(segment)).join('/');
    return `${baseUrl}${encodedPath}`;
};

// Utility function for email styling and content
const generateEmailHtml = (subject, content) => {
    return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; background-color: #F5F5F5; padding: 20px;">
        <div style="background-color: #FFD700; padding: 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 2rem; font-weight: bold; color: #000;">UWEAR</h1>
        </div>
        <div style="background-color: #000000; height: 4px;"></div>
        <div style="border: 2px solid #000000; padding: 20px; background-color: #FFFFFF;">
            ${content}
            <p style="margin-top: 20px; text-align: center;">
                If you have any questions, contact us at <a href="mailto:support@uwearuk.com" style="color: #007BFF;">support@uwearuk.com</a>.
            </p>
            <p style="text-align: center;">
                Visit us at <a href="https://uwearuk.com" style="color: #007BFF;">uwearuk.com</a>
            </p>
        </div>
    </div>
    `;
};

// Utility function to send Order Confirmation email
const sendOrderConfirmationEmail = async (order) => {
    const itemsHtml = order.orderItems
        .map(item => `
            <tr>
                <td><img src="${getImageUrl(item.image)}" alt="${item.name}" style="width: 50px; height: auto;" /></td>
                <td>${item.name} (${item.size})</td>
                <td>${item.quantity}</td>
                <td>£${(item.price * item.quantity).toFixed(2)}</td>
            </tr>
        `)
        .join('');

    const emailContent = `
        <h2 style="color: #333;">Thank You for Your Order, ${order.customerDetails.firstName}!</h2>
        <p>Your order #${order._id} has been successfully paid and confirmed.</p>
        <h3>Order Summary</h3>
        <table style="width: 100%; border-collapse: collapse;">
            <thead>
                <tr style="background-color: #f5f5f5;">
                    <th style="padding: 10px; text-align: left;">Image</th>
                    <th style="padding: 10px; text-align: left;">Product</th>
                    <th style="padding: 10px; text-align: left;">Quantity</th>
                    <th style="padding: 10px; text-align: left;">Price</th>
                </tr>
            </thead>
            <tbody>
                ${itemsHtml}
            </tbody>
        </table>
        <p style="margin-top: 20px;"><strong>Subtotal: £${order.itemsPrice}</strong></p>
        <p><strong>Shipping: £${order.shippingPrice}</strong></p>
        <p><strong>Total: £${order.totalPrice}</strong></p>
        <h3>Shipping Address</h3>
        <p>
            ${order.shippingAddress.street}, ${order.shippingAddress.city}, <br />
            ${order.shippingAddress.postalCode}, ${order.shippingAddress.country} (${order.shippingAddress.type})
        </p>
        <h3>Payment Method</h3>
        <p>${order.paymentMethod}</p>
        <p style="margin-top: 20px; text-align: center;">
            <a href="https://uwearuk.com/account/orders/${order._id}" style="background-color: #007BFF; color: #FFFFFF; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Order</a>
        </p>
    `;

    const msg = {
        to: order.customerDetails.email,
        from: process.env.EMAIL_USER,
        subject: `UWEAR Order Confirmation #${order._id}`,
        html: generateEmailHtml(`UWEAR Order Confirmation #${order._id}`, emailContent),
    };

    try {
        await sgMail.send(msg);
        logger.info('Order confirmation email sent', { orderId: order._id, email: order.customerDetails.email });
    } catch (emailError) {
        logger.error('Failed to send order confirmation email', {
            error: emailError.message,
            orderId: order._id,
            email: order.customerDetails.email,
        });
    }
};

const createOrder = asyncHandler(async (req, res) => {
    const {
        orderItems,
        shippingAddress,
        customerDetails,
        paymentMethod,
        shippingMethod: clientShippingMethod,
        itemsPrice,
        shippingPrice: clientShippingPrice,
        totalPrice,
    } = req.body;

    logger.info('Create order request', { body: req.body, userId: req.user?._id });

    const user = req.user ? await User.findById(req.user._id) : null;
    if (!user) {
        logger.warn('Create order failed: User not authenticated', { userId: 'guest' });
        res.status(401);
        throw new Error('User not authenticated');
    }

    if (!orderItems || !Array.isArray(orderItems) || orderItems.length === 0) {
        logger.warn('Create order failed: No order items', { userId: user._id });
        res.status(400);
        throw new Error('No order items');
    }

    if (!shippingAddress.street || !shippingAddress.city || !shippingAddress.postalCode || !shippingAddress.country || !shippingAddress.type) {
        logger.warn('Create order failed: Incomplete shipping address', { userId: user._id });
        res.status(400);
        throw new Error('All shipping address fields are required');
    }
    if (!['Shipping', 'Billing'].includes(shippingAddress.type)) {
        logger.warn('Create order failed: Invalid shipping address type', { userId: user._id });
        res.status(400);
        throw new Error('Invalid shipping address type. Must be Shipping or Billing');
    }

    if (!customerDetails.firstName || !customerDetails.lastName || !customerDetails.email) {
        logger.warn('Create order failed: Incomplete customer details', { userId: user._id });
        res.status(400);
        throw new Error('First name, last name, and email are required');
    }
    if (!/^\S+@\S+\.\S+$/.test(customerDetails.email)) {
        logger.warn('Create order failed: Invalid email format', { userId: user._id });
        res.status(400);
        throw new Error('Invalid email format');
    }
    if (customerDetails.phone && !/^(\+\d{1,3}[- ]?)?\d{10}$/.test(customerDetails.phone)) {
        logger.warn('Create order failed: Invalid phone number format', { userId: user._id });
        res.status(400);
        throw new Error('Invalid phone number format');
    }

    if (paymentMethod !== 'Card') {
        logger.warn('Create order failed: Invalid payment method', { userId: user._id });
        res.status(400);
        throw new Error('Invalid payment method');
    }

    const shippingMethod = 'RoyalMail_NonTrackable';
    const shippingPrice = 2.99;

    let calculatedItemsPrice = 0;
    const validatedItems = [];
    for (const item of orderItems) {
        if (!item.product || !item.quantity || item.quantity < 1 || !item.size) {
            logger.warn('Create order failed: Invalid order item', { userId: user._id, item });
            res.status(400);
            throw new Error('Invalid order item');
        }
        const product = await Product.findById(item.product);
        if (!product) {
            logger.warn('Create order failed: Product not found', { userId: user._id, productId: item.product });
            res.status(404);
            throw new Error(`Product not found: ${item.product}`);
        }
        if (product.countInStock < item.quantity) {
            logger.warn('Create order failed: Insufficient stock', { userId: user._id, productId: item.product });
            res.status(400);
            throw new Error(`Insufficient stock for ${product.name}`);
        }
        if (!product.size.includes(item.size)) {
            logger.warn('Create order failed: Invalid size', { userId: user._id, productId: item.product, size: item.size });
            res.status(400);
            throw new Error(`Invalid size for ${product.name}: ${item.size}`);
        }
        calculatedItemsPrice += product.price * item.quantity;
        validatedItems.push({
            product: item.product,
            name: product.name,
            quantity: item.quantity,
            price: product.price,
            image: product.images?.[0] || null,
            serialNumber: item.serialNumber || '',
            size: item.size,
        });
    }

    const expectedItemsPrice = parseFloat(itemsPrice);
    if (Math.abs(calculatedItemsPrice - expectedItemsPrice) > 0.01) {
        logger.warn('Create order failed: Items price mismatch', { userId: user._id });
        res.status(400);
        throw new Error('Items price mismatch');
    }
    if (parseFloat(clientShippingPrice) !== shippingPrice) {
        logger.warn('Create order failed: Shipping price mismatch', { userId: user._id });
        res.status(400);
        throw new Error('Shipping price mismatch');
    }
    const expectedTotalPrice = parseFloat(totalPrice);
    const calculatedTotalPrice = calculatedItemsPrice + shippingPrice;
    if (Math.abs(calculatedTotalPrice - expectedTotalPrice) > 0.01) {
        logger.warn('Create order failed: Total price mismatch', { userId: user._id });
        res.status(400);
        throw new Error('Total price mismatch');
    }

    const lineItems = validatedItems.map(item => ({
        price_data: {
            currency: 'gbp',
            product_data: {
                name: `${item.name} (${item.size})`,
            },
            unit_amount: Math.round(item.price * 100),
        },
        quantity: item.quantity,
    }));
    lineItems.push({
        price_data: {
            currency: 'gbp',
            product_data: {
                name: `Shipping (${shippingMethod})`,
            },
            unit_amount: Math.round(shippingPrice * 100),
        },
        quantity: 1,
    });

    const cancelUrl = 'http://localhost:3003/checkout';
    let session;
    try {
        new URL(cancelUrl);
    } catch (urlError) {
        logger.error('Invalid URL format', { cancelUrl, error: urlError.message });
        res.status(400);
        throw new Error(`Invalid URL format: ${urlError.message}`);
    }

    let tempOrder;
    try {
        tempOrder = await Order.create({
            user: user._id,
            orderItems: validatedItems,
            shippingAddress,
            customerDetails,
            paymentMethod,
            shippingMethod,
            itemsPrice: calculatedItemsPrice.toFixed(2),
            shippingPrice: shippingPrice.toFixed(2),
            totalPrice: calculatedTotalPrice.toFixed(2),
            stripeSessionId: 'temp',
            isPaid: false,
            isDelivered: false,
        });
    } catch (error) {
        logger.error('Temporary order creation failed', {
            error: error.message,
            userId: user._id,
        });
        res.status(400);
        throw new Error(`Order creation failed: ${error.message}`);
    }

    const successUrl = `http://localhost:3000/order-confirmation?orderId=${tempOrder._id}`;
    try {
        new URL(successUrl);
    } catch (urlError) {
        logger.error('Invalid URL format', { successUrl, error: urlError.message });
        await Order.deleteOne({ _id: tempOrder._id });
        res.status(400);
        throw new Error(`Invalid URL format: ${urlError.message}`);
    }

    try {
        session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: lineItems,
            mode: 'payment',
            success_url: successUrl,
            cancel_url: cancelUrl,
            metadata: {
                userId: user._id.toString(),
                orderId: tempOrder._id.toString(),
            },
            customer_email: customerDetails.email,
        });
        logger.info('Stripe session created', { sessionId: session.id, userId: user._id });
    } catch (error) {
        logger.error('Stripe session creation failed', {
            error: error.message,
            rawError: JSON.stringify(error, null, 2),
            userId: user._id,
            successUrl,
            cancelUrl,
            lineItems,
        });
        await Order.deleteOne({ _id: tempOrder._id });
        res.status(400);
        throw new Error(`Failed to create payment session: ${error.message}`);
    }

    try {
        tempOrder.stripeSessionId = session.id;
        await tempOrder.save();
    } catch (error) {
        logger.error('Order update failed', {
            error: error.message,
            userId: user._id,
            sessionId: session.id,
        });
        await Order.deleteOne({ _id: tempOrder._id });
        res.status(400);
        throw new Error(`Order update failed: ${error.message}`);
    }

    for (const item of validatedItems) {
        const product = await Product.findById(item.product);
        product.countInStock -= item.quantity;
        await product.save();
    }

    user.cart = [];
    await user.save();

    logger.info('Order created successfully', { orderId: tempOrder._id, userId: user._id, redirectUrl: session.url });
    res.status(201).json({ url: session.url });
});

const handleStripeWebhook = asyncHandler(async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!endpointSecret) {
        logger.error('Stripe webhook secret not defined');
        res.status(500);
        throw new Error('Webhook secret not configured');
    }

    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
        logger.error('Stripe webhook signature verification failed', { error: err.message });
        res.status(400);
        throw new Error(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const order = await Order.findOne({ stripeSessionId: session.id }).populate('orderItems.product', 'name price image');
        if (order) {
            if (!order.isPaid) {
                order.isPaid = true;
                order.paidAt = Date.now();
                await order.save();
                logger.info('Order payment confirmed via webhook', { orderId: order._id, stripeSessionId: session.id });

                await sendOrderConfirmationEmail(order);
            }
        } else {
            logger.warn('Order not found for webhook event', { stripeSessionId: session.id });
        }
    }

    res.status(200).json({ received: true });
});

const getUserOrders = asyncHandler(async (req, res) => {
    if (!req.user) {
        logger.warn('Get user orders failed: No user authenticated');
        res.status(401);
        throw new Error('Not authorized');
    }
    const orders = await Order.find({ user: req.user._id })
        .sort({ createdAt: -1 })
        .populate('orderItems.product', 'name price image');

    const transformedOrders = orders.map(order => ({
        ...order.toObject(),
        orderItems: order.orderItems.map(item => ({
            ...item.toObject(),
            image: getImageUrl(item.image),
        })),
    }));

    logger.info('User orders retrieved', { userId: req.user._id, orderCount: orders.length });
    res.json(transformedOrders);
});

const getOrderBySession = asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    const order = await Order.findOne({ stripeSessionId: sessionId }).populate(
        'orderItems.product',
        'name price image'
    );
    if (!order) {
        logger.warn('Order not found by session ID', { sessionId });
        res.status(404);
        throw new Error('Order not found');
    }

    const transformedOrder = {
        ...order.toObject(),
        orderItems: order.orderItems.map(item => ({
            ...item.toObject(),
            image: getImageUrl(item.image),
        })),
    };

    logger.info('Order retrieved by session ID', { orderId: order._id, sessionId });
    res.json(transformedOrder);
});

const cancelOrder = asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) {
        logger.warn('Cancel order failed: Order not found', { orderId: req.params.id });
        res.status(404);
        throw new Error('Order not found');
    }
    if (order.user && order.user.toString() !== req.user._id.toString()) {
        logger.warn('Cancel order failed: Unauthorized', { orderId: order._id, userId: req.user._id });
        res.status(403);
        throw new Error('Unauthorized');
    }
    if (order.isPaid) {
        logger.warn('Cancel order failed: Order already paid', { orderId: order._id });
        res.status(400);
        throw new Error('Cannot cancel a paid order');
    }

    for (const item of order.orderItems) {
        const product = await Product.findById(item.product);
        if (product) {
            product.countInStock += item.quantity;
            await product.save();
        }
    }

    await Order.deleteOne({ _id: order._id });
    logger.info('Order cancelled successfully', { orderId: order._id, userId: req.user._id });
    res.json({ message: 'Order cancelled successfully' });
});

const getAllOrders = asyncHandler(async (req, res) => {
    const orders = await Order.find({ isPaid: true })
        .sort({ createdAt: -1 })
        .populate('orderItems.product', 'name price image')
        .populate('user', 'email firstName lastName');

    const transformedOrders = orders.map(order => ({
        ...order.toObject(),
        orderItems: order.orderItems.map(item => ({
            ...item.toObject(),
            image: getImageUrl(item.image),
        })),
    }));

    logger.info('All orders retrieved', { orderCount: orders.length });
    res.json(transformedOrders);
});

const updateOrder = asyncHandler(async (req, res) => {
    const { isPaid, isDelivered } = req.body;
    const order = await Order.findById(req.params.id).populate('orderItems.product', 'name price image');
    if (!order) {
        logger.warn('Update order failed: Order not found', { orderId: req.params.id });
        res.status(404);
        throw new Error('Order not found');
    }

    const wasPaid = order.isPaid;

    if (isPaid !== undefined) order.isPaid = isPaid;
    if (isDelivered !== undefined) order.isDelivered = isDelivered;
    if (isPaid && !order.paidAt) order.paidAt = Date.now();
    if (isDelivered && !order.deliveredAt) order.deliveredAt = Date.now();

    const updatedOrder = await order.save();
    logger.info('Order updated successfully', { orderId: order._id });

    // Send Order Confirmation email if isPaid transitions to true
    if (!wasPaid && updatedOrder.isPaid) {
        await sendOrderConfirmationEmail(updatedOrder);
    }

    const transformedOrder = {
        ...updatedOrder.toObject(),
        orderItems: updatedOrder.orderItems.map(item => ({
            ...item.toObject(),
            image: getImageUrl(item.image),
        })),
    };

    res.json(transformedOrder);
});

const deleteOrder = asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) {
        logger.warn('Delete order failed: Order not found', { orderId: req.params.id });
        res.status(404);
        throw new Error('Order not found');
    }

    for (const item of order.orderItems) {
        const product = await Product.findById(item.product);
        if (product) {
            product.countInStock += item.quantity;
            await product.save();
        }
    }

    await Order.deleteOne({ _id: order._id });
    logger.info('Order deleted successfully', { orderId: order._id });
    res.json({ message: 'Order deleted' });
});

const getOrderById = asyncHandler(async (req, res) => {
    logger.info('getOrderById called', { id: req.params.id });
    const order = await Order.findById(req.params.id).populate('user', 'email firstName lastName');
    if (!order) {
        logger.warn('Order not found', { orderId: req.params.id });
        res.status(404);
        throw new Error('Order not found');
    }
    if (order.user && req.user && (order.user._id.toString() === req.user._id.toString() || req.user.isAdmin)) {
        const transformedOrder = {
            ...order.toObject(),
            orderItems: order.orderItems.map(item => ({
                ...item.toObject(),
                image: getImageUrl(item.image),
            })),
        };
        res.json(transformedOrder);
    } else {
        logger.warn('Unauthorized access to order', { orderId: req.params.id, userId: req.user?._id });
        res.status(401);
        throw new Error('Not authorized to view this order');
    }
});

const markOrderDelivered = asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);

    if (order) {
        order.isDelivered = true;
        order.deliveredAt = Date.now();
        const updatedOrder = await order.save();
        logger.info('Order marked as delivered', { orderId: req.params.id });

        const transformedOrder = {
            ...updatedOrder.toObject(),
            orderItems: updatedOrder.orderItems.map(item => ({
                ...item.toObject(),
                image: getImageUrl(item.image),
            })),
        };

        res.json(transformedOrder);
    } else {
        logger.error('Order not found', { orderId: req.params.id });
        res.status(404);
        throw new Error('Order not found');
    }
});

const moveOrdersToSales = asyncHandler(async (req, res) => {
    const { orderIds } = req.body;
    logger.info('moveOrdersToSales called', { orderIds, userId: req.user?._id });

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
        logger.warn('Move orders failed: No order IDs provided', { userId: req.user?._id });
        res.status(400);
        throw new Error('No order IDs provided');
    }

    const invalidIds = orderIds.filter(id => !mongoose.Types.ObjectId.isValid(id));
    if (invalidIds.length > 0) {
        logger.warn('Move orders failed: Invalid order IDs', { invalidIds, userId: req.user?._id });
        res.status(400);
        throw new Error(`Invalid order IDs: ${invalidIds.join(', ')}`);
    }

    try {
        const ordersToUpdate = await Order.find({ _id: { $in: orderIds }, isDelivered: true });
        const ordersToNotify = ordersToUpdate.filter(order => !order.isMovedToSales);

        const result = await Order.updateMany(
            { _id: { $in: orderIds }, isDelivered: true },
            { $set: { isMovedToSales: true } }
        );
        logger.info('Orders moved to sales', {
            matchedCount: result.matchedCount,
            modifiedCount: result.modifiedCount,
            orderIds,
            userId: req.user?._id
        });

        for (const order of ordersToNotify) {
            const populatedOrder = await Order.findById(order._id).populate('orderItems.product', 'name price image');
            const itemsList = populatedOrder.orderItems
                .map(item => `<li>${item.name} (${item.size}) - Quantity: ${item.quantity}</li>`)
                .join('');

            const emailContent = `
                <h2 style="color: #333;">Your UWEAR Order #${populatedOrder._id} Has Been Dispatched!</h2>
                <p>We’re pleased to inform you that your order has been dispatched.</p>
                <h3>Order Details</h3>
                <p><strong>Order ID:</strong> ${populatedOrder._id}</p>
                <p><strong>Shipping Method:</strong> Royal Mail Non-Trackable</p>
                <h3>Items</h3>
                <ul>${itemsList}</ul>
                <h3>Shipping Address</h3>
                <p>
                    ${populatedOrder.shippingAddress.street}, ${populatedOrder.shippingAddress.city}, <br />
                    ${populatedOrder.shippingAddress.postalCode}, ${populatedOrder.shippingAddress.country} (${populatedOrder.shippingAddress.type})
                </p>
                <p style="margin-top: 20px; text-align: center;">
                    <a href="https://uwearuk.com/account/orders/${populatedOrder._id}" style="background-color: #007BFF; color: #FFFFFF; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Order</a>
                </p>
            `;

            const msg = {
                to: populatedOrder.customerDetails.email,
                from: process.env.EMAIL_USER,
                subject: `Your UWEAR Order #${populatedOrder._id} Has Been Dispatched!`,
                html: generateEmailHtml(`Your UWEAR Order #${populatedOrder._id} Has Been Dispatched!`, emailContent),
            };

            try {
                await sgMail.send(msg);
                logger.info('Order dispatched email sent', { orderId: populatedOrder._id, email: populatedOrder.customerDetails.email });
            } catch (emailError) {
                logger.error('Failed to send order dispatched email', {
                    error: emailError.message,
                    orderId: populatedOrder._id,
                    email: populatedOrder.customerDetails.email,
                });
            }
        }

        res.json({
            message: `${result.modifiedCount} orders moved to sales`,
            modifiedCount: result.modifiedCount
        });
    } catch (error) {
        logger.error('Move orders error', {
            error: error.message,
            stack: error.stack,
            orderIds,
            userId: req.user?._id
        });
        res.status(500);
        throw new Error(error.message);
    }
});

export {
    createOrder,
    handleStripeWebhook,
    getUserOrders,
    getOrderBySession,
    cancelOrder,
    getAllOrders,
    updateOrder,
    deleteOrder,
    getOrderById,
    markOrderDelivered,
    moveOrdersToSales,
};