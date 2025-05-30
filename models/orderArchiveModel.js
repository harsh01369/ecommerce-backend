import mongoose from 'mongoose';

const orderArchiveSchema = mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: false,
        },
        orderItems: [
            {
                product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
                name: { type: String, required: true },
                quantity: { type: Number, required: true, min: 1 },
                price: { type: Number, required: true, min: 0 },
                image: { type: String, required: false },
                serialNumber: { type: String, required: false },
                size: { type: String, required: true },
            },
        ],
        shippingAddress: {
            street: { type: String, required: true },
            city: { type: String, required: true },
            postalCode: { type: String, required: true },
            country: { type: String, required: true },
            type: { type: String, required: true, enum: ['Shipping', 'Billing'] },
        },
        customerDetails: {
            firstName: { type: String, required: true },
            lastName: { type: String, required: true },
            email: { type: String, required: true, match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'] },
            phone: { type: String, required: false, match: [/^(\+\d{1,3}[- ]?)?\d{10}$/, 'Please enter a valid phone number'] },
        },
        paymentMethod: { type: String, required: true, enum: ['Card'] },
        shippingMethod: { type: String, required: true, enum: ['RoyalMail_Trackable', 'RoyalMail_NonTrackable'] },
        itemsPrice: { type: Number, required: true, min: 0 },
        shippingPrice: { type: Number, required: true, min: 0 },
        totalPrice: { type: Number, required: true, min: 0 },
        stripeSessionId: { type: String, required: true },
        isPaid: { type: Boolean, default: false },
        paidAt: { type: Date },
        isDelivered: { type: Boolean, default: false },
        deliveredAt: { type: Date },
        isMovedToSales: { type: Boolean, default: false },
        archivedAt: { type: Date, required: true, default: Date.now },
    },
    { timestamps: true }
);

export default mongoose.model('OrderArchive', orderArchiveSchema);