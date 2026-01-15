// controllers/chat.controller.js
const chatService = require('../services/chat-services');
const messageService = require('../services/message-services');
const websocket = require('../utils/websocket');
const { createNotification } = require('../utils/notification-jobs');
const PushNotificationService = require('../utils/push-notification-jobs');
const User = require('../models/user.model');

// ########### CHAT ###########

// Get all chats for a user (with team filter)
const getUserChats = async (req, res) => {
  try {

    const userId = req.user.id; // From auth middleware
    const { teamType, userType } = req.query; // Optional filter
    console.log("userId", userId);
    console.log("teamType", teamType);
    console.log("userType", userType);

    const chats = await chatService.getUserChats(userId, userType, teamType);

    res.status(200).json({
      success: true,
      message: 'Chats retrieved successfully',
      data: chats
    });
  } catch (error) {
    console.error('Error getting user chats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve chats',
      error: error.message
    });
  }
};

// Get or create individual chat
const getOrCreateIndividualChat = async (req, res) => {
  try {
    const { userId, userType, uniqueCode } = req.body;
    const { targetUserId, targetUserType, targetUniqueCode, teamType } = req.body;

    if (!targetUserId || !targetUserType || !targetUniqueCode || !teamType) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    const chat = await chatService.getOrCreateIndividualChat({
      user1: { userId, userType, uniqueCode },
      user2: { userId: targetUserId, userType: targetUserType, uniqueCode: targetUniqueCode },
      teamType
    });

    res.status(200).json({
      success: true,
      message: 'Chat retrieved successfully',
      data: chat
    });
  } catch (error) {
    console.error('Error getting/creating individual chat:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get or create chat',
      error: error.message
    });
  }
};

// Create group chat
const createGroupChat = async (req, res) => {
  try {
    const { userId, userType, uniqueCode } = req.user;
    const { name, teamType, participants, avatar } = req.body;

    if (!name || !teamType || !participants || participants.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Group name, team type, and at least 2 participants are required'
      });
    }

    // Add creator to participants
    const allParticipants = [
      { userId, userType, uniqueCode },
      ...participants
    ];

    const groupChat = await chatService.createGroupChat({
      name,
      teamType,
      participants: allParticipants,
      avatar,
      creatorId: userId
    });

    // Notify all participants
    allParticipants.forEach(participant => {
      if (participant.uniqueCode !== uniqueCode) {
        websocket.sendNotificationToUser(participant.uniqueCode, {
          type: 'new_group_chat',
          chatId: groupChat._id,
          groupName: name,
          creatorName: req.user.name
        });
      }
    });

    res.status(201).json({
      success: true,
      message: 'Group chat created successfully',
      data: groupChat
    });
  } catch (error) {
    console.error('Error creating group chat:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create group chat',
      error: error.message
    });
  }
};

// Get chat details
const getChatDetails = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;

    const chat = await chatService.getChatById(chatId, userId);

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found or access denied'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Chat details retrieved successfully',
      data: chat
    });
  } catch (error) {
    console.error('Error getting chat details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve chat details',
      error: error.message
    });
  }
};

// Update group chat
const updateGroupChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;
    const updates = req.body; // { name, avatar, addParticipants, removeParticipants }

    const updatedChat = await chatService.updateGroupChat(chatId, userId, updates);

    if (!updatedChat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found or unauthorized'
      });
    }

    // Notify participants about updates
    updatedChat.participants.forEach(participant => {
      websocket.sendNotificationToUser(participant.uniqueCode, {
        type: 'group_updated',
        chatId: updatedChat._id,
        updates
      });
    });

    res.status(200).json({
      success: true,
      message: 'Group chat updated successfully',
      data: updatedChat
    });
  } catch (error) {
    console.error('Error updating group chat:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update group chat',
      error: error.message
    });
  }
};

// Delete chat (soft delete for user)
const deleteChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;

    await chatService.deleteChatForUser(chatId, userId);

    res.status(200).json({
      success: true,
      message: 'Chat deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting chat:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete chat',
      error: error.message
    });
  }
};

// ########### MESSAGES ###########

// Get messages for a chat
const getMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;
    console.log("userId", userId);

    const { page = 1, limit = 50 } = req.query;

    // Verify user has access to this chat
    const hasAccess = await chatService.verifyUserAccess(chatId, userId);
    console.log("chataaaaaaaaaaaaaaaa", hasAccess);

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this chat'
      });
    }

    const messages = await messageService.getMessages(chatId, page, limit, userId);

    res.status(200).json({
      success: true,
      message: 'Messages retrieved successfully',
      data: messages
    });
  } catch (error) {
    console.error('Error getting messages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve messages',
      error: error.message
    });
  }
};

// Send text message (handled via WebSocket, but can have HTTP fallback)
const sendTextMessage = async (req, res) => {
  try {
    const { userId, userType, uniqueCode } = req.user;
    const { chatId, content } = req.body;

    console.log("req.user", req.user);


    if (!chatId || !content) {
      return res.status(400).json({
        success: false,
        message: 'Chat ID and content are required'
      });
    }

    const message = await messageService.sendMessage({
      chatId,
      senderId: userId,
      senderType: userType,
      senderName: req.user.name,
      senderAvatar: req.user.avatar,
      messageType: 'text',
      content
    });

    // Get chat participants
    const chat = await chatService.getChatById(chatId, userId);

    // Send via WebSocket to all participants
    websocket.default.sendMessageToChat(chat.participants, message, uniqueCode);

    const user = User.findById(userId)

    const notification = await createNotification({
      title: `${senderName}`,
      description: `${message}`,
      priority: "high",
      sourceId: 'chat',
      recipient: JSON.parse(user.uniqueCode),
      time: new Date(),
    });

    console.log("notification", notification);


    await PushNotificationService.sendGeneralNotification(
      user.uniqueCode,
      `${senderName}`,
      `${message}`,
      'high',
      'normal',
      notification.data._id.toString()
    );

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: message
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message',
      error: error.message
    });
  }
};

// Mark messages as read
const markAsRead = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;
    const { uniqueCode } = req.user;

    // Get all unread messages in this chat
    const unreadMessages = await messageService.getUnreadMessagesForUser(chatId, userId);

    if (unreadMessages.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No unread messages'
      });
    }

    const messageIds = unreadMessages.map(msg => msg._id);

    // Mark messages as read
    await messageService.markMessagesAsRead(chatId, messageIds, userId);

    // Get chat to notify sender
    const chat = await chatService.getChatById(chatId, userId);

    // Notify other participants via WebSocket
    chat.participants.forEach(participant => {
      if (participant.uniqueCode !== uniqueCode) {
        websocket.default.updateMessageStatus(participant.uniqueCode, messageIds, 'read', chatId);
      }
    });

    res.status(200).json({
      success: true,
      message: 'Messages marked as read'
    });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark messages as read',
      error: error.message
    });
  }
};

// Delete message
const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;
    const { deleteForEveryone } = req.body; // true/false

    await messageService.deleteMessage(messageId, userId, deleteForEveryone);

    res.status(200).json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete message',
      error: error.message
    });
  }
};

// ########### FILE UPLOADS ###########

// Upload voice message
const uploadVoiceMessage = async (req, res) => {
  try {
    const { id } = req.user;
    const { chatId, file } = req.body;

    const userData = await User.findById(id)

    if (!chatId || !file) {
      return res.status(400).json({
        success: false,
        message: 'Chat ID and voice file are required'
      });
    }

    // Get S3 upload URL and key
    const { uploadUrl, fileKey } = await messageService.uploadFile(userData.email, 'voice', file.mimetype);

    res.status(201).json({
      success: true,
      message: 'Voice message sent successfully',
      uploadUrl,
      fileKey,
      messageType: 'Voice Record'
    });
  } catch (error) {
    console.error('Error uploading voice message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload voice message',
      error: error.message
    });
  }
};

// Upload image
const uploadImage = async (req, res) => {
  try {
    const { id } = req.user
    const { chatId, file } = req.body;

    const userData = await User.findById(id)

    console.log("fileeeeeee", file)

    if (!chatId || !file) {
      return res.status(400).json({
        success: false,
        message: 'Chat ID and image file are required'
      });
    }
    // Get S3 upload URL and key
    const { uploadUrl, fileKey } = await messageService.uploadFile(userData.email, 'image', file.mimetype);

    res.status(201).json({
      success: true,
      message: 'Image sent successfully',
      uploadUrl,
      fileKey,
      messageType: 'Image'
    });
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload image',
      error: error.message
    });
  }
};

// Upload video
const uploadVideo = async (req, res) => {
  try {
    const { id } = req.user
    const { chatId, file } = req.body;

    const userData = await User.findById(id)

    if (!chatId || !file) {
      return res.status(400).json({
        success: false,
        message: 'Chat ID and video file are required'
      });
    }

    // Get S3 upload URL and key
    const { uploadUrl, fileKey } = await messageService.uploadFile(userData.email, 'video', file.mimetype);
    const thumbnailUrl = await messageService.generateThumbnail(fileKey);

    res.status(201).json({
      success: true,
      message: 'Video sent successfully',
      uploadUrl,
      fileKey,
      messageType: 'Video'
    });
  } catch (error) {
    console.error('Error uploading video:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload video',
      error: error.message
    });
  }
};

// Upload document
const uploadDocument = async (req, res) => {
  try {
    const { id } = req.user
    const { chatId, file } = req.body;

    const userData = await User.findById(id)

    console.log("fileeeeeee", file)
    if (!chatId || !file) {
      return res.status(400).json({
        success: false,
        message: 'Chat ID and document file are required'
      });
    }

    // Get S3 upload URL and key
    const { uploadUrl, fileKey } = await messageService.uploadFile(userData.email, 'document', file.mimetype);

    res.status(201).json({
      success: true,
      message: 'Document sent successfully',
      uploadUrl,
      fileKey,
      messageType: 'Document'
    });
  } catch (error) {
    console.error('Error uploading document:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload document',
      error: error.message
    });
  }
};

// ########### CALLS ###########

// Get call history
const getCallHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20 } = req.query;

    const callHistory = await messageService.getCallHistory(userId, page, limit);

    res.status(200).json({
      success: true,
      message: 'Call history retrieved successfully',
      data: callHistory
    });
  } catch (error) {
    console.error('Error getting call history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve call history',
      error: error.message
    });
  }
};

// Save call record
const saveCallRecord = async (req, res) => {
  try {
    const userId = req.user.id;
    const { chatId, receiverId, duration, callType, status } = req.body;

    if (!chatId || !receiverId || !callType) {
      return res.status(400).json({
        success: false,
        message: 'Chat ID, receiver ID, and call type are required'
      });
    }

    const callRecord = await messageService.saveCallRecord({
      chatId,
      callerId: userId,
      receiverId,
      duration,
      callType, // 'voice' or 'video'
      status // 'completed', 'missed', 'rejected'
    });

    res.status(201).json({
      success: true,
      message: 'Call record saved successfully',
      data: callRecord
    });
  } catch (error) {
    console.error('Error saving call record:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save call record',
      error: error.message
    });
  }
};

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
  saveCallRecord
};