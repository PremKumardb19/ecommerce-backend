require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const rewardRoutes = require('./routes/rewardRoutes');
const userRoutes = require('./routes/userRoutes'); // optional if you have user auth

const { errorHandler, notFoundHandler } = require('./middlewares/errorHandler');

const app = express();

// Middleware setup
app.use(helmet()); // Security headers
app.use(cors()); // Enable CORS for all origins (adjust if needed)
app.use(compression()); // Gzip compression
app.use(express.json({ limit: '10mb' })); // JSON body parsing with reasonable size limit

// HTTP request logging (dev only)
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Rate limiter to prevent abuse
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 min
  max: 100,
  message: { error: 'Too many requests, please try again later.' },
});
app.use(limiter);

// Register API routes
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/rewards', rewardRoutes);
app.use('/api/users', userRoutes); // optional

// 404 catch-all for unknown routes
app.use(notFoundHandler);

// Global error handler middleware
app.use(errorHandler);

module.exports = app;
