import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Order from './models/orderModel.js';
import OrderArchive from './models/orderArchiveModel.js';

dotenv.config();

const archiveOrders = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('Connected to MongoDB');

        // Calculate date threshold (1 month ago)
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

        // Find orders to archive
        const ordersToArchive = await Order.find({
            isMovedToSales: true,
            createdAt: { $lt: oneMonthAgo },
        });

        if (ordersToArchive.length === 0) {
            console.log('No orders to archive');
            return;
        }

        // Archive orders
        const archiveDocs = ordersToArchive.map(order => ({
            ...order.toObject(),
            archivedAt: new Date(),
        }));

        await OrderArchive.insertMany(archiveDocs);
        console.log(`Archived ${archiveDocs.length} orders`);

        // Delete archived orders from Order collection
        const orderIds = ordersToArchive.map(order => order._id);
        await Order.deleteMany({ _id: { $in: orderIds } });
        console.log(`Deleted ${orderIds.length} orders from active collection`);

    } catch (error) {
        console.error('Error archiving orders:', error);
    } finally {
        await mongoose.connection.close();
        console.log('MongoDB connection closed');
    }
};

archiveOrders();