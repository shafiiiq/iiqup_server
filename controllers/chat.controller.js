// controllers/chat.controller.js
const chatService            = require('../services/chat.service');
const messageService         = require('../services/message.service');
const websocket              = require('../sockets/websocket');
const { createNotification } = require('../services/notification.service');
const PushNotificationService = require('../push/notification.push');
const User                   = require('../models/user.model');

// ─────────────────────────────────────────────────────────────────────────────
// Chat Controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /chats
 * Returns all chats for the authenticated user, with optional team/user type filters.
 */
const getUserChats = async (req, res) => {
  try {
    const userId               = req.user.id;
    const { teamType, userType } = req.query;

    const chats = await chatService.getUserChats(userId, userType, teamType);

    res.status(200).json({
      success: true,
      message: 'Chats retrieved successfully',
      data:    chats,
    });
  } catch (error) {
    console.error('[Chat] getUserChats:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve chats', error: error.message });
  }
};

/**
 * POST /chats/individual
 * Gets an existing individual chat or creates a new one between two users.
 */
const getOrCreateIndividualChat = async (req, res) => {
  try {
    const { userId, userType, uniqueCode }                                          = req.body;
    const { targetUserId, targetUserType, targetUniqueCode, teamType } = req.body;

    if (!targetUserId || !targetUserType || !targetUniqueCode || !teamType) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const chat = await chatService.getOrCreateIndividualChat({
      user1: { userId, userType, uniqueCode },
      user2: { userId: targetUserId, userType: targetUserType, uniqueCode: targetUniqueCode },
      teamType,
    });

    res.status(200).json({
      success: true,
      message: 'Chat retrieved successfully',
      data:    chat,
    });
  } catch (error) {
    console.error('[Chat] getOrCreateIndividualChat:', error);
    res.status(500).json({ success: false, message: 'Failed to get or create chat', error: error.message });
  }
};

/**
 * POST /chats/group
 * Creates a new group chat and notifies all participants.
 */
const createGroupChat = async (req, res) => {
  try {
    const { userId, userType, uniqueCode } = req.user;
    const { name, teamType, participants, avatar } = req.body;

    if (!name || !teamType || !participants || participants.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Group name, team type, and at least 2 participants are required',
      });
    }

    const allParticipants = [{ userId, userType, uniqueCode }, ...participants];

    const groupChat = await chatService.createGroupChat({
      name,
      teamType,
      participants: allParticipants,
      avatar,
      creatorId: userId,
    });

    allParticipants.forEach(participant => {
      if (participant.uniqueCode !== uniqueCode) {
        websocket.sendNotificationToUser(participant.uniqueCode, {
          type:        'new_group_chat',
          chatId:      groupChat._id,
          groupName:   name,
          creatorName: req.user.name,
        });
      }
    });

    res.status(201).json({
      success: true,
      message: 'Group chat created successfully',
      data:    groupChat,
    });
  } catch (error) {
    console.error('[Chat] createGroupChat:', error);
    res.status(500).json({ success: false, message: 'Failed to create group chat', error: error.message });
  }
};

/**
 * GET /chats/:chatId
 * Returns the details of a single chat by ID.
 */
const getChatDetails = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId     = req.user.id;

    const chat = await chatService.getChatById(chatId, userId);

    if (!chat) {
      return res.status(404).json({ success: false, message: 'Chat not found or access denied' });
    }

    res.status(200).json({
      success: true,
      message: 'Chat details retrieved successfully',
      data:    chat,
    });
  } catch (error) {
    console.error('[Chat] getChatDetails:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve chat details', error: error.message });
  }
};

/**
 * PUT /chats/:chatId
 * Updates a group chat's name, avatar, or participants.
 */
const updateGroupChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId     = req.user.id;
    const updates    = req.body;

    const updatedChat = await chatService.updateGroupChat(chatId, userId, updates);

    if (!updatedChat) {
      return res.status(404).json({ success: false, message: 'Chat not found or unauthorized' });
    }

    updatedChat.participants.forEach(participant => {
      websocket.sendNotificationToUser(participant.uniqueCode, {
        type:   'group_updated',
        chatId: updatedChat._id,
        updates,
      });
    });

    res.status(200).json({
      success: true,
      message: 'Group chat updated successfully',
      data:    updatedChat,
    });
  } catch (error) {
    console.error('[Chat] updateGroupChat:', error);
    res.status(500).json({ success: false, message: 'Failed to update group chat', error: error.message });
  }
};

/**
 * DELETE /chats/:chatId
 * Soft-deletes a chat for the authenticated user.
 */
const deleteChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId     = req.user.id;

    await chatService.deleteChatForUser(chatId, userId);

    res.status(200).json({
      success: true,
      message: 'Chat deleted successfully',
    });
  } catch (error) {
    console.error('[Chat] deleteChat:', error);
    res.status(500).json({ success: false, message: 'Failed to delete chat', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Message Controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /chats/:chatId/messages
 * Returns paginated messages for a chat the user has access to.
 */
const getMessages = async (req, res) => {
  try {
    const { chatId }          = req.params;
    const userId              = req.user.id;
    const { page = 1, limit = 50 } = req.query;

    const hasAccess = await chatService.verifyUserAccess(chatId, userId);

    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'Access denied to this chat' });
    }

    const messages = await messageService.getMessages(chatId, page, limit, userId);

    res.status(200).json({
      success: true,
      message: 'Messages retrieved successfully',
      data:    messages,
    });
  } catch (error) {
    console.error('[Chat] getMessages:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve messages', error: error.message });
  }
};

/**
 * POST /chats/messages/text
 * Sends a text message to a chat and notifies participants via WebSocket.
 */
const sendTextMessage = async (req, res) => {
  try {
    const { userId, userType, uniqueCode } = req.user;
    const { chatId, content }              = req.body;

    if (!chatId || !content) {
      return res.status(400).json({ success: false, message: 'Chat ID and content are required' });
    }

    const message = await messageService.sendMessage({
      chatId,
      senderId:     userId,
      senderType:   userType,
      senderName:   req.user.name,
      senderAvatar: req.user.avatar,
      messageType:  'text',
      content,
    });

    const chat = await chatService.getChatById(chatId, userId);
    websocket.default.sendMessageToChat(chat.participants, message, uniqueCode);

    const user = await User.findById(userId);

    const notification = await createNotification({
      title:       req.user.name,
      description: content,
      priority:    'high',
      sourceId:    'chat',
      recipient:   user.uniqueCode,
      time:        new Date(),
    });

    await PushNotificationService.sendGeneralNotification(
      user.uniqueCode,
      req.user.name,
      content,
      'high',
      'normal',
      notification.data._id.toString(),
    );

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data:    message,
    });
  } catch (error) {
    console.error('[Chat] sendTextMessage:', error);
    res.status(500).json({ success: false, message: 'Failed to send message', error: error.message });
  }
};

/**
 * PUT /chats/:chatId/read
 * Marks all unread messages in a chat as read for the authenticated user.
 */
const markAsRead = async (req, res) => {
  try {
    const { chatId }    = req.params;
    const userId        = req.user.id;
    const { uniqueCode } = req.user;

    const unreadMessages = await messageService.getUnreadMessagesForUser(chatId, userId);

    if (unreadMessages.length === 0) {
      return res.status(200).json({ success: true, message: 'No unread messages' });
    }

    const messageIds = unreadMessages.map(msg => msg._id);

    await messageService.markMessagesAsRead(chatId, messageIds, userId);

    const chat = await chatService.getChatById(chatId, userId);

    chat.participants.forEach(participant => {
      if (participant.uniqueCode !== uniqueCode) {
        websocket.default.updateMessageStatus(participant.uniqueCode, messageIds, 'read', chatId);
      }
    });

    res.status(200).json({
      success: true,
      message: 'Messages marked as read',
    });
  } catch (error) {
    console.error('[Chat] markAsRead:', error);
    res.status(500).json({ success: false, message: 'Failed to mark messages as read', error: error.message });
  }
};

/**
 * DELETE /chats/messages/:messageId
 * Deletes a message for the user, or for everyone if deleteForEveryone is true.
 */
const deleteMessage = async (req, res) => {
  try {
    const { messageId }       = req.params;
    const userId              = req.user.id;
    const { deleteForEveryone } = req.body;

    await messageService.deleteMessage(messageId, userId, deleteForEveryone);

    res.status(200).json({
      success: true,
      message: 'Message deleted successfully',
    });
  } catch (error) {
    console.error('[Chat] deleteMessage:', error);
    res.status(500).json({ success: false, message: 'Failed to delete message', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// File Upload Controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /chats/upload/voice
 * Returns a pre-signed S3 URL for uploading a voice message.
 */
const uploadVoiceMessage = async (req, res) => {
  try {
    const { id }       = req.user;
    const { chatId, file } = req.body;

    if (!chatId || !file) {
      return res.status(400).json({ success: false, message: 'Chat ID and voice file are required' });
    }

    const userData = await User.findById(id);
    const { uploadUrl, fileKey } = await messageService.uploadFile(userData.email, 'voice', file.mimetype);

    res.status(201).json({
      success:     true,
      message:     'Voice message upload URL generated successfully',
      uploadUrl,
      fileKey,
      messageType: 'Voice Record',
    });
  } catch (error) {
    console.error('[Chat] uploadVoiceMessage:', error);
    res.status(500).json({ success: false, message: 'Failed to upload voice message', error: error.message });
  }
};

/**
 * POST /chats/upload/image
 * Returns a pre-signed S3 URL for uploading an image.
 */
const uploadImage = async (req, res) => {
  try {
    const { id }       = req.user;
    const { chatId, file } = req.body;

    if (!chatId || !file) {
      return res.status(400).json({ success: false, message: 'Chat ID and image file are required' });
    }

    const userData = await User.findById(id);
    const { uploadUrl, fileKey } = await messageService.uploadFile(userData.email, 'image', file.mimetype);

    res.status(201).json({
      success:     true,
      message:     'Image upload URL generated successfully',
      uploadUrl,
      fileKey,
      messageType: 'Image',
    });
  } catch (error) {
    console.error('[Chat] uploadImage:', error);
    res.status(500).json({ success: false, message: 'Failed to upload image', error: error.message });
  }
};

/**
 * POST /chats/upload/video
 * Returns a pre-signed S3 URL for uploading a video and generates a thumbnail.
 */
const uploadVideo = async (req, res) => {
  try {
    const { id }       = req.user;
    const { chatId, file } = req.body;

    if (!chatId || !file) {
      return res.status(400).json({ success: false, message: 'Chat ID and video file are required' });
    }

    const userData = await User.findById(id);
    const { uploadUrl, fileKey } = await messageService.uploadFile(userData.email, 'video', file.mimetype);
    await messageService.generateThumbnail(fileKey);

    res.status(201).json({
      success:     true,
      message:     'Video upload URL generated successfully',
      uploadUrl,
      fileKey,
      messageType: 'Video',
    });
  } catch (error) {
    console.error('[Chat] uploadVideo:', error);
    res.status(500).json({ success: false, message: 'Failed to upload video', error: error.message });
  }
};

/**
 * POST /chats/upload/document
 * Returns a pre-signed S3 URL for uploading a document.
 */
const uploadDocument = async (req, res) => {
  try {
    const { id }       = req.user;
    const { chatId, file } = req.body;

    if (!chatId || !file) {
      return res.status(400).json({ success: false, message: 'Chat ID and document file are required' });
    }

    const userData = await User.findById(id);
    const { uploadUrl, fileKey } = await messageService.uploadFile(userData.email, 'document', file.mimetype);

    res.status(201).json({
      success:     true,
      message:     'Document upload URL generated successfully',
      uploadUrl,
      fileKey,
      messageType: 'Document',
    });
  } catch (error) {
    console.error('[Chat] uploadDocument:', error);
    res.status(500).json({ success: false, message: 'Failed to upload document', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Call Controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /chats/calls/history
 * Returns paginated call history for the authenticated user.
 */
const getCallHistory = async (req, res) => {
  try {
    const userId              = req.user.id;
    const { page = 1, limit = 20 } = req.query;

    const callHistory = await messageService.getCallHistory(userId, page, limit);

    res.status(200).json({
      success: true,
      message: 'Call history retrieved successfully',
      data:    callHistory,
    });
  } catch (error) {
    console.error('[Chat] getCallHistory:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve call history', error: error.message });
  }
};

/**
 * POST /chats/calls
 * Saves a completed, missed, or rejected call record.
 */
const saveCallRecord = async (req, res) => {
  try {
    const userId                                          = req.user.id;
    const { chatId, receiverId, duration, callType, status } = req.body;

    if (!chatId || !receiverId || !callType) {
      return res.status(400).json({
        success: false,
        message: 'Chat ID, receiver ID, and call type are required',
      });
    }

    const callRecord = await messageService.saveCallRecord({
      chatId,
      callerId: userId,
      receiverId,
      duration,
      callType,
      status,
    });

    res.status(201).json({
      success: true,
      message: 'Call record saved successfully',
      data:    callRecord,
    });
  } catch (error) {
    console.error('[Chat] saveCallRecord:', error);
    res.status(500).json({ success: false, message: 'Failed to save call record', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  // Chat
  getUserChats,
  getOrCreateIndividualChat,
  createGroupChat,
  getChatDetails,
  updateGroupChat,
  deleteChat,
  // Messages
  getMessages,
  sendTextMessage,
  markAsRead,
  deleteMessage,
  // Uploads
  uploadVoiceMessage,
  uploadImage,
  uploadVideo,
  uploadDocument,
  // Calls
  getCallHistory,
  saveCallRecord,
};