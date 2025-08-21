const { Server } = require("socket.io");
const { createAdapter } = require("@socket.io/redis-adapter");
const { createRedisClient } = require("./utils/redis");
const logger = require('./utils/logger');

module.exports = async function (server) {
  const io = new Server(server, {
    cors: {
      origin: process.env.NODE_ENV === 'production' ? false : "*",
      methods: ["GET", "POST"]
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000
  });

  try {
    // Set up Redis adapter for clustering
    const pubClient = await createRedisClient();
    const subClient = pubClient.duplicate();
    await subClient.connect();
    
    io.adapter(createAdapter(pubClient, subClient));
    logger.info('Redis adapter configured for Socket.IO clustering');
  } catch (error) {
    logger.error('Failed to setup Redis adapter:', error);
    // Continue without Redis adapter in development
    if (process.env.NODE_ENV === 'production') {
      throw error;
    }
  }

  // Middleware for authentication and logging
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    // Add your authentication logic here
    logger.info('New socket connection attempt', { 
      socketId: socket.id,
      token: token ? 'provided' : 'missing'
    });
    next();
  });

  io.on("connection", (socket) => {
    logger.info("New client connected", { 
      socketId: socket.id,
      serverId: process.env.SERVER_ID || process.pid
    });

    // Load event handlers
    require("./chat/event")(socket, io);
    
    // Track connection metrics
    socket.on('disconnect', () => {
      logger.info("Client disconnected", { 
        socketId: socket.id,
        userId: socket.userId,
        serverId: process.env.SERVER_ID || process.pid
      });
    });
  });

  return io;
};