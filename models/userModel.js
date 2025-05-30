import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const cartItemSchema = mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
    },
    quantity: {
        type: Number,
        required: true,
        min: 1,
    },
    name: {
        type: String,
        required: true,
    },
    price: {
        type: Number,
        required: true,
    },
    image: {
        type: String,
        required: true,
    },
    size: {
        type: String,
        required: true, // Size is required for cart items
    },
});

const userSchema = mongoose.Schema(
    {
        firstName: {
            type: String,
            required: true,
        },
        lastName: {
            type: String,
            required: true,
        },
        phone: {
            type: String,
            required: false,
            match: [/^(\+\d{1,3}[- ]?)?\d{10}$/, 'Please enter a valid phone number'],
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
        },
        password: {
            type: String,
            required: true,
        },
        newsletter: {
            type: Boolean,
            default: false,
        },
        phoneOffers: {
            type: Boolean,
            default: false,
        },
        emailOffers: {
            type: Boolean,
            default: false,
        },
        cart: [cartItemSchema],
        wishlist: [
            {
                product: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'Product',
                    required: true,
                },
                name: {
                    type: String,
                    required: true,
                },
                price: {
                    type: Number,
                    required: true,
                },
                image: {
                    type: String,
                    required: true,
                },
            },
        ],
        addresses: [
            {
                street: {
                    type: String,
                    required: true,
                },
                city: {
                    type: String,
                    required: true,
                },
                postalCode: {
                    type: String,
                    required: true,
                },
                country: {
                    type: String,
                    required: true,
                },
                type: {
                    type: String,
                    required: true,
                    enum: ['Shipping', 'Billing'],
                },
            },
        ],
        isAdmin: {
            type: Boolean,
            required: true,
            default: false,
        },
        resetPasswordToken: {
            type: String,
        },
        resetPasswordExpires: {
            type: Date,
        },
    },
    {
        timestamps: true,
    }
);

userSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) {
        next();
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

export default mongoose.model('User', userSchema);