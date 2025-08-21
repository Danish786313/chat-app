// socketEvents.js
const eventController = require("./eventController");
const { catchAsync } = require("./utils/util");

module.exports = (socket, io) => {
    const controller = eventController(socket, io);
    
    // User Management
    socket.on("register", catchAsync(controller.register));
    socket.on("disconnect", catchAsync(controller.disconnect));
    socket.on("getUserStatus", catchAsync(controller.getUserStatus));
    socket.on("updateUserStatus", catchAsync(controller.updateUserStatus));
    
    // Chat Room Management
    socket.on("joinChat", catchAsync(controller.joinChat));
    socket.on("leaveChat", catchAsync(controller.leaveChat));
    socket.on("createGroupChat", catchAsync(controller.createGroupChat));
    socket.on("addParticipant", catchAsync(controller.addParticipant));
    socket.on("removeParticipant", catchAsync(controller.removeParticipant));
    socket.on("updateGroupInfo", catchAsync(controller.updateGroupInfo));
    
    // Message Management
    socket.on("sendMessage", catchAsync(controller.sendMessage));
    socket.on("editMessage", catchAsync(controller.editMessage));
    socket.on("deleteMessage", catchAsync(controller.deleteMessage));
    socket.on("forwardMessage", catchAsync(controller.forwardMessage));
    socket.on("replyToMessage", catchAsync(controller.replyToMessage));
    
    // Message Status
    socket.on("messageDelivered", catchAsync(controller.messageDelivered));
    socket.on("messageRead", catchAsync(controller.messageRead));
    socket.on("markAsRead", catchAsync(controller.markAsRead));
    
    // Typing Indicators
    socket.on("typing", catchAsync(controller.typing));
    socket.on("stopTyping", catchAsync(controller.stopTyping));
    
    // Media & Files
    socket.on("sendMediaMessage", catchAsync(controller.sendMediaMessage));
    socket.on("sendDocument", catchAsync(controller.sendDocument));
    socket.on("sendLocation", catchAsync(controller.sendLocation));
    socket.on("sendContact", catchAsync(controller.sendContact));
    
    // Voice & Video
    socket.on("sendVoiceMessage", catchAsync(controller.sendVoiceMessage));
    socket.on("startVoiceCall", catchAsync(controller.startVoiceCall));
    socket.on("startVideoCall", catchAsync(controller.startVideoCall));
    socket.on("endCall", catchAsync(controller.endCall));
    socket.on("callResponse", catchAsync(controller.callResponse));
    
    // Message Reactions
    socket.on("addReaction", catchAsync(controller.addReaction));
    socket.on("removeReaction", catchAsync(controller.removeReaction));
    
    // Chat Management
    socket.on("getChatList", catchAsync(controller.getChatList));
    socket.on("getChatHistory", catchAsync(controller.getChatHistory));
    socket.on("searchMessages", catchAsync(controller.searchMessages));
    socket.on("muteChat", catchAsync(controller.muteChat));
    socket.on("unmuteChat", catchAsync(controller.unmuteChat));
    socket.on("archiveChat", catchAsync(controller.archiveChat));
    socket.on("unarchiveChat", catchAsync(controller.unarchiveChat));
    socket.on("pinChat", catchAsync(controller.pinChat));
    socket.on("unpinChat", catchAsync(controller.unpinChat));
    socket.on("clearChat", catchAsync(controller.clearChat));
    socket.on("deleteChat", catchAsync(controller.deleteChat));
    
    // Broadcast & Stories
    socket.on("sendBroadcast", catchAsync(controller.sendBroadcast));
    socket.on("viewStory", catchAsync(controller.viewStory));
    socket.on("postStory", catchAsync(controller.postStory));
};

// eventController.js
const { sendResponse, catchAsync } = require("./utils/util");

const RES_OBJ = {
    "success": true,
    "message": "message not found",
    "data": null
}

const LISTENER = {
    RECEIVE_MESSAGE: 'receive_message',
    CHAT_LIST: 'chat_list',
    READ_STATUS: 'read_status',
    USER_STATUS: 'user_status',
    TYPING: 'typing',
    STOP_TYPING: 'stop_typing',
    MESSAGE_DELIVERED: 'message_delivered',
    MESSAGE_READ: 'message_read',
    MESSAGE_EDITED: 'message_edited',
    MESSAGE_DELETED: 'message_deleted',
    REACTION_ADDED: 'reaction_added',
    REACTION_REMOVED: 'reaction_removed',
    GROUP_CREATED: 'group_created',
    PARTICIPANT_ADDED: 'participant_added',
    PARTICIPANT_REMOVED: 'participant_removed',
    GROUP_INFO_UPDATED: 'group_info_updated',
    CALL_INCOMING: 'call_incoming',
    CALL_ACCEPTED: 'call_accepted',
    CALL_DECLINED: 'call_declined',
    CALL_ENDED: 'call_ended',
    CHAT_MUTED: 'chat_muted',
    CHAT_ARCHIVED: 'chat_archived',
    STORY_POSTED: 'story_posted',
    BROADCAST_RECEIVED: 'broadcast_received'
}

module.exports = (socket, io) => {
    return {
        // Existing methods
        register: async function ({ user_id }, ackCallback) {
            const socket = this;
            if (!user_id) throw new Error("User Id is required.");
            
            socket.join(`user_${user_id}`);
            socket.user_id = user_id; // Store user_id in socket
            
            const resObj = {
                socket_id: socket.id,
                user_id: user_id
            }
            sendResponse(ackCallback, "User registered successfully.", resObj);
        },

        disconnect: async function () {
            const socket = this;
            if (socket.user_id) {
                // Notify contacts about user going offline
                io.emit(LISTENER.USER_STATUS, {
                    user_id: socket.user_id,
                    status: 'offline',
                    last_seen: new Date()
                });
            }
        },

        joinChat: async function ({ chat_id }, cb) {
            if (!chat_id) throw new Error("Chat Id is required.");
            const roomName = chat_id;
            socket.join(roomName);
            const resObj = {
                room_name: roomName,
            }
            sendResponse(cb, "Chat joined successfully.", resObj);
        },

        leaveChat: async function ({ chat_id }, cb) {
            if (!chat_id) throw new Error("Chat Id is required.");
            const roomName = chat_id;
            socket.leave(roomName);
            const resObj = {
                room_name: roomName,
                message: "Chat left successfully."
            }
            sendResponse(cb, "Chat left successfully.", resObj);
        },

        sendMessage: async function ({ user_id, chat_id, participants = [], data: dataObj }, cb) {
            const socket = this;
            if (!chat_id) throw new Error("Chat Id is required.");
            if (!user_id) throw new Error("User id is required.");
            if (!participants || !Array.isArray(participants)) throw new Error("Participants is required.");

            const messageData = {
                ...dataObj,
                message_id: `msg_${Date.now()}_${Math.random()}`,
                timestamp: new Date(),
                sender_id: user_id,
                chat_id: chat_id,
                status: 'sent'
            };

            // Send message to chat room
            io.to(chat_id).emit(LISTENER.RECEIVE_MESSAGE, {
                success: true,
                message: "Message received successfully.",
                data: messageData
            });

            // Update chat list for all participants
            participants.forEach(userId => {
                io.to(`user_${userId}`).emit(LISTENER.CHAT_LIST, {
                    success: true,
                    message: "Chat list updated successfully.",
                    data: {
                        chat_id: chat_id,
                        last_message: messageData,
                        timestamp: messageData.timestamp
                    }
                });
            });

            sendResponse(cb, "Message sent successfully", messageData);
        },

        // New methods
        typing: async function ({ user_id, chat_id }, cb) {
            if (!chat_id || !user_id) throw new Error("Chat Id and User Id are required.");
            
            socket.to(chat_id).emit(LISTENER.TYPING, {
                user_id: user_id,
                chat_id: chat_id,
                timestamp: new Date()
            });
            
            sendResponse(cb, "Typing indicator sent", { user_id, chat_id });
        },

        stopTyping: async function ({ user_id, chat_id }, cb) {
            if (!chat_id || !user_id) throw new Error("Chat Id and User Id are required.");
            
            socket.to(chat_id).emit(LISTENER.STOP_TYPING, {
                user_id: user_id,
                chat_id: chat_id,
                timestamp: new Date()
            });
            
            sendResponse(cb, "Stop typing indicator sent", { user_id, chat_id });
        },

        messageRead: async function ({ message_ids, chat_id, user_id }, cb) {
            if (!message_ids || !chat_id || !user_id) throw new Error("Message IDs, Chat ID and User ID are required.");
            
            io.to(chat_id).emit(LISTENER.MESSAGE_READ, {
                message_ids: message_ids,
                read_by: user_id,
                read_at: new Date(),
                chat_id: chat_id
            });
            
            sendResponse(cb, "Messages marked as read", { message_ids, chat_id });
        },

        messageDelivered: async function ({ message_ids, chat_id, user_id }, cb) {
            if (!message_ids || !chat_id || !user_id) throw new Error("Message IDs, Chat ID and User ID are required.");
            
            io.to(chat_id).emit(LISTENER.MESSAGE_DELIVERED, {
                message_ids: message_ids,
                delivered_to: user_id,
                delivered_at: new Date(),
                chat_id: chat_id
            });
            
            sendResponse(cb, "Messages marked as delivered", { message_ids, chat_id });
        },

        editMessage: async function ({ message_id, chat_id, new_content, user_id }, cb) {
            if (!message_id || !chat_id || !new_content || !user_id) {
                throw new Error("Message ID, Chat ID, new content and User ID are required.");
            }
            
            const editedMessage = {
                message_id: message_id,
                new_content: new_content,
                edited_by: user_id,
                edited_at: new Date(),
                chat_id: chat_id
            };
            
            io.to(chat_id).emit(LISTENER.MESSAGE_EDITED, editedMessage);
            sendResponse(cb, "Message edited successfully", editedMessage);
        },

        deleteMessage: async function ({ message_id, chat_id, user_id, delete_for_everyone = false }, cb) {
            if (!message_id || !chat_id || !user_id) {
                throw new Error("Message ID, Chat ID and User ID are required.");
            }
            
            const deleteData = {
                message_id: message_id,
                deleted_by: user_id,
                deleted_at: new Date(),
                chat_id: chat_id,
                delete_for_everyone: delete_for_everyone
            };
            
            io.to(chat_id).emit(LISTENER.MESSAGE_DELETED, deleteData);
            sendResponse(cb, "Message deleted successfully", deleteData);
        },

        addReaction: async function ({ message_id, chat_id, user_id, emoji }, cb) {
            if (!message_id || !chat_id || !user_id || !emoji) {
                throw new Error("Message ID, Chat ID, User ID and emoji are required.");
            }
            
            const reactionData = {
                message_id: message_id,
                user_id: user_id,
                emoji: emoji,
                chat_id: chat_id,
                timestamp: new Date()
            };
            
            io.to(chat_id).emit(LISTENER.REACTION_ADDED, reactionData);
            sendResponse(cb, "Reaction added successfully", reactionData);
        },

        removeReaction: async function ({ message_id, chat_id, user_id, emoji }, cb) {
            if (!message_id || !chat_id || !user_id || !emoji) {
                throw new Error("Message ID, Chat ID, User ID and emoji are required.");
            }
            
            const reactionData = {
                message_id: message_id,
                user_id: user_id,
                emoji: emoji,
                chat_id: chat_id,
                timestamp: new Date()
            };
            
            io.to(chat_id).emit(LISTENER.REACTION_REMOVED, reactionData);
            sendResponse(cb, "Reaction removed successfully", reactionData);
        },

        createGroupChat: async function ({ group_name, participants, created_by, group_image }, cb) {
            if (!group_name || !participants || !created_by) {
                throw new Error("Group name, participants and creator are required.");
            }
            
            const group_id = `group_${Date.now()}_${Math.random()}`;
            const groupData = {
                group_id: group_id,
                group_name: group_name,
                participants: participants,
                created_by: created_by,
                created_at: new Date(),
                group_image: group_image
            };
            
            // Add all participants to the group room
            participants.forEach(userId => {
                io.to(`user_${userId}`).emit(LISTENER.GROUP_CREATED, groupData);
            });
            
            sendResponse(cb, "Group created successfully", groupData);
        },

        startVoiceCall: async function ({ caller_id, receiver_id, chat_id }, cb) {
            if (!caller_id || !receiver_id) throw new Error("Caller ID and Receiver ID are required.");
            
            const callData = {
                call_id: `call_${Date.now()}_${Math.random()}`,
                caller_id: caller_id,
                receiver_id: receiver_id,
                chat_id: chat_id,
                call_type: 'voice',
                timestamp: new Date()
            };
            
            io.to(`user_${receiver_id}`).emit(LISTENER.CALL_INCOMING, callData);
            sendResponse(cb, "Voice call initiated", callData);
        },

        startVideoCall: async function ({ caller_id, receiver_id, chat_id }, cb) {
            if (!caller_id || !receiver_id) throw new Error("Caller ID and Receiver ID are required.");
            
            const callData = {
                call_id: `call_${Date.now()}_${Math.random()}`,
                caller_id: caller_id,
                receiver_id: receiver_id,
                chat_id: chat_id,
                call_type: 'video',
                timestamp: new Date()
            };
            
            io.to(`user_${receiver_id}`).emit(LISTENER.CALL_INCOMING, callData);
            sendResponse(cb, "Video call initiated", callData);
        },

        callResponse: async function ({ call_id, response, user_id }, cb) {
            if (!call_id || !response || !user_id) throw new Error("Call ID, response and User ID are required.");
            
            const responseData = {
                call_id: call_id,
                response: response, // 'accepted' or 'declined'
                responded_by: user_id,
                timestamp: new Date()
            };
            
            const eventName = response === 'accepted' ? LISTENER.CALL_ACCEPTED : LISTENER.CALL_DECLINED;
            io.emit(eventName, responseData);
            
            sendResponse(cb, `Call ${response}`, responseData);
        },

        getUserStatus: async function ({ user_id }, cb) {
            if (!user_id) throw new Error("User ID is required.");
            
            // This would typically fetch from database
            const statusData = {
                user_id: user_id,
                status: 'online', // online, offline, away
                last_seen: new Date()
            };
            
            sendResponse(cb, "User status retrieved", statusData);
        },

        updateUserStatus: async function ({ user_id, status }, cb) {
            if (!user_id || !status) throw new Error("User ID and status are required.");
            
            const statusData = {
                user_id: user_id,
                status: status,
                timestamp: new Date()
            };
            
            io.emit(LISTENER.USER_STATUS, statusData);
            sendResponse(cb, "User status updated", statusData);
        },

        sendMediaMessage: async function ({ user_id, chat_id, participants, media_type, media_url, caption, thumbnail }, cb) {
            if (!chat_id || !user_id || !media_type || !media_url) {
                throw new Error("Chat ID, User ID, media type and media URL are required.");
            }
            
            const messageData = {
                message_id: `msg_${Date.now()}_${Math.random()}`,
                sender_id: user_id,
                chat_id: chat_id,
                message_type: 'media',
                media_type: media_type, // image, video, audio
                media_url: media_url,
                caption: caption,
                thumbnail: thumbnail,
                timestamp: new Date(),
                status: 'sent'
            };
            
            io.to(chat_id).emit(LISTENER.RECEIVE_MESSAGE, {
                success: true,
                message: "Media message received",
                data: messageData
            });
            
            sendResponse(cb, "Media message sent successfully", messageData);
        },

        getChatList: async function ({ user_id }, cb) {
            if (!user_id) throw new Error("User ID is required.");
            
            // This would typically fetch from database
            const chatList = {
                user_id: user_id,
                chats: [], // Array of chat objects
                timestamp: new Date()
            };
            
            sendResponse(cb, "Chat list retrieved", chatList);
        },

        muteChat: async function ({ chat_id, user_id, duration }, cb) {
            if (!chat_id || !user_id) throw new Error("Chat ID and User ID are required.");
            
            const muteData = {
                chat_id: chat_id,
                muted_by: user_id,
                muted_until: duration ? new Date(Date.now() + duration * 60000) : null, // duration in minutes
                timestamp: new Date()
            };
            
            io.to(`user_${user_id}`).emit(LISTENER.CHAT_MUTED, muteData);
            sendResponse(cb, "Chat muted successfully", muteData);
        },

        // Additional methods can be implemented similarly...
        markAsRead: async function ({ chat_id, user_id, last_message_id }, cb) {
            if (!chat_id || !user_id) throw new Error("Chat ID and User ID are required.");
            
            const readData = {
                chat_id: chat_id,
                read_by: user_id,
                last_message_id: last_message_id,
                read_at: new Date()
            };
            
            io.to(chat_id).emit(LISTENER.READ_STATUS, readData);
            sendResponse(cb, "Chat marked as read", readData);
        },

        forwardMessage: async function ({ original_message_id, target_chat_ids, user_id }, cb) {
            if (!original_message_id || !target_chat_ids || !user_id) {
                throw new Error("Original message ID, target chat IDs and User ID are required.");
            }
            
            const forwardData = {
                original_message_id: original_message_id,
                forwarded_by: user_id,
                target_chats: target_chat_ids,
                timestamp: new Date()
            };
            
            target_chat_ids.forEach(chatId => {
                io.to(chatId).emit(LISTENER.RECEIVE_MESSAGE, {
                    success: true,
                    message: "Forwarded message received",
                    data: {
                        ...forwardData,
                        message_type: 'forwarded',
                        chat_id: chatId
                    }
                });
            });
            
            sendResponse(cb, "Message forwarded successfully", forwardData);
        }
    };
};