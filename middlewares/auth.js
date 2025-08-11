const jwt = require('jsonwebtoken');

// Secret key for signing/verifying JWTs
// Ensure you set this in your .env file securely
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_here';

function authMiddleware(req, res, next) {
  try {
    // Check for Authorization header format: "Bearer [token]"
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization token missing or malformed' });
    }
    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Authorization token missing' });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Attach user info (e.g., wallet address, role) to request
    req.user = decoded;
    console.log("decoded jwt",decoded)

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({ error: 'Invalid or expired authorization token' });
  }
}

module.exports = authMiddleware;
