import asyncHandler from 'express-async-handler';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import validator from 'validator';
import User from '../models/userModel.js';
import Order from '../models/orderModel.js';
import Product from '../models/productModel.js';
import sgMail from '@sendgrid/mail';
import crypto from 'crypto';

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// Reusable email template with UWEAR branding
const generateEmailTemplate = ({ title, message, ctaText, ctaLink, firstName }) => {
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${title}</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background-color: #F5F5F5;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border: 2px solid #000000;">
                <!-- Header -->
                <tr>
                    <td style="padding: 20px; text-align: center; background-color: #FFD700;">
                        <h1 style="margin: 0; font-size: 2rem; font-weight: bold; color: #000;">UWEAR</h1>
                    </td>
                </tr>
                <!-- Divider -->
                <tr>
                    <td style="background-color: #000000; height: 4px;"></td>
                </tr>
                <!-- Body -->
                <tr>
                    <td style="padding: 20px; text-align: left; color: #333333;">
                        <h2 style="margin: 0 0 15px; font-size: 24px; color: #1B263B;">${title}, ${firstName}!</h2>
                        ${message}
                        ${ctaText && ctaLink ? `
                        <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
                            <tr>
                                <td style="text-align: center;">
                                    <a href="${ctaLink}" style="display: inline-block; padding: 10px 20px; background-color: #007BFF; color: #ffffff; text-decoration: none; border-radius: 5px; font-size: 16px; font-weight: bold;">${ctaText}</a>
                                </td>
                            </tr>
                        </table>
                        ` : ''}
                    </td>
                </tr>
                <!-- Promotional Banner (Welcome Email Only) -->
                ${title === 'Welcome to UWEAR' ? `
                <tr>
                    <td style="padding: 0;">
                        <a href="https://uwearuk.com/products">
                            <img src="http://localhost:5000/Uploads/uwear-banner.jpg" alt="Shop New Arrivals" style="width: 100%; height: auto; display: block;" />
                        </a>
                    </td>
                </tr>
                ` : ''}
                <!-- Footer -->
                <tr>
                    <td style="padding: 20px; text-align: center; background-color: #1B263B; color: #ffffff; font-size: 14px;">
                        <p style="margin: 0 0 10px;">Need help? Contact us at <a href="mailto:support@uwearuk.com" style="color: #F48C06; text-decoration: none;">support@uwearuk.com</a></p>
                        <p style="margin: 10px 0 0;">&copy; 2025 UWEAR. All rights reserved.</p>
                        <p style="margin: 5px 0 0;"><a href="https://uwearuk.com" style="color: #F48C06; text-decoration: none;">uwearuk.com</a></p>
                    </td>
                </tr>
            </table>
        </body>
        </html>
    `;
};

const registerUser = asyncHandler(async (req, res) => {
    const { firstName, lastName, phone, email, password, newsletter } = req.body;

    if (!firstName || !lastName || !email || !password) {
        res.status(400);
        throw new Error('Please provide all required fields');
    }

    if (!validator.isEmail(email)) {
        res.status(400);
        throw new Error('Invalid email format');
    }

    if (password.length < 8) {
        res.status(400);
        throw new Error('Password must be at least 8 characters');
    }

    if (phone && !/^(\+\d{1,3}[- ]?)?\d{10}$/.test(phone)) {
        res.status(400);
        throw new Error('Invalid phone number format');
    }

    const userExists = await User.findOne({ email: email.toLowerCase() });
    if (userExists) {
        res.status(409);
        throw new Error('User already exists');
    }

    const user = await User.create({
        firstName,
        lastName,
        phone: phone || null,
        email: email.toLowerCase(),
        password,
        newsletter,
        cart: [],
        wishlist: [],
        addresses: [],
        isAdmin: false,
    });

    res.status(201).json({
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        email: user.email,
        newsletter: user.newsletter,
        cart: user.cart,
        wishlist: user.wishlist,
        addresses: user.addresses,
        isAdmin: user.isAdmin,
        token: generateToken(user._id),
    });
});

const loginUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        res.status(400);
        throw new Error('Please provide email and password');
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
        res.status(401);
        throw new Error('Invalid email or password');
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
        res.status(401);
        throw new Error('Invalid email or password');
    }

    res.json({
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        email: user.email,
        newsletter: user.newsletter,
        cart: user.cart,
        wishlist: user.wishlist,
        addresses: user.addresses,
        isAdmin: user.isAdmin,
        token: generateToken(user._id),
    });
});

const logoutUser = asyncHandler(async (req, res) => {
    res.json({ message: 'Logged out successfully' });
});

const getUserProfile = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }
    res.json(user);
});

const updateUserProfile = asyncHandler(async (req, res) => {
    const { firstName, lastName, phone, email, password, currentPassword, newsletter, phoneOffers, emailOffers } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }

    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (newsletter !== undefined) user.newsletter = newsletter;
    if (phoneOffers !== undefined) user.phoneOffers = phoneOffers;
    if (emailOffers !== undefined) user.emailOffers = emailOffers;

    if (phone !== undefined) {
        if (phone && !/^(\+\d{1,3}[- ]?)?\d{10}$/.test(phone)) {
            res.status(400);
            throw new Error('Invalid phone number format');
        }
        if (phone !== user.phone && !currentPassword) {
            res.status(401);
            throw new Error('Current password required to update phone');
        }
        if (currentPassword) {
            const isMatch = await user.matchPassword(currentPassword);
            if (!isMatch) {
                res.status(401);
                throw new Error('Invalid current password');
            }
            user.phone = phone || null;
        }
    }

    if (email && email.toLowerCase() !== user.email) {
        if (!validator.isEmail(email)) {
            res.status(400);
            throw new Error('Invalid email format');
        }
        if (!currentPassword) {
            res.status(401);
            throw new Error('Current password required to update email');
        }
        const isMatch = await user.matchPassword(currentPassword);
        if (!isMatch) {
            res.status(401);
            throw new Error('Invalid current password');
        }
        const userExists = await User.findOne({ email: email.toLowerCase() });
        if (userExists && userExists._id.toString() !== user._id.toString()) {
            res.status(409);
            throw new Error('Email already in use');
        }
        user.email = email.toLowerCase();
    }

    if (password) {
        if (!currentPassword) {
            res.status(401);
            throw new Error('Current password required to update password');
        }
        const isMatch = await user.matchPassword(currentPassword);
        if (!isMatch) {
            res.status(401);
            throw new Error('Invalid current password');
        }
        if (password.length < 8) {
            res.status(400);
            throw new Error('Password must be at least 8 characters');
        }
        user.password = password;
    }

    const updatedUser = await user.save();
    res.json({
        _id: updatedUser._id,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        phone: updatedUser.phone,
        email: updatedUser.email,
        newsletter: updatedUser.newsletter,
        phoneOffers: updatedUser.phoneOffers,
        emailOffers: updatedUser.emailOffers,
        cart: updatedUser.cart,
        wishlist: updatedUser.wishlist,
        addresses: updatedUser.addresses,
        isAdmin: updatedUser.isAdmin,
    });
});

const addUserAddress = asyncHandler(async (req, res) => {
    const { street, city, postalCode, country, type } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }

    if (!street || !city || !postalCode || !country || !type) {
        res.status(400);
        throw new Error('Please provide all address fields');
    }

    if (!['Shipping', 'Billing'].includes(type)) {
        res.status(400);
        throw new Error('Invalid address type. Must be Shipping or Billing');
    }

    user.addresses.push({ street, city, postalCode, country, type });
    const updatedUser = await user.save();
    res.json(updatedUser.addresses);
});

const deleteUserAddress = asyncHandler(async (req, res) => {
    const { index } = req.params;
    const user = await User.findById(req.user._id);

    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }

    if (index < 0 || index >= user.addresses.length) {
        res.status(400);
        throw new Error('Invalid address index');
    }

    user.addresses.splice(index, 1);
    const updatedUser = await user.save();
    res.json(updatedUser.addresses);
});

const updateUserCart = asyncHandler(async (req, res) => {
    const { cart } = req.body;
    let user = await User.findById(req.user._id);

    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }

    if (!Array.isArray(cart)) {
        res.status(400);
        throw new Error('Cart must be an array');
    }

    try {
        const validatedCart = await Promise.all(
            cart.map(async (item) => {
                if (!item.product || !item.quantity || item.quantity < 1 || !item.size) {
                    return null; // Skip invalid items
                }

                const product = await Product.findById(item.product);
                if (!product) {
                    return null; // Skip if product not found
                }

                // Validate size
                if (!product.size.includes(item.size)) {
                    return null; // Skip if size is not valid for the product
                }

                return {
                    product: item.product,
                    quantity: item.quantity,
                    name: item.name || product.name || 'Unknown Product',
                    price: item.price || product.price || 0,
                    image: item.image || product.image || '/placeholder.jpg',
                    size: item.size,
                };
            })
        );

        user.cart = validatedCart.filter(item => item); // Remove null items
        const updatedUser = await user.save();
        res.json(updatedUser.cart);
    } catch (error) {
        res.status(400);
        throw new Error(error.message || 'Invalid cart data');
    }
});

const updateUserWishlist = asyncHandler(async (req, res) => {
    const { wishlist } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }

    if (!Array.isArray(wishlist)) {
        res.status(400);
        throw new Error('Wishlist must be an array');
    }

    try {
        const validatedWishlist = await Promise.all(
            wishlist.map(async (item) => {
                if (!item.product) {
                    return null; // Skip invalid items
                }

                const product = await Product.findById(item.product);
                if (!product) {
                    return null; // Skip if product not found
                }

                return {
                    product: item.product,
                    name: item.name || product.name || 'Unknown Product',
                    price: item.price || product.price || 0,
                    image: item.image || product.image || '/placeholder.jpg',
                };
            })
        );

        user.wishlist = validatedWishlist.filter(item => item); // Remove null items
        const updatedUser = await user.save();
        res.json(updatedUser.wishlist);
    } catch (error) {
        res.status(400);
        throw new Error(error.message || 'Invalid wishlist data');
    }
});

const getUserOrders = asyncHandler(async (req, res) => {
    const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json(orders);
});

const resendVerification = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }

    const msg = {
        to: user.email,
        from: process.env.EMAIL_USER,
        subject: 'UWEAR Email Verification',
        html: generateEmailTemplate({
            title: 'Verify Your Email',
            message: `
                <p>Please verify your email to continue using UWEAR.</p>
                <p>Click the button below to verify your account.</p>
            `,
            ctaText: 'Verify Email',
            ctaLink: 'https://uwearuk.com/verify',
            firstName: user.firstName,
        }),
    };

    await sgMail.send(msg);
    res.json({ message: 'Verification email sent' });
});

const sendWelcomeEmail = asyncHandler(async (req, res) => {
    const { email, firstName } = req.body;

    if (!email || !firstName) {
        res.status(400);
        throw new Error('Email and first name are required');
    }

    if (!validator.isEmail(email)) {
        res.status(400);
        throw new Error('Invalid email format');
    }

    const msg = {
        to: email,
        from: process.env.EMAIL_USER,
        subject: 'Welcome to UWEAR!',
        html: generateEmailTemplate({
            title: 'Welcome to UWEAR',
            message: `
                <p>Thank you for joining UWEAR, ${firstName}! We're excited to have you on board.</p>
                <p>Explore our latest collections and find your perfect style.</p>
                <p>Manage your account at <a href="https://uwearuk.com/account" style="color: #F48C06; text-decoration: none;">uwearuk.com/account</a>.</p>
            `,
            ctaText: 'Shop Now',
            ctaLink: 'https://uwearuk.com/products',
            firstName,
        }),
    };

    await sgMail.send(msg);
    res.json({ message: 'Welcome email sent' });
});

const sendEmailChangeConfirmation = asyncHandler(async (req, res) => {
    const { email } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }

    if (!email || !validator.isEmail(email)) {
        res.status(400);
        throw new Error('Invalid email format');
    }

    const msg = {
        to: email,
        from: process.env.EMAIL_USER,
        subject: 'UWEAR Email Change Confirmation',
        html: generateEmailTemplate({
            title: 'Email Updated',
            message: `
                <p>Your email has been updated to ${email}.</p>
                <p>Manage your account at <a href="https://uwearuk.com/account" style="color: #F48C06; text-decoration: none;">uwearuk.com/account</a>.</p>
                <p>If you did not make this change, please contact us at <a href="mailto:support@uwearuk.com" style="color: #F48C06; text-decoration: none;">support@uwearuk.com</a>.</p>
            `,
            ctaText: 'Go to Account',
            ctaLink: 'https://uwearuk.com/account',
            firstName: user.firstName,
        }),
    };

    await sgMail.send(msg);
    res.json({ message: 'Email change confirmation sent' });
});

const getAllUsers = asyncHandler(async (req, res) => {
    console.log('getAllUsers called:', { sessionId: req.session.id, isAdmin: req.session.isAdmin });
    const users = await User.find({}).select('-password');
    const usersWithOrders = await Promise.all(users.map(async (user) => {
        const totalOrders = await Order.countDocuments({ user: user._id });
        return { ...user._doc, totalOrders };
    }));
    console.log('Users fetched:', usersWithOrders.length);
    res.json(usersWithOrders);
});

const getUserById = asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }
    const totalOrders = await Order.countDocuments({ user: user._id });
    res.json({ ...user._doc, totalOrders });
});

const updateUserById = asyncHandler(async (req, res) => {
    const { isAdmin } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }

    if (isAdmin !== undefined) user.isAdmin = isAdmin;
    const updatedUser = await user.save();
    const totalOrders = await Order.countDocuments({ user: user._id });
    res.json({
        _id: updatedUser._id,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        email: updatedUser.email,
        isAdmin: updatedUser.isAdmin,
        totalOrders,
    });
});

const deleteUserById = asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }
    await User.deleteOne({ _id: user._id });
    res.json({ message: 'User deleted' });
});

const forgotPassword = asyncHandler(async (req, res) => {
    const { email } = req.body;
    if (!email || !validator.isEmail(email)) {
        res.status(400);
        throw new Error('Please provide a valid email');
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
        res.status(404);
        throw new Error('No account found with this email');
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    // Send email
    const resetUrl = `http://localhost:3003/reset-password?token=${resetToken}`;
    const msg = {
        to: user.email,
        from: process.env.EMAIL_USER,
        subject: 'UWEAR Password Reset',
        html: generateEmailTemplate({
            title: 'Password Reset Request',
            message: `
                <p>You requested a password reset for your UWEAR account.</p>
                <p>Click the button below to reset your password. This link expires in 1 hour.</p>
                <p>If you did not request this, please contact us at <a href="mailto:support@uwearuk.com" style="color: #F48C06; text-decoration: none;">support@uwearuk.com</a>.</p>
            `,
            ctaText: 'Reset Password',
            ctaLink: resetUrl,
            firstName: user.firstName,
        }),
    };

    await sgMail.send(msg);
    res.json({ message: 'Password reset link sent to your email' });
});

const resetPassword = asyncHandler(async (req, res) => {
    const { token, password } = req.body;
    if (!token || !password) {
        res.status(400);
        throw new Error('Token and password are required');
    }

    if (password.length < 8) {
        res.status(400);
        throw new Error('Password must be at least 8 characters');
    }

    const user = await User.findOne({
        resetPasswordToken: token,
        resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
        res.status(400);
        throw new Error('Invalid or expired reset token');
    }

    user.password = password;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    res.json({ message: 'Password reset successfully' });
});

export {
    registerUser,
    loginUser,
    logoutUser,
    getUserProfile,
    updateUserProfile,
    addUserAddress,
    deleteUserAddress,
    updateUserCart,
    updateUserWishlist,
    getUserOrders,
    resendVerification,
    sendWelcomeEmail,
    sendEmailChangeConfirmation,
    getAllUsers,
    getUserById,
    updateUserById,
    deleteUserById,
    forgotPassword,
    resetPassword,
};