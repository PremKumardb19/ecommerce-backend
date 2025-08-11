const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema(
  {
    // Off-chain UUID for product (used in API routes)
    productId: { type: String, required: true, unique: true },

    // Numeric ID from blockchain ProductRegistry contract
    onChainId: { type: Number, unique: true, sparse: true },

    // Owner's wallet address (always lowercase for consistency)
    owner: { type: String, required: true, lowercase: true },

    // Product details
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },

    // IPFS hashes
    imageHash: { type: String, required: true },
    provenanceHash: { type: String, default: null },

    // Price in Wei (stored as string to avoid precision issues)
    priceWei: { type: String, required: true },

    // Sale status
    forSale: { type: Boolean, default: true }
  },
  { timestamps: true }
);

// Useful indexes for queries
ProductSchema.index({ owner: 1 });
ProductSchema.index({ forSale: 1 });

module.exports = mongoose.model('Product', ProductSchema);
