const express = require('express');
const router = express.Router();
const rewardController = require('../controllers/rewardController');

// Mint reward tokens (admin only)
router.post('/mint', rewardController.mintTokens);

// Get reward token balance by address
router.get('/balance/:address', rewardController.getBalance);

// Burn tokens from user
router.post('/burn', rewardController.burnTokens);

module.exports = router;
