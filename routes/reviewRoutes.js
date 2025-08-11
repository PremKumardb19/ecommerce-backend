const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');
const authMiddleware = require('../middlewares/auth');
// Add a product review
router.post('/', authMiddleware,reviewController.addReview);

// Get all reviews for a product by productId
router.get('/:productId', reviewController.getReviews);

module.exports = router;
