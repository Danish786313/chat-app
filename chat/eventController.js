const { sendResponse, emitToUser, emitToRoom, addToMessageQueue, addToNotificationQueue } = require("../utils/util");
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

const LISTENER = {
    RECEIVE_MESSAGE: 'receive_message',
    CHAT_LIST: 'chat_list',
    READ_STATUS: 'read_status',
    MESSAGE_DELETED: 'message_deleted',
    USER_JOINED: 'user_joined',
    USER_LEFT: 'user_left',
    TYPING_START: 'typing_start',
    TYPING_STOP: 'typing_stop'
};

module.exports = (socket, io) => {
    return {
        register: async function ({ user_id }, ackCallback) {
            logger.info("User registration initiated", { userId: user_id, socketId: socket.id });
            
            if (!user_id) throw new Error("User Id is required.");
            
            // Join user-specific room for direct messaging
            socket.join(`user_${user_id}`);
            socket.userId = user_id;
            
            const resObj = {
                socket_id: socket.id,
                user_id: user_id,
                server_id: process.env.SERVER_ID || process.pid
            };
            
            logger.info("User registered successfully", { 
                userId: user_id, 
                socketId: socket.id,
                serverId: resObj.server_id
            });
            
            sendResponse(ackCallback, "User registered successfully.", resObj);
        },

        joinChat: async function ({ chat_id }, cb) {
            logger.info("User joining chat", { chatId: chat_id, socketId: socket.id, userId: socket.userId });
            
            if (!chat_id) throw new Error("Chat Id is required.");
            if (!socket.userId) throw new Error("User must be registered first.");
            
            const roomName = `chat_${chat_id}`;
            socket.join(roomName);
            
            // Notify other users in the chat
            socket.to(roomName).emit(LISTENER.USER_JOINED, {
                user_id: socket.userId,
                chat_id: chat_id,
                timestamp: new Date().toISOString()
            });
            
            const resObj = {
                room_name: roomName,
                chat_id: chat_id,
                user_id: socket.userId
            };
            
            logger.info("User joined chat successfully", { 
                chatId: chat_id, 
                userId: socket.userId, 
                roomName 
            });
            
            sendResponse(cb, "Chat joined successfully.", resObj);
        },

        leaveChat: async function ({ chat_id }, cb) {
            logger.info("User leaving chat", { chatId: chat_id, socketId: socket.id, userId: socket.userId });
            
            if (!chat_id) throw new Error("Chat Id is required.");
            if (!socket.userId) throw new Error("User must be registered first.");
            
            const roomName = `chat_${chat_id}`;
            socket.leave(roomName);
            
            // Notify other users in the chat
            socket.to(roomName).emit(LISTENER.USER_LEFT, {
                user_id: socket.userId,
                chat_id: chat_id,
                timestamp: new Date().toISOString()
            });
            
            const resObj = {
                room_name: roomName,
                chat_id: chat_id,
                user_id: socket.userId,
                message: "Chat left successfully."
            };
            
            logger.info("User left chat successfully", { 
                chatId: chat_id, 
                userId: socket.userId, 
                roomName 
            });
            
            sendResponse(cb, "Chat left successfully.", resObj);
        },

        sendMessage: async function ({ user_id, chat_id, participants = [], data: dataObj, message_type = 'text' }, cb) {
            logger.info("Message sending initiated", { 
                userId: user_id, 
                chatId: chat_id, 
                participantCount: participants.length,
                messageType: message_type
            });
            
            if (!chat_id) throw new Error("Chat Id is required.");
            if (!user_id) throw new Error("User id is required.");
            if (!participants || !Array.isArray(participants)) throw new Error("Participants is required and must be an array.");
            if (!dataObj) throw new Error("Message data is required.");

            const messageId = uuidv4();
            const timestamp = new Date();
            
            const messageData = {
                id: messageId,
                chatId: chat_id,
                userId: user_id,
                content: dataObj,
                messageType: message_type,
                timestamp: timestamp,
                server_id: process.env.SERVER_ID || process.pid
            };

            // Emit to chat room immediately for real-time experience
            const roomName = `chat_${chat_id}`;
            emitToRoom(io, roomName, LISTENER.RECEIVE_MESSAGE, {
                success: true,
                message: "Message received successfully.",
                data: messageData
            });

            // Update chat list for all participants
            const chatListUpdate = {
                success: true,
                message: "Chat list updated successfully.",
                data: {
                    chat_id: chat_id,
                    last_message: messageData,
                    updated_at: timestamp
                }
            };

            participants.forEach(userId => {
                emitToUser(io, userId, LISTENER.CHAT_LIST, chatListUpdate);
            });

            // Add background jobs for persistence and notifications
            try {
                await addToMessageQueue('saveMessage', { messageData });
                await addToMessageQueue('updateChatList', { chatId: chat_id, participants });
                
                // Send push notifications to offline users
                const offlineUsers = participants.filter(userId => userId !== user_id);
                if (offlineUsers.length > 0) {
                    await addToNotificationQueue('sendPushNotification', {
                        userIds: offlineUsers,
                        message: `New message in chat ${chat_id}`,
                        type: 'new_message',
                        data: messageData
                    });
                }
            } catch (queueError) {
                logger.error('Error adding jobs to queue:', queueError);
                // Don't fail the request, just log the error
            }

            const resObj = {
                ...messageData,
                queued_for_processing: true
            };
            
            logger.info("Message sent successfully", { 
                messageId, 
                chatId: chat_id, 
                userId: user_id,
                participantCount: participants.length
            });
            
            sendResponse(cb, "Message sent successfully", resObj);
        },

        deleteMessage: async function ({ message_id, chat_id, user_id, delete_for_everyone = false, data: dataObj }, cb) {
            logger.info("Message deletion initiated", { 
                messageId: message_id, 
                chatId: chat_id, 
                userId: user_id,
                deleteForEveryone: delete_for_everyone
            });
            
            if (!message_id || !chat_id || !user_id) {
                throw new Error("Message ID, Chat ID and User ID are required.");
            }
            
            const deleteData = {
                message_id: message_id,
                deleted_by: user_id,
                deleted_at: new Date(),
                chat_id: chat_id,
                delete_for_everyone: delete_for_everyone,
                data: dataObj,
                server_id: process.env.SERVER_ID || process.pid
            };
            
            // Emit to chat room
            const roomName = `chat_${chat_id}`;
            emitToRoom(io, roomName, LISTENER.MESSAGE_DELETED, {
                success: true,
                message: "Message deleted successfully.",
                data: deleteData
            });

            // Add background job for database update
            try {
                await addToMessageQueue('deleteMessage', { 
                    messageId: message_id,
                    deletedBy: user_id,
                    deleteForEveryone: delete_for_everyone,
                    chatId: chat_id
                });
            } catch (queueError) {
                logger.error('Error adding delete job to queue:', queueError);
            }
            
            logger.info("Message deleted successfully", { 
                messageId: message_id, 
                chatId: chat_id, 
                userId: user_id 
            });
            
            sendResponse(cb, "Message deleted successfully", deleteData);
        },

        // Additional real-time features
        startTyping: async function ({ chat_id, user_id }, cb) {
            if (!chat_id || !user_id) throw new Error("Chat ID and User ID are required.");
            
            const roomName = `chat_${chat_id}`;
            socket.to(roomName).emit(LISTENER.TYPING_START, {
                user_id: user_id,
                chat_id: chat_id,
                timestamp: new Date().toISOString()
            });
            
            logger.debug("User started typing", { chatId: chat_id, userId: user_id });
            if (cb) sendResponse(cb, "Typing status updated");
        },

        stopTyping: async function ({ chat_id, user_id }, cb) {
            if (!chat_id || !user_id) throw new Error("Chat ID and User ID are required.");
            
            const roomName = `chat_${chat_id}`;
            socket.to(roomName).emit(LISTENER.TYPING_STOP, {
                user_id: user_id,
                chat_id: chat_id,
                timestamp: new Date().toISOString()
            });
            
            logger.debug("User stopped typing", { chatId: chat_id, userId: user_id });
            if (cb) sendResponse(cb, "Typing status updated");
        }
    };
};