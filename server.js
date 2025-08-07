const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

// Import route modules
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const rewardRoutes = require('./routes/rewardRoutes');

// Initialize app
const app = express();

// Middleware
app.use(cors());
app.use(express.json()); // Body parser for JSON
app.use(express.urlencoded({ extended: true })); // For URL encoded bodies (optional)
app.use(morgan('dev')); // HTTP request logger (useful in dev)

// Mount routes under /api base path
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/rewards', rewardRoutes);

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ status: 'E-commerce Blockchain Backend is running' });
});

// Centralized error handler middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Internal Server Error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

// Export app for server or tests
module.exports = app;
