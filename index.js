require('dotenv').config();
const http = require("http");
const express = require("express");
const cors = require('cors');
const logger = require('./utils/logger');

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    server_id: process.env.SERVER_ID || process.pid,
    uptime: process.uptime()
  });
});

// Basic route
app.use("/", (req, res) => {
    res.json({
        message: "Scalable Chat Server is running!",
        server_id: process.env.SERVER_ID || process.pid,
        timestamp: new Date().toISOString()
    });
});

// Initialize database and socket
const initializeServer = async () => {
  try {
    // Connect to database
    
    // Initialize Socket.IO
    await require("./socket")(server);
    
    const PORT = process.env.PORT || 5400;
    
    server.listen(PORT, () => {
      logger.info(`Server running on http://localhost:${PORT}`, {
        port: PORT,
        nodeEnv: process.env.NODE_ENV,
        serverId: process.env.SERVER_ID || process.pid
      });
    });
  } catch (error) {
    logger.error('Failed to initialize server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

initializeServer();
