const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');

// Place an order (escrow payment)
router.post('/', orderController.placeOrder);

// Confirm delivery and release funds
router.post('/:id/deliver', orderController.confirmDelivery);

// Open dispute on an order
router.post('/:id/dispute', orderController.openDispute);

// Resolve dispute (refund or release funds)
router.post('/:id/resolve', orderController.resolveDispute);

// Get order details by ID
router.get('/:id', orderController.getOrder);

// List orders for a buyer address
router.get('/buyer/:address', orderController.getOrdersByBuyer);

module.exports = router;
