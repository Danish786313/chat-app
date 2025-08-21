const Queue = require('bull');
const logger = require('./logger');

// Create different queues for different types of jobs
const messageQueue = new Queue('message processing', {
  redis: {
    port: process.env.REDIS_PORT || 6379,
    host: process.env.REDIS_HOST || 'localhost',
    password: process.env.REDIS_PASSWORD || undefined,
  }
});

const notificationQueue = new Queue('notifications', {
  redis: {
    port: process.env.REDIS_PORT || 6379,
    host: process.env.REDIS_HOST || 'localhost',
    password: process.env.REDIS_PASSWORD || undefined,
  }
});

// Message processing jobs
messageQueue.process('saveMessage', async (job) => {
  const { messageData } = job.data;
  logger.info('Processing message save job', { messageId: messageData.id });
  
  // Simulate database save operation
  // In real implementation, save to your database
  await new Promise(resolve => setTimeout(resolve, 100));
  
  logger.info('Message saved successfully', { messageId: messageData.id });
  return { status: 'saved', messageId: messageData.id };
});

messageQueue.process('updateChatList', async (job) => {
  const { chatId, participants } = job.data;
  logger.info('Processing chat list update', { chatId });
  
  // Update chat list for all participants
  // In real implementation, update user chat lists in database
  await new Promise(resolve => setTimeout(resolve, 50));
  
  logger.info('Chat list updated', { chatId, participants: participants.length });
  return { status: 'updated', chatId };
});

// Notification processing jobs
notificationQueue.process('sendPushNotification', async (job) => {
  const { userId, message, type } = job.data;
  logger.info('Processing push notification', { userId, type });
  
  // Simulate push notification sending
  await new Promise(resolve => setTimeout(resolve, 200));
  
  logger.info('Push notification sent', { userId, type });
  return { status: 'sent', userId };
});

// Queue event handlers
messageQueue.on('completed', (job, result) => {
  logger.info('Message queue job completed', { jobId: job.id, result });
});

messageQueue.on('failed', (job, err) => {
  logger.error('Message queue job failed', { jobId: job.id, error: err.message });
});

notificationQueue.on('completed', (job, result) => {
  logger.info('Notification queue job completed', { jobId: job.id, result });
});

notificationQueue.on('failed', (job, err) => {
  logger.error('Notification queue job failed', { jobId: job.id, error: err.message });
});

module.exports = {
  messageQueue,
  notificationQueue
};