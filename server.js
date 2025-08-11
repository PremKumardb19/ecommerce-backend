const http = require('http');
const app = require('./app');
const { connectDB } = require('./config/dbConfig');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 5000;

// Connect to database
connectDB()
  .then(() => {
    const server = http.createServer(app);

    server.listen(PORT, () => {
      logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    });
  })
  .catch((err) => {
    logger.error('Failed to connect to database:', err);
    process.exit(1);
  });
