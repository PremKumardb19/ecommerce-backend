const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');

// Add a product review
router.post('/', reviewController.addReview);

// Get all reviews for a product by productId
router.get('/:productId', reviewController.getReviews);

module.exports = router;
