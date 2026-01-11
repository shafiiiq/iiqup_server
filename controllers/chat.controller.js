// controllers/chat.controller.js
const chatService = require('../services/chat-services');
const messageService = require('../services/message-services');
const websocket = require('../utils/websocket');

// ########### CHAT ###########

// Get all chats for a user (with team filter)
const getUserChats = async (req, res) => {
  try {
    const { userId, userType } = req.user; // From auth middleware
    const { teamType } = req.query; // Optional filter

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
    const { userId, userType, uniqueCode } = req.user;
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
    const { userId } = req.user;

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
    const { userId } = req.user;
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
    const { userId } = req.user;

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
    const { userId } = req.user;
    const { page = 1, limit = 50 } = req.query;

    // Verify user has access to this chat
    const hasAccess = await chatService.verifyUserAccess(chatId, userId);
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
    websocket.sendMessageToChat(chat.participants, message, uniqueCode);

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
    const { userId, uniqueCode } = req.user;
    const { chatId, messageIds } = req.body;

    if (!chatId || !messageIds || messageIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Chat ID and message IDs are required'
      });
    }

    await messageService.markMessagesAsRead(chatId, messageIds, userId);

    // Get chat to notify senders
    const chat = await chatService.getChatById(chatId, userId);
    
    // Notify other participants
    chat.participants.forEach(participant => {
      if (participant.uniqueCode !== uniqueCode) {
        websocket.updateMessageStatus(participant.uniqueCode, messageIds, 'read');
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
    const { userId } = req.user;
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
    const { userId, userType, uniqueCode } = req.user;
    const { chatId } = req.body;
    const file = req.file; // Multer file

    if (!chatId || !file) {
      return res.status(400).json({
        success: false,
        message: 'Chat ID and voice file are required'
      });
    }

    // Upload to cloud storage (S3, Cloudinary, etc.)
    const fileUrl = await messageService.uploadFile(file, 'voice');

    // Create message
    const message = await messageService.sendMessage({
      chatId,
      senderId: userId,
      senderType: userType,
      senderName: req.user.name,
      senderAvatar: req.user.avatar,
      messageType: 'voice',
      content: fileUrl,
      duration: req.body.duration // Voice duration in seconds
    });

    // Send via WebSocket
    const chat = await chatService.getChatById(chatId, userId);
    websocket.sendMessageToChat(chat.participants, message, uniqueCode);

    res.status(201).json({
      success: true,
      message: 'Voice message sent successfully',
      data: message
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
    const { userId, userType, uniqueCode } = req.user;
    const { chatId } = req.body;
    const file = req.file;

    if (!chatId || !file) {
      return res.status(400).json({
        success: false,
        message: 'Chat ID and image file are required'
      });
    }

    const fileUrl = await messageService.uploadFile(file, 'image');

    const message = await messageService.sendMessage({
      chatId,
      senderId: userId,
      senderType: userType,
      senderName: req.user.name,
      senderAvatar: req.user.avatar,
      messageType: 'image',
      content: fileUrl,
      fileName: file.originalname,
      fileSize: file.size
    });

    const chat = await chatService.getChatById(chatId, userId);
    websocket.sendMessageToChat(chat.participants, message, uniqueCode);

    res.status(201).json({
      success: true,
      message: 'Image sent successfully',
      data: message
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
    const { userId, userType, uniqueCode } = req.user;
    const { chatId } = req.body;
    const file = req.file;

    if (!chatId || !file) {
      return res.status(400).json({
        success: false,
        message: 'Chat ID and video file are required'
      });
    }

    const fileUrl = await messageService.uploadFile(file, 'video');
    const thumbnailUrl = await messageService.generateThumbnail(fileUrl);

    const message = await messageService.sendMessage({
      chatId,
      senderId: userId,
      senderType: userType,
      senderName: req.user.name,
      senderAvatar: req.user.avatar,
      messageType: 'video',
      content: fileUrl,
      fileName: file.originalname,
      fileSize: file.size,
      duration: req.body.duration,
      thumbnail: thumbnailUrl
    });

    const chat = await chatService.getChatById(chatId, userId);
    websocket.sendMessageToChat(chat.participants, message, uniqueCode);

    res.status(201).json({
      success: true,
      message: 'Video sent successfully',
      data: message
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
    const { userId, userType, uniqueCode } = req.user;
    const { chatId } = req.body;
    const file = req.file;

    if (!chatId || !file) {
      return res.status(400).json({
        success: false,
        message: 'Chat ID and document file are required'
      });
    }

    const fileUrl = await messageService.uploadFile(file, 'document');

    const message = await messageService.sendMessage({
      chatId,
      senderId: userId,
      senderType: userType,
      senderName: req.user.name,
      senderAvatar: req.user.avatar,
      messageType: 'document',
      content: fileUrl,
      fileName: file.originalname,
      fileSize: file.size
    });

    const chat = await chatService.getChatById(chatId, userId);
    websocket.sendMessageToChat(chat.participants, message, uniqueCode);

    res.status(201).json({
      success: true,
      message: 'Document sent successfully',
      data: message
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
    const { userId } = req.user;
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
    const { userId } = req.user;
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