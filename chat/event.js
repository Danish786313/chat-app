const eventController = require("./eventController.js");
const { catchAsync } = require("../utils/util.js");
const logger = require('../utils/logger.js');

module.exports = (socket, io) => {
    const controller = eventController(socket, io);
    
    logger.info('Setting up socket event listeners', { socketId: socket.id });
    
    // Core chat events
    socket.on("register", catchAsync(controller.register));
    socket.on("joinChat", catchAsync(controller.joinChat));
    socket.on("leaveChat", catchAsync(controller.leaveChat));
    socket.on("sendMessage", catchAsync(controller.sendMessage));
    socket.on("deleteMessage", catchAsync(controller.deleteMessage));
    
    // Real-time interaction events
    socket.on("startTyping", catchAsync(controller.startTyping));
    socket.on("stopTyping", catchAsync(controller.stopTyping));
    
    // Connection events
    socket.on('disconnect', (reason) => {
        logger.info('Client disconnected', { 
            socketId: socket.id, 
            userId: socket.userId,
            reason 
        });
    });
    
    socket.on('error', (error) => {
        logger.error('Socket error', { 
            socketId: socket.id, 
            userId: socket.userId,
            error: error.message 
        });
    });
};