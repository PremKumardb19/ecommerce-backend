const User = require('../models/User');
const { ethers } = require('ethers');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_here';
const JWT_EXPIRES_IN = '12h'; // Adjust token expiry as needed

/**
 * Generate or return existing nonce for given wallet address
 * POST /api/users/nonce
 * Body: { address }
 */
async function getNonce(req, res, next) {
  try {
    const { address } = req.body;
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return res.status(400).json({ error: 'Valid wallet address is required' });
    }

    let user = await User.findOne({ address: address.toLowerCase() });
    if (!user) {
      user = new User({ address: address.toLowerCase() });
      await user.save();
    }

    res.json({ nonce: user.nonce });
  } catch (error) {
    console.error('getNonce error:', error);
    next(error);
  }
}

/**
 * Login user by verifying signed nonce message via wallet signature
 * POST /api/users/login
 * Body: { address, signature }
 */
async function login(req, res, next) {
  try {
    const { address, signature } = req.body;

    if (!address || !signature) {
      return res.status(400).json({ error: 'Address and signature are required' });
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return res.status(400).json({ error: 'Invalid wallet address format' });
    }

    const user = await User.findOne({ address: address.toLowerCase() });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const message = `Please sign this message to authenticate. Nonce: ${user.nonce}`;

    // Recover address from signature
    const recoveredAddress = ethers.utils.verifyMessage(message, signature);

    if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
      return res.status(401).json({ error: 'Signature verification failed' });
    }

    // If verified, update nonce to prevent replay attacks
    user.nonce = Math.floor(Math.random() * 1000000);
    await user.save();

    // Generate JWT token
    const tokenPayload = {
      address: user.address,
      role: user.role,
    };
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    res.json({
      message: 'Login successful',
      user: {
        address: user.address,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      token,
    });
  } catch (error) {
    console.error('login error:', error);
    next(error);
  }
}

/**
 * Get user profile info by wallet address
 * GET /api/users/:address
 */
async function getUserProfile(req, res, next) {
  try {
    const address = req.params.address;
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return res.status(400).json({ error: 'Valid wallet address required' });
    }

    const user = await User.findOne({ address: address.toLowerCase() }).select('-nonce').lean();
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json(user);
  } catch (error) {
    console.error('getUserProfile error:', error);
    next(error);
  }
}

/**
 * Update user profile info (auth required)
 * PUT /api/users/:address
 * Body: { name, email }
 *
 * Authorization:
 *  - User can only update their own profile
 *  - Admin role can update any user profile
 */
async function updateUserProfile(req, res, next) {
  try {
    const address = req.params.address.toLowerCase();
    const { name, email } = req.body;

    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return res.status(400).json({ error: 'Valid wallet address required' });
    }

    // Require authentication middleware to attach req.user
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized: Authentication required' });
    }

    // Only allow self update or admin
    const requesterAddress = req.user.address.toLowerCase();
    const requesterRole = req.user.role;
    if (requesterAddress !== address && requesterRole !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Not authorized to update this profile' });
    }

    const update = {};
    if (name !== undefined) update.name = name;
    if (email !== undefined) update.email = email.toLowerCase();

    const user = await User.findOneAndUpdate({ address }, update, { new: true });
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
      message: 'Profile updated successfully',
      user: {
        address: user.address,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('updateUserProfile error:', error);
    next(error);
  }
}

module.exports = {
  getNonce,
  login,
  getUserProfile,
  updateUserProfile,
};
