const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middlewares/auth');

// Route to request a nonce to sign (public)
router.post('/nonce', userController.getNonce);

// Route to login by verifying signed nonce message (public)
router.post('/login', userController.login);

// Get user profile by wallet address (public)
router.get('/:address', userController.getUserProfile);

// Update user profile (protected by JWT auth middleware)
router.put('/:address', authMiddleware, userController.updateUserProfile);

module.exports = router;
