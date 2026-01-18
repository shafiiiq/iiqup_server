// services/message.service.js
const Message = require('../models/messages.model');
const Chat = require('../models/chats.model');
const chatService = require('./chat-services');
const { putObject, getObjectUrl } = require('../s3bucket/s3.bucket');
const mongoose = require('mongoose');
const { createNotification } = require('../utils/notification-jobs');
const User = require('../models/user.model');

// ########### MESSAGE MANAGEMENT ###########

// Get messages for a chat with pagination
const getMessages = async (chatId, page = 1, limit = 50, userId) => {
  try {
    const skip = (page - 1) * limit;

    const messages = await Message.find({
      chatId,
      deletedFor: { $ne: userId }
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Generate signed URLs for file messages
    const messagesWithUrls = await Promise.all(
      messages.map(async (msg) => {
        if (['image', 'video', 'audio', 'voice', 'document'].includes(msg.messageType)) {
          // Get signed URL for the file
          msg.content = await getObjectUrl(msg.content, false);

          // Get signed URL for thumbnail if exists
          if (msg.thumbnail) {
            msg.thumbnail = await getObjectUrl(msg.thumbnail, false);
          }
        }
        return msg;
      })
    );

    // Reverse to show oldest first
    return messagesWithUrls.reverse();
  } catch (error) {
    console.error('Error getting messages:', error);
    throw error;
  }
};

// Send message
const sendMessage = async (messageData) => {
  try {
    const {
      chatId,
      senderId,
      senderType,
      senderName,
      senderAvatar,
      messageType,
      content,
      recieverId,
      fileName,
      fileSize,
      duration,
      thumbnail,
      replyTo
    } = messageData;

    // Create message
    const message = await Message.create({
      chatId,
      senderId,
      senderType,
      senderName,
      senderAvatar,
      messageType,
      content,
      fileName,
      fileSize,
      duration,
      thumbnail,
      replyTo,
      status: 'sent',
      readBy: [],
      deliveredTo: []
    });

    // Update chat's last message
    await chatService.updateLastMessage(
      chatId,
      messageType === 'text' ? content : `${messageType} message`,
      senderId,
      senderName
    );

    // Increment unread count for other participants
    await chatService.incrementUnreadCount(chatId, senderId);

    const user = await User.findById(recieverId);

    if (user) {
      const PushNotificationService = require('../utils/push-notification-jobs');

      await PushNotificationService.sendGeneralNotification(
        user.uniqueCode,
        senderName,
        messageType === 'text' ? content : `${messageType} message`,
        'high',
        'normal',
      );
    }

    return message;
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
};

// Mark messages as delivered
const markMessagesAsDelivered = async (messageIds, userId) => {
  try {
    await Message.updateMany(
      {
        _id: { $in: messageIds },
        'deliveredTo.userId': { $ne: userId }
      },
      {
        $push: {
          deliveredTo: {
            userId,
            deliveredAt: new Date()
          }
        },
        $set: { status: 'delivered' }
      }
    );

    return true;
  } catch (error) {
    console.error('Error marking messages as delivered:', error);
    throw error;
  }
};

// Mark messages as read
const markMessagesAsRead = async (chatId, messageIds, userId) => {
  try {
    // Update messages
    await Message.updateMany(
      {
        _id: { $in: messageIds },
        chatId,
        'readBy.userId': { $ne: userId }
      },
      {
        $push: {
          readBy: {
            userId,
            readAt: new Date()
          }
        },
        $set: { status: 'read' }
      }
    );

    // Reset unread count for this user in chat
    await chatService.resetUnreadCount(chatId, userId);

    return true;
  } catch (error) {
    console.error('Error marking messages as read:', error);
    throw error;
  }
};

// Delete message
const deleteMessage = async (messageId, userId, deleteForEveryone = false) => {
  try {
    if (deleteForEveryone) {
      // Only sender can delete for everyone
      const message = await Message.findOne({
        _id: messageId,
        senderId: userId
      });

      if (!message) {
        throw new Error('Unauthorized to delete this message');
      }

      // Check if message is older than 1 hour (optional restriction)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      if (message.createdAt < oneHourAgo) {
        throw new Error('Cannot delete messages older than 1 hour');
      }

      // Mark as deleted
      await Message.findByIdAndUpdate(messageId, {
        isDeleted: true,
        content: 'This message was deleted'
      });
    } else {
      // Soft delete for this user only
      await Message.findByIdAndUpdate(messageId, {
        $addToSet: { deletedFor: userId }
      });
    }

    return true;
  } catch (error) {
    console.error('Error deleting message:', error);
    throw error;
  }
};

// ########### FILE UPLOAD ###########

// Upload file to S3
const uploadFile = async (userEmail, fileType, mimeType) => {
  try {
    const timestamp = Date.now();
    const sanitizedFileName = `${timestamp}-${userEmail}`;
    const key = `chat/${fileType}/${sanitizedFileName}`;

    console.log("");


    // Get presigned URL for upload
    const uploadUrl = await putObject(sanitizedFileName, key, mimeType);

    console.log("uploadUrl", uploadUrl);


    // Return both uploadUrl and key
    return {
      uploadUrl,
      fileKey: key
    };
  } catch (error) {
    console.error('Error generating upload URL:', error);
    throw error;
  }
};

// Generate video thumbnail (placeholder - you can use ffmpeg)
const generateThumbnail = async (videoKey) => {
  try {
    // TODO: Implement thumbnail generation with ffmpeg
    // For now, return null
    // You can use a service like AWS Lambda with ffmpeg layer

    console.log(`Thumbnail generation needed for: ${videoKey}`);
    return null;
  } catch (error) {
    console.error('Error generating thumbnail:', error);
    return null;
  }
};

// Get file URL with signature
const getFileUrl = async (fileKey, isLongExpiry = false) => {
  try {
    return await getObjectUrl(fileKey, isLongExpiry);
  } catch (error) {
    console.error('Error getting file URL:', error);
    throw error;
  }
};

// ########### CALL MANAGEMENT ###########

// Get call history for a user
const getCallHistory = async (userId, page = 1, limit = 20) => {
  try {
    const skip = (page - 1) * limit;

    // Find chats where user is participant
    const userChats = await Chat.find({
      'participants.userId': userId
    }).select('_id').lean();

    const chatIds = userChats.map(chat => chat._id);

    // Get call messages
    const callMessages = await Message.find({
      chatId: { $in: chatIds },
      messageType: 'call',
      $or: [
        { senderId: userId },
        { 'callData.receiverId': userId }
      ]
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    return callMessages;
  } catch (error) {
    console.error('Error getting call history:', error);
    throw error;
  }
};

// Save call record
const saveCallRecord = async (callData) => {
  try {
    const { chatId, callerId, receiverId, duration, callType, status, senderType, messageType } = callData;

    // Get caller name 
    const chat = await Chat.findById(chatId);
    const caller = chat.participants.find(p => p.userId.toString() === callerId.toString());

    // Create call message
    const callMessage = await Message.create({
      chatId,
      senderId: callerId,
      senderName: caller?.name || 'Unknown',
      messageType: 'call',
      content: `${callType} call - ${status}`,
      senderType: senderType,
      messageType: messageType,
      callData: {
        receiverId,
        duration,
        callType,
        status,
        startTime: new Date(),
        endTime: duration ? new Date(Date.now() + duration * 1000) : new Date()
      },
      status: 'sent'
    });

    return callMessage;
  } catch (error) {
    console.error('Error saving call record:', error);
    throw error;
  }
};

// ########### MESSAGE STATISTICS ###########

// Get unread messages for a user
const getUnreadMessagesForUser = async (chatId, userId) => {
  try {
    const messages = await Message.find({
      chatId,
      senderId: { $ne: userId }, // Not sent by this user
      'readBy.userId': { $ne: userId } // Not already read by this user
    }).lean();

    return messages;
  } catch (error) {
    console.error('Error getting unread messages:', error);
    throw error;
  }
};

// Get unread message count for user
const getUnreadCount = async (userId) => {
  try {
    const chats = await Chat.find({
      'participants.userId': userId
    }).lean();

    let totalUnread = 0;
    chats.forEach(chat => {
      const unread = chat.unreadCount?.get(userId.toString()) || 0;
      totalUnread += unread;
    });

    return totalUnread;
  } catch (error) {
    console.error('Error getting unread count:', error);
    throw error;
  }
};

// Search messages in chat
const searchMessages = async (chatId, searchQuery, userId) => {
  try {
    const messages = await Message.find({
      chatId,
      messageType: 'text',
      content: { $regex: searchQuery, $options: 'i' },
      deletedFor: { $ne: userId }
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return messages;
  } catch (error) {
    console.error('Error searching messages:', error);
    throw error;
  }
};

module.exports = {
  // Messages
  getMessages,
  sendMessage,
  markMessagesAsDelivered,
  markMessagesAsRead,
  deleteMessage,
  // Files
  uploadFile,
  generateThumbnail,
  getFileUrl,
  // Calls
  getCallHistory,
  saveCallRecord,
  // Statistics
  getUnreadCount,
  getUnreadMessagesForUser,
  searchMessages
};