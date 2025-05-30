import mongoose from 'mongoose';

const reviewSchema = mongoose.Schema(
  {
    name: { type: String, required: true },
    rating: { type: Number, required: true },
    comment: { type: String, required: true },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

const productSchema = mongoose.Schema(
    {
        name: { type: String, required: true },
        price: { type: Number, required: true, default: 0 },
        description: { type: String, required: true },
        productCategory: { type: String, required: true },
        interestCategory: { type: String, required: true },
        genderCategory: { type: String, required: true },
        saleCategory: { type: String }, // Optional field now
        isNewArrival: { type: Boolean, default: false },
        isOnSale: { type: Boolean, default: false },
        countInStock: { type: Number, required: true, default: 0 },
        size: { type: [String], required: true }, // Fixed size array issue
        onOff: { type: Boolean, required: true, default: true },
        serialNumber: { type: String, required: true, unique: true }, // Added serial number field
        images: { type: [String], required: true }, // Array for multiple images
    },
    { timestamps: true }
);

const Product = mongoose.model('Product', productSchema);
export default Product;
