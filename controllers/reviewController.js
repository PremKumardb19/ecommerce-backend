const Review = require('../models/Review');
const Product = require('../models/Product');
const { reviewSystem, orderEscrow, buyerWallet, ethers } = require('../services/blockchain');

/**
 * Add a product review by a verified buyer (stores in DB + calls on-chain verification)
 * POST /api/reviews
 * Body: { productId (UUID), rating, reviewText? }
 */
async function addReview(req, res, next) {
  try {
    const { productId, rating, reviewText = '' } = req.body;

    // Validate body fields
    if (!productId || rating === undefined) {
      return res.status(400).json({ error: 'productId and rating are required' });
    }
    if (typeof rating !== 'number' || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'rating must be a number between 1 and 5' });
    }

    // Authentication check – must come from auth middleware decoding JWT
    const reviewerAddress = req.user?.address?.toLowerCase();
    if (!reviewerAddress) {
      return res.status(401).json({ error: 'Authentication required with connected wallet' });
    }

    // Ensure user hasn't already reviewed this product
    const existingReview = await Review.findOne({ productId, reviewer: reviewerAddress });
    if (existingReview) {
      return res.status(409).json({ error: 'You have already reviewed this product' });
    }

    // Get on-chain numeric ID from DB
    const productDoc = await Product.findOne({ productId });
    if (!productDoc || typeof productDoc.onChainId !== 'number') {
      return res.status(404).json({ error: 'Product not found or not registered on-chain' });
    }
    const numericProductId = productDoc.onChainId;

    // Verify buyer status via OrderEscrow.hasPurchased(address,uint256)
    const isBuyerVerified = await orderEscrow.hasPurchased(reviewerAddress, numericProductId);
    if (!isBuyerVerified) {
      return res.status(403).json({ error: 'You must have purchased this product to review' });
    }

    // Submit review on-chain – backend demo uses buyerWallet as signer
    const contractWithBuyer = reviewSystem.connect(buyerWallet);
    const tx = await contractWithBuyer.addReview(numericProductId, rating, reviewText);
    await tx.wait();

    // Save review off-chain for fast retrieval
    const newReview = new Review({
      productId,              // keep UUID for off-chain reference
      reviewer: reviewerAddress,
      rating,
      reviewText,
      timestamp: new Date()
    });
    await newReview.save();

    res.status(201).json({
      message: 'Review added successfully',
      txHash: tx.hash
    });
  } catch (error) {
    console.error('addReview error:', error);
    if (error.message.includes('Already reviewed')) {
      return res.status(409).json({ error: 'You have already reviewed this product' });
    }
    if (error.message.includes('Not a verified buyer')) {
      return res.status(403).json({ error: 'You must have purchased this product to review' });
    }
    next(error);
  }
}

/**
 * Get all reviews for a specific product (from DB)
 * GET /api/reviews/:productId
 */
async function getReviews(req, res, next) {
  try {
    const productId = req.params.productId;
    if (!productId) {
      return res.status(400).json({ error: 'Product ID is required' });
    }

    const reviews = await Review.find({ productId }).sort({ timestamp: -1 }).lean();

    // Format reviews for client
    const formatted = reviews.map(r => ({
      reviewer: r.reviewer,
      rating: r.rating,
      reviewText: r.reviewText,
      timestamp: r.timestamp.toISOString()
    }));

    res.json(formatted);
  } catch (error) {
    console.error('getReviews error:', error);
    next(error);
  }
}

module.exports = {
  addReview,
  getReviews
};
