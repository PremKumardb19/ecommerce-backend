const { reviewSystem, buyerWallet } = require('../services/blockchain');

/**
 * Add a product review by a verified buyer
 * POST /api/reviews
 * Body: { productId, rating, reviewText }
 */
async function addReview(req, res, next) {
  try {
    const { productId, rating, reviewText } = req.body;

    if (!productId || !rating) {
      return res.status(400).json({ error: 'productId and rating are required' });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'rating must be between 1 and 5' });
    }

    const contractWithBuyer = reviewSystem.connect(buyerWallet);
    console.log("buyerwallet at reviews ",buyerWallet)
    const tx = await contractWithBuyer.addReview(productId, rating, reviewText || '');
    const receipt = await tx.wait();

    res.status(201).json({
      message: 'Review added successfully',
      txHash: tx.hash,
      receipt:receipt
    });
  } catch (error) {
    console.error('addReview error:', error);
    // Check for some common revert reasons
    if (error.message.includes('Already reviewed')) {
      error.status = 409;
      error.message = 'You have already reviewed this product';
    } else if (error.message.includes('Not a verified buyer')) {
      error.status = 403;
      error.message = 'You must have purchased this product to review';
    }
    next(error);
  }
}

/**
 * Get all reviews for a specific product
 * GET /api/reviews/:productId
 */
async function getReviews(req, res, next) {
  try {
    const productId = req.params.productId;

    if (!productId) {
      return res.status(400).json({ error: 'Product ID is required' });
    }

    const reviews = await reviewSystem.getReviews(productId);

    // Format reviews for client
    const formatted = reviews.map(r => ({
      reviewer: r.reviewer,
      rating: r.rating.toNumber ? r.rating.toNumber() : r.rating,
      reviewText: r.reviewText,
      timestamp: new Date(r.timestamp.toNumber ? r.timestamp.toNumber() * 1000 : r.timestamp * 1000).toISOString(),
    }));

    res.json(formatted);
  } catch (error) {
    console.error('getReviews error:', error);
    next(error);
  }
}

module.exports = {
  addReview,
  getReviews,
};
