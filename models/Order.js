// ecommerce-backend/models/Order.js
const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true, unique: true }, // Use blockchain order ID (string) or UUID if you prefer
    productId: { type: String, required: true },             // Product ID, string if UUID
    buyer: { type: String, required: true, lowercase: true }, // Buyer wallet address
    seller: { type: String, required: true, lowercase: true }, // Seller wallet address
    valueWei: { type: String, required: true },              // Order value in wei (string to avoid precision issues)
    status: { type: Number, required: true },                 // Numeric status code corresponding to contract enum
    timestamp: { type: Date, required: true },                // Order creation timestamp (Date object)
  },
  { timestamps: true }
);

// Optional: You may add index on buyer and productId for faster queries
OrderSchema.index({ buyer: 1 });
OrderSchema.index({ productId: 1 });

module.exports = mongoose.model('Order', OrderSchema);
