const cluster = require('cluster');
const os = require('os');
const logger = require('./logger.js');

const numCPUs = os.cpus().length;
const numWorkers = process.env.CLUSTER_WORKERS || Math.min(numCPUs, 4);

if (cluster.isMaster) {
  logger.info(`Master ${process.pid} is running`);
  logger.info(`Starting ${numWorkers} workers`);

  // Fork workers
  for (let i = 0; i < numWorkers; i++) {
    const worker = cluster.fork({
      SERVER_ID: `worker_${i + 1}`,
      PORT: parseInt(process.env.PORT || 5400) + i
    });
    
    logger.info(`Worker ${worker.process.pid} started on port ${parseInt(process.env.PORT || 5400) + i}`);
  }

  cluster.on('exit', (worker, code, signal) => {
    logger.error(`Worker ${worker.process.pid} died with code ${code} and signal ${signal}`);
    logger.info('Starting a new worker...');
    
    const newWorker = cluster.fork({
      SERVER_ID: `worker_${Date.now()}`,
      PORT: worker.env.PORT || parseInt(process.env.PORT || 5400)
    });
    
    logger.info(`New worker ${newWorker.process.pid} started`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('Master received SIGTERM, shutting down workers...');
    
    for (const id in cluster.workers) {
      cluster.workers[id].kill();
    }
  });

} else {
  // Worker process - run the actual server
  require('./index.js');
  logger.info(`Worker ${process.pid} started with SERVER_ID: ${process.env.SERVER_ID}`);
}