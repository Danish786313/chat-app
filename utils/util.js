const logger = require('./logger');
const { messageQueue, notificationQueue } = require('./messageQueue');

module.exports = {
    sendResponse: (socketOrCallback, message, data = null) => {
        const payload = {
            success: true,
            message: message,
            data: data,
            timestamp: new Date().toISOString(),
            server_id: process.env.SERVER_ID || process.pid
        };

        try {
            // If ack callback was passed directly
            if (typeof socketOrCallback === 'function') {
                socketOrCallback(payload);
            }
            // If socket and event name were passed
            else if (socketOrCallback && typeof socketOrCallback.emit === 'function') {
                socketOrCallback.emit('response', payload);
            }
            
            logger.info('Response sent', { 
                message, 
                hasData: !!data,
                serverId: payload.server_id
            });
        } catch (error) {
            logger.error('Error sending response:', error);
        }
    },

    emitToUser: (io, userId, event, payload) => {
        try {
            io.to(`user_${userId}`).emit(event, {
                ...payload,
                timestamp: new Date().toISOString(),
                server_id: process.env.SERVER_ID || process.pid
            });
            
            logger.info('Event emitted to user', { 
                userId, 
                event,
                serverId: process.env.SERVER_ID || process.pid
            });
            return true;
        } catch (error) {
            logger.error('Error emitting to user:', { userId, event, error: error.message });
            return false;
        }
    },

    emitToRoom: (io, roomId, event, payload) => {
        try {
            io.to(roomId).emit(event, {
                ...payload,
                timestamp: new Date().toISOString(),
                server_id: process.env.SERVER_ID || process.pid
            });
            
            logger.info('Event emitted to room', { 
                roomId, 
                event,
                serverId: process.env.SERVER_ID || process.pid
            });
            return true;
        } catch (error) {
            logger.error('Error emitting to room:', { roomId, event, error: error.message });
            return false;
        }
    },

    handleSocketError: (socket, errorEvent, error) => {
        logger.error('[Socket Error]', { 
            socketId: socket.id, 
            errorEvent, 
            error: error.message,
            stack: error.stack
        });

        socket.emit(errorEvent, {
            success: false,
            error: error.message || 'Something went wrong',
            timestamp: new Date().toISOString(),
            server_id: process.env.SERVER_ID || process.pid
        });
    },

    catchAsync: (fn) => {
        return async function (...args) {
            const ackCallback = typeof args[args.length - 1] === "function" ? args[args.length - 1] : null;

            try {
                await fn.apply(this, args);
            } catch (err) {
                logger.error("Socket async error:", { 
                    error: err.message,
                    stack: err.stack,
                    socketId: this.id
                });
                
                if (ackCallback) {
                    ackCallback({
                        success: false,
                        status: "error",
                        message: err.message || "Unexpected error",
                        timestamp: new Date().toISOString(),
                        server_id: process.env.SERVER_ID || process.pid
                    });
                }
            }
        };
    },

    // Queue management utilities
    addToMessageQueue: async (jobType, data, options = {}) => {
        try {
            const job = await messageQueue.add(jobType, data, {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 2000,
                },
                ...options
            });
            
            logger.info('Job added to message queue', { 
                jobId: job.id, 
                jobType, 
                data: JSON.stringify(data)
            });
            
            return job;
        } catch (error) {
            logger.error('Error adding job to message queue:', { 
                jobType, 
                error: error.message 
            });
            throw error;
        }
    },

    addToNotificationQueue: async (jobType, data, options = {}) => {
        try {
            const job = await notificationQueue.add(jobType, data, {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 2000,
                },
                ...options
            });
            
            logger.info('Job added to notification queue', { 
                jobId: job.id, 
                jobType, 
                data: JSON.stringify(data)
            });
            
            return job;
        } catch (error) {
            logger.error('Error adding job to notification queue:', { 
                jobType, 
                error: error.message 
            });
            throw error;
        }
    }
};