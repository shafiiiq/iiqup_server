// controllers/chat.controller.js
const chatService = require('./chat.service');
const messageService = require('./message/message.service');
const websocket = require('../../socket/socket');
const { createNotification } = require('../notification/notification.service');
const PushNotificationService = require('../notification/notification.push');
const User = require('../user/user.model');

// ─────────────────────────────────────────────────────────────────────────────
// Chat Controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /chats
 * Returns all chats for the authenticated user, with optional team/user type filters.
 */
const getUserChats = async (req, res) => {
  try {
    const userId = req.user.id;
    const { teamType, userType } = req.query;

    const chats = await chatService.getUserChats(userId, userType, teamType);

    res.status(200).json({
      success: true,
      message: 'Chats retrieved successfully',
      data: chats,
    });
  } catch (error) {
    console.error('[Chat] getUserChats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve chats',
      error: error.message,
    });
  }
};

/**
 * POST /chats/individual
 * Gets an existing individual chat or creates a new one between two users.
 */
const getOrCreateIndividualChat = async (req, res) => {
  try {
    const { userId, userType, uniqueCode } = req.body;
    const { targetUserId, targetUserType, targetUniqueCode, teamType } =
      req.body;

    if (!targetUserId || !targetUserType || !targetUniqueCode || !teamType) {
      return res
        .status(400)
        .json({ success: false, message: 'Missing required fields' });
    }

    const chat = await chatService.getOrCreateIndividualChat({
      user1: { userId, userType, uniqueCode },
      user2: {
        userId: targetUserId,
        userType: targetUserType,
        uniqueCode: targetUniqueCode,
      },
      teamType,
    });

    res.status(200).json({
      success: true,
      message: 'Chat retrieved successfully',
      data: chat,
    });
  } catch (error) {
    console.error('[Chat] getOrCreateIndividualChat:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get or create chat',
      error: error.message,
    });
  }
};

/**
 * POST /chats/group
 * Creates a new group chat and notifies all participants.
 */
const createGroupChat = async (req, res) => {
  try {
    const { id: userId, userType, uniqueCode, name: userName } = req.user;
    const { name, teamType, participants, avatar } = req.body;
    const creatorName =
      userName ||
      (await User.findById(userId).select('name').lean())?.name ||
      'Someone';

    if (!teamType || !participants || participants.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Team type and at least 2 participants are required',
      });
    }

    const resolvedName = (name || '').trim() || 'New Group';

    const normalizedParticipants = (participants || [])
      .filter(Boolean)
      .map((participant) => ({
        userId: participant.userId || participant._id,
        userType: participant.userType || 'office',
        uniqueCode: participant.uniqueCode,
        isAdmin: false,
      }));

    const allParticipants = [
      { userId, userType: userType || 'office', uniqueCode, isAdmin: true },
      ...normalizedParticipants,
    ];

    const groupChat = await chatService.createGroupChat({
      name: resolvedName,
      teamType,
      participants: allParticipants,
      avatar,
      creatorId: userId,
    });

    const systemMessage = await messageService.createGroupSystemMessage({
      chatId: groupChat._id,
      actorId: userId,
      actorName: creatorName,
      event: 'created',
      groupName: resolvedName,
      chat: groupChat,
    });

    if (systemMessage) {
      const payload = {
        ...systemMessage.toObject(),
        chatId: groupChat._id,
        chatType: 'group',
        chatName: groupChat.name || resolvedName,
        participants: groupChat.participants,
        avatar: groupChat.avatar,
      };
      websocket.default.sendMessageToChat(groupChat.participants, payload);
    }

    allParticipants.forEach((participant) => {
      if (participant.uniqueCode && participant.uniqueCode !== uniqueCode) {
        websocket.default.sendNotificationToUser(participant.uniqueCode, {
          type: 'new_group_chat',
          chatId: groupChat._id,
          groupName: resolvedName,
          creatorName: creatorName || 'Unknown',
        });
      }
    });

    res.status(201).json({
      success: true,
      message: 'Group chat created successfully',
      data: groupChat,
    });
  } catch (error) {
    console.error('[Chat] createGroupChat:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create group chat',
      error: error.message,
    });
  }
};

/**
 * GET /chats/:chatId
 * Returns the details of a single chat by ID.
 */
const getChatDetails = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;

    const chat = await chatService.getChatById(chatId, userId);

    if (!chat) {
      return res
        .status(404)
        .json({ success: false, message: 'Chat not found or access denied' });
    }

    res.status(200).json({
      success: true,
      message: 'Chat details retrieved successfully',
      data: chat,
    });
  } catch (error) {
    console.error('[Chat] getChatDetails:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve chat details',
      error: error.message,
    });
  }
};

/**
 * GET /chats/:chatId/presence
 * Returns current presence data for participants in the chat.
 */
const getChatPresence = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;

    const chat = await chatService.getChatById(chatId, userId);
    if (!chat) {
      return res
        .status(404)
        .json({ success: false, message: 'Chat not found or access denied' });
    }

    const presence = (chat.participants || [])
      .filter((participant) => participant.userId !== userId)
      .map((participant) => ({
        chatId,
        userId: participant.userId,
        uniqueCode: participant.uniqueCode,
        isOnline: websocket.default.isUserConnected(participant.uniqueCode),
        lastSeen: undefined,
      }));

    res.status(200).json({
      success: true,
      message: 'Chat presence retrieved successfully',
      data: presence,
    });
  } catch (error) {
    console.error('[Chat] getChatPresence:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve chat presence',
      error: error.message,
    });
  }
};

/**
 * PUT /chats/:chatId
 * Updates a group chat's name, avatar, or participants.
 */
const updateGroupChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;
    const updates = req.body;

    const updatedChat = await chatService.updateGroupChat(
      chatId,
      userId,
      updates
    );

    if (!updatedChat) {
      return res
        .status(404)
        .json({ success: false, message: 'Chat not found or unauthorized' });
    }

    const event =
      updates?.addParticipants?.length > 0
        ? 'added'
        : updates?.removeParticipants?.length > 0
          ? 'removed'
          : updates?.promoteParticipants?.length > 0
            ? 'promoted'
            : null;

    const targetNames = [];
    if (updates?.addParticipants?.length > 0) {
      targetNames.push(
        ...(updates.addParticipants || []).map(
          (participant) =>
            participant.name || participant.userName || 'a member'
        )
      );
    }
    if (updates?.removeParticipants?.length > 0) {
      const removedMembers = await User.find({
        _id: { $in: updates.removeParticipants },
      })
        .select('name')
        .lean();
      targetNames.push(
        ...removedMembers.map((member) => member.name || 'a member')
      );
    }
    if (updates?.promoteParticipants?.length > 0) {
      const promotedMembers = await User.find({
        _id: { $in: updates.promoteParticipants },
      })
        .select('name')
        .lean();
      targetNames.push(
        ...promotedMembers.map((member) => member.name || 'a member')
      );
    }

    const systemMessage = await messageService.createGroupSystemMessage({
      chatId,
      actorId: userId,
      actorName: req.user.name,
      event,
      updates,
      targetNames,
      groupName: updates?.name || updatedChat?.name,
      chat: updatedChat,
    });

    updatedChat.participants.forEach((participant) => {
      if (participant.uniqueCode) {
        websocket.default.sendNotificationToUser(participant.uniqueCode, {
          type: 'group_updated',
          chatId: updatedChat._id,
          updates,
        });
      }
    });

    if (systemMessage) {
      const messagePayload = {
        ...systemMessage.toObject(),
        chatId,
        chatType: 'group',
        chatName: updatedChat.name,
        participants: updatedChat.participants,
        avatar: updatedChat.avatar,
      };
      websocket.default.sendMessageToChat(
        updatedChat.participants,
        messagePayload
      );
    }

    res.status(200).json({
      success: true,
      message: 'Group chat updated successfully',
      data: updatedChat,
    });
  } catch (error) {
    console.error('[Chat] updateGroupChat:', error);
    if (error.message?.includes('Only group admins')) {
      return res.status(403).json({ success: false, message: error.message });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to update group chat',
      error: error.message,
    });
  }
};

/**
 * DELETE /chats/:chatId
 * Soft-deletes a chat for the authenticated user.
 */
const leaveGroupChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;

    const updatedChat = await chatService.leaveGroupChat(chatId, userId);

    if (!updatedChat) {
      return res
        .status(404)
        .json({ success: false, message: 'Chat not found or unauthorized' });
    }

    const systemMessage = await messageService.createGroupSystemMessage({
      chatId,
      actorId: userId,
      actorName: req.user.name,
      event: 'left',
      groupName: updatedChat.name,
      chat: updatedChat,
    });

    if (systemMessage) {
      const messagePayload = {
        ...systemMessage.toObject(),
        chatId,
        chatType: 'group',
        chatName: updatedChat.name,
        participants: updatedChat.participants,
        avatar: updatedChat.avatar,
      };
      websocket.default.sendMessageToChat(
        updatedChat.participants,
        messagePayload
      );
    }

    res.status(200).json({
      success: true,
      message: 'Left group successfully',
      data: updatedChat,
    });
  } catch (error) {
    console.error('[Chat] leaveGroupChat:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to leave group',
      error: error.message,
    });
  }
};

const deleteChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;

    await chatService.deleteChatForUser(chatId, userId);

    res.status(200).json({
      success: true,
      message: 'Chat deleted successfully',
    });
  } catch (error) {
    console.error('[Chat] deleteChat:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete chat',
      error: error.message,
    });
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
    const { chatId } = req.params;
    const userId = req.user.id;
    const { page = 1, limit = 50 } = req.query;

    const hasAccess = await chatService.verifyUserAccess(chatId, userId);

    if (!hasAccess) {
      return res
        .status(403)
        .json({ success: false, message: 'Access denied to this chat' });
    }

    const messages = await messageService.getMessages(
      chatId,
      page,
      limit,
      userId
    );

    res.status(200).json({
      success: true,
      message: 'Messages retrieved successfully',
      data: messages,
    });
  } catch (error) {
    console.error('[Chat] getMessages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve messages',
      error: error.message,
    });
  }
};

/**
 * POST /chats/messages/text
 * Sends a text message to a chat and notifies participants via WebSocket.
 */
const sendTextMessage = async (req, res) => {
  try {
    const { userId, userType, uniqueCode } = req.user;
    const { chatId, content } = req.body;

    if (!chatId || !content) {
      return res
        .status(400)
        .json({ success: false, message: 'Chat ID and content are required' });
    }

    const message = await messageService.sendMessage({
      chatId,
      senderId: userId,
      senderType: userType,
      senderName: req.user.name,
      senderAvatar: req.user.avatar,
      messageType: 'text',
      content,
    });

    const chat = await chatService.getChatById(chatId, userId);
    websocket.default.sendMessageToChat(chat.participants, message, uniqueCode);

    const user = await User.findById(userId);

    const notification = await createNotification({
      title: req.user.name,
      description: content,
      priority: 'high',
      sourceId: 'chat',
      recipient: user.uniqueCode,
      time: new Date(),
    });

    await PushNotificationService.sendGeneralNotification(
      user.uniqueCode,
      req.user.name,
      content,
      'high',
      'normal',
      notification.data._id.toString()
    );

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: message,
    });
  } catch (error) {
    console.error('[Chat] sendTextMessage:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message',
      error: error.message,
    });
  }
};

/**
 * PUT /chats/:chatId/read
 * Marks all unread messages in a chat as read for the authenticated user.
 */
const markAsRead = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;
    const { uniqueCode } = req.user;

    const unreadMessages = await messageService.getUnreadMessagesForUser(
      chatId,
      userId
    );

    if (unreadMessages.length === 0) {
      return res
        .status(200)
        .json({ success: true, message: 'No unread messages' });
    }

    const messageIds = unreadMessages.map((msg) => msg._id);

    await messageService.markMessagesAsRead(chatId, messageIds, userId);

    const chat = await chatService.getChatById(chatId, userId);

    chat.participants.forEach((participant) => {
      if (participant.uniqueCode !== uniqueCode) {
        websocket.default.updateMessageStatus(
          participant.uniqueCode,
          messageIds,
          'read',
          chatId
        );
      }
    });

    res.status(200).json({
      success: true,
      message: 'Messages marked as read',
    });
  } catch (error) {
    console.error('[Chat] markAsRead:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark messages as read',
      error: error.message,
    });
  }
};

/**
 * DELETE /chats/messages/:messageId
 * Deletes a message for the user, or for everyone if deleteForEveryone is true.
 */
const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;
    const { deleteForEveryone } = req.body;

    await messageService.deleteMessage(messageId, userId, deleteForEveryone);

    res.status(200).json({
      success: true,
      message: 'Message deleted successfully',
    });
  } catch (error) {
    console.error('[Chat] deleteMessage:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete message',
      error: error.message,
    });
  }
};

const editMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    if (!content) {
      return res
        .status(400)
        .json({ success: false, message: 'Content is required' });
    }

    const updatedMessage = await messageService.editMessage(
      messageId,
      userId,
      content
    );

    res.status(200).json({
      success: true,
      message: 'Message edited successfully',
      data: updatedMessage,
    });
  } catch (error) {
    console.error('[Chat] editMessage:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to edit message',
      error: error.message,
    });
  }
};

const updateCaption = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { caption } = req.body;
    const userId = req.user.id;

    if (caption === undefined) {
      return res
        .status(400)
        .json({ success: false, message: 'Caption is required' });
    }

    const updatedMessage = await messageService.updateMessageCaption(
      messageId,
      userId,
      caption
    );

    res.status(200).json({
      success: true,
      message: 'Caption updated successfully',
      data: updatedMessage,
    });
  } catch (error) {
    console.error('[Chat] updateCaption:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update caption',
      error: error.message,
    });
  }
};

const forwardMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { targetChatId } = req.body;
    const userId = req.user.id || req.userId;

    if (!targetChatId) {
      return res
        .status(400)
        .json({ success: false, message: 'Target chat ID is required' });
    }

    const sender = await User.findById(userId)
      .select('name userType avatar')
      .lean();
    if (!sender) {
      return res
        .status(404)
        .json({ success: false, message: 'Authenticated user not found' });
    }

    const forwardedMessage = await messageService.forwardMessage(
      messageId,
      targetChatId,
      sender._id,
      sender.userType,
      sender.name,
      sender.avatar
    );

    const Chat = require('./chats.model');
    const targetChat = await Chat.findById(targetChatId).lean();
    const messagePayload = { ...forwardedMessage, chatId: targetChatId };

    if (targetChat?.participants?.length) {
      targetChat.participants.forEach((participant) => {
        if (!participant?.uniqueCode) return;
        global.io
          .to(`user_${participant.uniqueCode}`)
          .emit('new_message', messagePayload);
      });
    }

    res.status(201).json({
      success: true,
      message: 'Message forwarded successfully',
      data: forwardedMessage,
    });
  } catch (error) {
    console.error('[Chat] forwardMessage:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to forward message',
      error: error.message,
    });
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
    const { id } = req.user;
    const { chatId, file } = req.body;

    if (!chatId || !file) {
      return res.status(400).json({
        success: false,
        message: 'Chat ID and voice file are required',
      });
    }

    const userData = await User.findById(id);
    const { uploadUrl, fileKey } = await messageService.uploadFile(
      userData.email,
      'voice',
      file.mimetype
    );

    res.status(201).json({
      success: true,
      message: 'Voice message upload URL generated successfully',
      uploadUrl,
      fileKey,
      messageType: 'Voice Record',
    });
  } catch (error) {
    console.error('[Chat] uploadVoiceMessage:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload voice message',
      error: error.message,
    });
  }
};

/**
 * POST /chats/upload/image
 * Returns a pre-signed S3 URL for uploading an image.
 */
const uploadImage = async (req, res) => {
  try {
    const { id } = req.user;
    const { chatId, file } = req.body;

    if (!chatId || !file) {
      return res.status(400).json({
        success: false,
        message: 'Chat ID and image file are required',
      });
    }

    const userData = await User.findById(id);
    const { uploadUrl, fileKey } = await messageService.uploadFile(
      userData.email,
      'image',
      file.mimetype
    );

    res.status(201).json({
      success: true,
      message: 'Image upload URL generated successfully',
      uploadUrl,
      fileKey,
      messageType: 'Image',
    });
  } catch (error) {
    console.error('[Chat] uploadImage:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload image',
      error: error.message,
    });
  }
};

/**
 * POST /chats/upload/video
 * Returns a pre-signed S3 URL for uploading a video and generates a thumbnail.
 */
const uploadVideo = async (req, res) => {
  try {
    const { id } = req.user;
    const { chatId, file } = req.body;

    if (!chatId || !file) {
      return res.status(400).json({
        success: false,
        message: 'Chat ID and video file are required',
      });
    }

    const userData = await User.findById(id);
    const { uploadUrl, fileKey } = await messageService.uploadFile(
      userData.email,
      'video',
      file.mimetype
    );
    await messageService.generateThumbnail(fileKey);

    res.status(201).json({
      success: true,
      message: 'Video upload URL generated successfully',
      uploadUrl,
      fileKey,
      messageType: 'Video',
    });
  } catch (error) {
    console.error('[Chat] uploadVideo:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload video',
      error: error.message,
    });
  }
};

/**
 * POST /chats/upload/document
 * Returns a pre-signed S3 URL for uploading a document.
 */
const uploadDocument = async (req, res) => {
  try {
    const { id } = req.user;
    const { chatId, file } = req.body;

    if (!chatId || !file) {
      return res.status(400).json({
        success: false,
        message: 'Chat ID and document file are required',
      });
    }

    const userData = await User.findById(id);
    const { uploadUrl, fileKey } = await messageService.uploadFile(
      userData.email,
      'document',
      file.mimetype
    );

    res.status(201).json({
      success: true,
      message: 'Document upload URL generated successfully',
      uploadUrl,
      fileKey,
      messageType: 'Document',
    });
  } catch (error) {
    console.error('[Chat] uploadDocument:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload document',
      error: error.message,
    });
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
    const userId = req.user.id;
    const { page = 1, limit = 20 } = req.query;

    const callHistory = await messageService.getCallHistory(
      userId,
      page,
      limit
    );

    res.status(200).json({
      success: true,
      message: 'Call history retrieved successfully',
      data: callHistory,
    });
  } catch (error) {
    console.error('[Chat] getCallHistory:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve call history',
      error: error.message,
    });
  }
};

/**
 * POST /chats/calls
 * Saves a completed, missed, or rejected call record.
 */
const saveCallRecord = async (req, res) => {
  try {
    const userId = req.user.id;
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
      data: callRecord,
    });
  } catch (error) {
    console.error('[Chat] saveCallRecord:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save call record',
      error: error.message,
    });
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
  getChatPresence,
  updateGroupChat,
  leaveGroupChat,
  deleteChat,
  // Messages
  getMessages,
  sendTextMessage,
  markAsRead,
  deleteMessage,
  editMessage,
  updateCaption,
  forwardMessage,
  // Uploads
  uploadVoiceMessage,
  uploadImage,
  uploadVideo,
  uploadDocument,
  // Calls
  getCallHistory,
  saveCallRecord,
};
