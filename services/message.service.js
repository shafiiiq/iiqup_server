const Message             = require('../models/messages.model');
const Chat                = require('../models/chats.model');
const User                = require('../models/user.model');
const chatService         = require('./chat.service');
const { putObject, getObjectUrl } = require('../aws/s3.aws');

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const { FILE_MESSAGE_TYPES } = require('../constants/message.contants');

// ─────────────────────────────────────────────────────────────────────────────
// Messages
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns paginated messages for a chat, with signed URLs for file messages.
 * @param {string} chatId
 * @param {number} page
 * @param {number} limit
 * @param {string} userId
 * @returns {Promise<object[]>}
 */
const getMessages = async (chatId, page = 1, limit = 50, userId) => {
  try {
    const skip = (page - 1) * limit;

    const messages = await Message.find({ chatId, deletedFor: { $ne: userId } })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const messagesWithUrls = await Promise.all(
      messages.map(async (msg) => {
        if (!FILE_MESSAGE_TYPES.includes(msg.messageType)) return msg;

        msg.content = await getObjectUrl(msg.content, false);
        if (msg.thumbnail) msg.thumbnail = await getObjectUrl(msg.thumbnail, false);

        return msg;
      })
    );

    return messagesWithUrls.reverse();
  } catch (error) {
    console.error('[MessageService] getMessages:', error);
    throw error;
  }
};

/**
 * Creates a new message, updates the chat's last message, increments unread counts,
 * and sends a push notification to the receiver.
 * @param {object} messageData
 * @returns {Promise<object>}
 */
const sendMessage = async (messageData) => {
  try {
    const {
      chatId, senderId, senderType, senderName, senderAvatar,
      messageType, content, recieverId,
      fileName, fileSize, duration, thumbnail, replyTo
    } = messageData;

    const message = await Message.create({
      chatId, senderId, senderType, senderName, senderAvatar,
      messageType, content, fileName, fileSize, duration, thumbnail, replyTo,
      status: 'sent', readBy: [], deliveredTo: []
    });

    const lastMessageContent = messageType === 'text' ? content : `${messageType} message`;

    await chatService.updateLastMessage(chatId, lastMessageContent, senderId, senderName);
    await chatService.incrementUnreadCount(chatId, senderId);

    const PushNotificationService = require('../push/notification.push');
    const chat = await Chat.findById(chatId).lean();
    if (chat) {
      const recipientCodes = chat.participants
        .filter(p => p.userId.toString() !== senderId.toString())
        .map(p => p.uniqueCode)
        .filter(Boolean);
      if (recipientCodes.length > 0) {
        await PushNotificationService.sendGeneralNotification(
          recipientCodes,
          senderName,
          lastMessageContent,
          'high',
          'normal'
        );
      }
    }

    return message;
  } catch (error) {
    console.error('[MessageService] sendMessage:', error);
    throw error;
  }
};

/**
 * Marks a list of messages as delivered for a given user.
 * @param {string[]} messageIds
 * @param {string}   userId
 * @returns {Promise<boolean>}
 */
const markMessagesAsDelivered = async (messageIds, userId) => {
  try {
    await Message.updateMany(
      { _id: { $in: messageIds }, 'deliveredTo.userId': { $ne: userId } },
      {
        $push: { deliveredTo: { userId, deliveredAt: new Date() } },
        $set:  { status: 'delivered' }
      }
    );

    return true;
  } catch (error) {
    console.error('[MessageService] markMessagesAsDelivered:', error);
    throw error;
  }
};

/**
 * Marks a list of messages as read for a given user and resets their unread count.
 * @param {string}   chatId
 * @param {string[]} messageIds
 * @param {string}   userId
 * @returns {Promise<boolean>}
 */
const markMessagesAsRead = async (chatId, messageIds, userId) => {
  try {
    await Message.updateMany(
      { _id: { $in: messageIds }, chatId, 'readBy.userId': { $ne: userId } },
      {
        $push: { readBy: { userId, readAt: new Date() } },
        $set:  { status: 'read' }
      }
    );

    await chatService.resetUnreadCount(chatId, userId);

    return true;
  } catch (error) {
    console.error('[MessageService] markMessagesAsRead:', error);
    throw error;
  }
};

/**
 * Deletes a message — either for everyone (sender only, within 1 hour) or just for the requesting user.
 * @param {string}  messageId
 * @param {string}  userId
 * @param {boolean} deleteForEveryone
 * @returns {Promise<boolean>}
 */
const deleteMessage = async (messageId, userId, deleteForEveryone = false) => {
  try {
    if (deleteForEveryone) {
      const message = await Message.findOne({ _id: messageId, senderId: userId });
      if (!message) throw new Error('Unauthorized to delete this message');

      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      if (message.createdAt < oneHourAgo) throw new Error('Cannot delete messages older than 1 hour');

      await Message.findByIdAndUpdate(messageId, { isDeleted: true, content: 'This message was deleted' });
    } else {
      await Message.findByIdAndUpdate(messageId, { $addToSet: { deletedFor: userId } });
    }

    return true;
  } catch (error) {
    console.error('[MessageService] deleteMessage:', error);
    throw error;
  }
};

/**
 * Searches text messages in a chat by query string.
 * @param {string} chatId
 * @param {string} searchQuery
 * @param {string} userId
 * @returns {Promise<object[]>}
 */
const searchMessages = async (chatId, searchQuery, userId) => {
  try {
    return await Message.find({
      chatId,
      messageType: 'text',
      content:     { $regex: searchQuery, $options: 'i' },
      deletedFor:  { $ne: userId }
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
  } catch (error) {
    console.error('[MessageService] searchMessages:', error);
    throw error;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Files
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates a presigned S3 upload URL for a chat file.
 * @param {string} userEmail
 * @param {string} fileType
 * @param {string} mimeType
 * @returns {Promise<{ uploadUrl: string, fileKey: string }>}
 */
const uploadFile = async (userEmail, fileType, mimeType) => {
  try {
    const timestamp         = Date.now();
    const sanitizedFileName = `${timestamp}-${userEmail}`;
    const key               = `chat/${fileType}/${sanitizedFileName}`;
    const uploadUrl         = await putObject(sanitizedFileName, key, mimeType);

    return { uploadUrl, fileKey: key };
  } catch (error) {
    console.error('[MessageService] uploadFile:', error);
    throw error;
  }
};

/**
 * Returns a signed URL for a stored file.
 * @param {string}  fileKey
 * @param {boolean} isLongExpiry
 * @returns {Promise<string>}
 */
const getFileUrl = async (fileKey, isLongExpiry = false) => {
  try {
    return await getObjectUrl(fileKey, isLongExpiry);
  } catch (error) {
    console.error('[MessageService] getFileUrl:', error);
    throw error;
  }
};

/**
 * Placeholder for video thumbnail generation via ffmpeg.
 * @param {string} videoKey
 * @returns {Promise<null>}
 */
const generateThumbnail = async (videoKey) => {
  try {
    // TODO: Implement thumbnail generation with ffmpeg / AWS Lambda
    return null;
  } catch (error) {
    console.error('[MessageService] generateThumbnail:', error);
    return null;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Calls
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns paginated call history for a user across all their chats.
 * @param {string} userId
 * @param {number} page
 * @param {number} limit
 * @returns {Promise<object[]>}
 */
const getCallHistory = async (userId, page = 1, limit = 20) => {
  try {
    const skip     = (page - 1) * limit;
    const userChats = await Chat.find({ 'participants.userId': userId }).select('_id').lean();
    const chatIds  = userChats.map(chat => chat._id);

    return await Message.find({
      chatId:      { $in: chatIds },
      messageType: 'call',
      $or: [{ senderId: userId }, { 'callData.receiverId': userId }]
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();
  } catch (error) {
    console.error('[MessageService] getCallHistory:', error);
    throw error;
  }
};

/**
 * Saves a call record as a message in the chat.
 * @param {object} callData
 * @returns {Promise<object>}
 */
const saveCallRecord = async (callData) => {
  try {
    const { chatId, callerId, receiverId, duration, callType, status, senderType, messageType } = callData;

    const chat   = await Chat.findById(chatId);
    const caller = chat.participants.find(p => p.userId.toString() === callerId.toString());

    return await Message.create({
      chatId,
      senderId:    callerId,
      senderName:  caller?.name || 'Unknown',
      senderType,
      messageType,
      content:     `${callType} call - ${status}`,
      callData: {
        receiverId,
        duration,
        callType,
        status,
        startTime: new Date(),
        endTime:   duration ? new Date(Date.now() + duration * 1000) : new Date()
      },
      status: 'sent'
    });
  } catch (error) {
    console.error('[MessageService] saveCallRecord:', error);
    throw error;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Statistics
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns all unread messages in a chat that were not sent by the given user.
 * @param {string} chatId
 * @param {string} userId
 * @returns {Promise<object[]>}
 */
const getUnreadMessagesForUser = async (chatId, userId) => {
  try {
    return await Message.find({
      chatId,
      senderId:       { $ne: userId },
      'readBy.userId': { $ne: userId }
    }).lean();
  } catch (error) {
    console.error('[MessageService] getUnreadMessagesForUser:', error);
    throw error;
  }
};

/**
 * Returns the total unread message count across all chats for a user.
 * @param {string} userId
 * @returns {Promise<number>}
 */
const getUnreadCount = async (userId) => {
  try {
    const chats = await Chat.find({ 'participants.userId': userId }).lean();

    return chats.reduce((total, chat) => {
      return total + (chat.unreadCount?.get(userId.toString()) || 0);
    }, 0);
  } catch (error) {
    console.error('[MessageService] getUnreadCount:', error);
    throw error;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  getMessages,
  sendMessage,
  markMessagesAsDelivered,
  markMessagesAsRead,
  deleteMessage,
  searchMessages,
  uploadFile,
  getFileUrl,
  generateThumbnail,
  getCallHistory,
  saveCallRecord,
  getUnreadMessagesForUser,
  getUnreadCount
};