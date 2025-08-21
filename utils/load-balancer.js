const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const logger = require('./logger');

const app = express();
const LOAD_BALANCER_PORT = process.env.LOAD_BALANCER_PORT || 3000;

// Parse server instances from environment or use defaults
const serverInstances = process.env.SERVER_INSTANCES 
  ? process.env.SERVER_INSTANCES.split(',').map(port => `http://localhost:${port.trim()}`)
  : [
    'http://localhost:5400',
    'http://localhost:5401', 
    'http://localhost:5402'
  ];

let currentServerIndex = 0;

// Round-robin load balancing
const getNextServer = () => {
  const server = serverInstances[currentServerIndex];
  currentServerIndex = (currentServerIndex + 1) % serverInstances.length;
  return server;
};

// Health check for servers
const serverHealth = new Map();
serverInstances.forEach(server => serverHealth.set(server, true));

const checkServerHealth = async (server) => {
  try {
    const response = await fetch(`${server}/health`);
    const healthy = response.status === 200;
    serverHealth.set(server, healthy);
    return healthy;
  } catch (error) {
    serverHealth.set(server, false);
    return false;
  }
};

// Health check interval
setInterval(async () => {
  for (const server of serverInstances) {
    await checkServerHealth(server);
  }
  
  const healthyServers = Array.from(serverHealth.entries())
    .filter(([_, healthy]) => healthy)
    .map(([server, _]) => server);
    
  logger.info('Server health check completed', {
    totalServers: serverInstances.length,
    healthyServers: healthyServers.length,
    unhealthyServers: serverInstances.length - healthyServers.length
  });
}, 30000); // Check every 30 seconds

// Load balancer middleware
app.use('/', (req, res, next) => {
  // Get healthy servers only
  const healthyServers = serverInstances.filter(server => serverHealth.get(server));
  
  if (healthyServers.length === 0) {
    logger.error('No healthy servers available');
    return res.status(503).json({
      error: 'Service Unavailable',
      message: 'No healthy servers available'
    });
  }
  
  // Simple round-robin among healthy servers
  const targetServer = healthyServers[currentServerIndex % healthyServers.length];
  currentServerIndex++;
  
  logger.info('Proxying request', {
    method: req.method,
    url: req.url,
    targetServer,
    clientIP: req.ip
  });
  
  const proxy = createProxyMiddleware({
    target: targetServer,
    changeOrigin: true,
    ws: true, // Enable WebSocket proxying
    onError: (err, req, res) => {
      logger.error('Proxy error:', {
        error: err.message,
        targetServer,
        url: req.url
      });
      
      // Mark server as unhealthy
      serverHealth.set(targetServer, false);
      
      res.status(502).json({
        error: 'Bad Gateway',
        message: 'Server temporarily unavailable'
      });
    },
    onProxyReq: (proxyReq, req, res) => {
      logger.debug('Proxy request', {
        method: req.method,
        url: req.url,
        target: targetServer
      });
    }
  });
  
  proxy(req, res, next);
});

app.listen(LOAD_BALANCER_PORT, () => {
  logger.info(`Load Balancer running on port ${LOAD_BALANCER_PORT}`, {
    port: LOAD_BALANCER_PORT,
    serverInstances,
    strategy: 'round-robin'
  });
});
