// services/chat.service.js
const Chat = require('../models/chats.model');
const Message = require('../models/messages.model');
const User = require('../models/user.model'); 
const mongoose = require('mongoose');

// ########### CHAT MANAGEMENT ###########

// Get all chats for a user (with optional team filter)
const getUserChats = async (userId, userType, teamType = null) => {
  try {
    const query = {
      'participants.userId': userId,
      'participants.userType': userType
    };

    if (teamType && teamType !== 'all') {
      query.teamType = teamType;
    }

    const chats = await Chat.find(query)
      .sort({ lastMessageTime: -1 })
      .lean();

    // Format response with unread count for this user
    const formattedChats = chats.map(chat => {
      // With .lean(), unreadCount is a plain object, not a Map
      const unreadCount = chat.unreadCount?.[userId.toString()] || 0;

      return {
        ...chat,
        unreadCount,
        participants: chat.participants.filter(p => p.userId.toString() !== userId.toString())
      };
    });

    return formattedChats;
  } catch (error) {
    console.error('Error getting user chats:', error);
    throw error;
  }
};

// Get or create individual chat between two users
const getOrCreateIndividualChat = async ({ user1, user2, teamType }) => {
  try {
    // Check if chat already exists between these two users
    const existingChat = await Chat.findOne({
      type: 'individual',
      teamType,
      'participants.userId': { $all: [user1.userId, user2.userId] }
    }).lean();

    if (existingChat) {
      return existingChat;
    }

    // Get user details
    const user1Details = await User.findById(user1.userId).select('name email').lean();
    const user2Details = await User.findById(user2.userId).select('name email').lean();

    // Create new individual chat
    const newChat = await Chat.create({
      type: 'individual',
      teamType,
      participants: [
        {
          userId: user1.userId,
          userType: user1.userType,
          uniqueCode: user1.uniqueCode,
          name: user1Details.name,
          avatar: user1Details.name.substring(0, 2).toUpperCase()
        },
        {
          userId: user2.userId,
          userType: user2.userType,
          uniqueCode: user2.uniqueCode,
          name: user2Details.name,
          avatar: user2Details.name.substring(0, 2).toUpperCase()
        }
      ],
      lastMessage: '',
      lastMessageTime: new Date(),
      unreadCount: {}
    });

    return newChat;
  } catch (error) {
    console.error('Error getting/creating individual chat:', error);
    throw error;
  }
};

// Create group chat
const createGroupChat = async ({ name, teamType, participants, avatar, creatorId }) => {
  try {
    // Get participant details from User collection
    const participantIds = participants.map(p => p.userId);
    const userDetails = await User.find({ _id: { $in: participantIds } })
      .select('name email')
      .lean();

    // Map user details to participants
    const enrichedParticipants = participants.map(p => {
      const userDetail = userDetails.find(u => u._id.toString() === p.userId.toString());
      return {
        userId: p.userId,
        userType: p.userType,
        uniqueCode: p.uniqueCode,
        name: userDetail?.name || 'Unknown',
        avatar: userDetail?.name?.substring(0, 2).toUpperCase() || 'UN'
      };
    });

    // Create group chat
    const groupChat = await Chat.create({
      type: 'group',
      name,
      teamType,
      participants: enrichedParticipants,
      avatar: avatar || '👥',
      lastMessage: 'Group created',
      lastMessageTime: new Date(),
      unreadCount: {}
    });

    return groupChat;
  } catch (error) {
    console.error('Error creating group chat:', error);
    throw error;
  }
};

// Get chat by ID
const getChatById = async (chatId, userId) => {
  try {
    const chat = await Chat.findOne({
      _id: chatId,
      'participants.userId': userId
    }).lean();

    return chat;
  } catch (error) {
    console.error('Error getting chat by ID:', error);
    throw error;
  }
};

// Update group chat
const updateGroupChat = async (chatId, userId, updates) => {
  try {
    const chat = await Chat.findOne({
      _id: chatId,
      type: 'group',
      'participants.userId': userId
    });

    if (!chat) {
      return null;
    }

    // Update name
    if (updates.name) {
      chat.name = updates.name;
    }

    // Update avatar
    if (updates.avatar) {
      chat.avatar = updates.avatar;
    }

    // Add participants
    if (updates.addParticipants && updates.addParticipants.length > 0) {
      const participantIds = updates.addParticipants.map(p => p.userId);
      const userDetails = await User.find({ _id: { $in: participantIds } })
        .select('name email')
        .lean();

      const newParticipants = updates.addParticipants.map(p => {
        const userDetail = userDetails.find(u => u._id.toString() === p.userId.toString());
        return {
          userId: p.userId,
          userType: p.userType,
          uniqueCode: p.uniqueCode,
          name: userDetail?.name || 'Unknown',
          avatar: userDetail?.name?.substring(0, 2).toUpperCase() || 'UN'
        };
      });

      chat.participants.push(...newParticipants);
    }

    // Remove participants
    if (updates.removeParticipants && updates.removeParticipants.length > 0) {
      chat.participants = chat.participants.filter(
        p => !updates.removeParticipants.includes(p.userId.toString())
      );
    }

    await chat.save();
    return chat;
  } catch (error) {
    console.error('Error updating group chat:', error);
    throw error;
  }
};

// Delete chat for a user (soft delete)
const deleteChatForUser = async (chatId, userId) => {
  try {
    // For individual chats, we could keep a deletedFor array
    // For now, we'll just remove the user from participants if it's a group
    // Or mark chat as inactive for the user

    const chat = await Chat.findById(chatId);

    if (!chat) {
      throw new Error('Chat not found');
    }

    // Simple approach: Remove all messages for this user
    // You can implement a more sophisticated soft delete
    await Message.updateMany(
      { chatId },
      { $addToSet: { deletedFor: userId } }
    );

    return true;
  } catch (error) {
    console.error('Error deleting chat:', error);
    throw error;
  }
};

// Verify user has access to chat
const verifyUserAccess = async (chatId, userId) => {
  try {
    const chat = await Chat.findOne({
      _id: chatId,
      'participants.userId': userId
    });

    return !!chat;
  } catch (error) {
    console.error('Error verifying user access:', error);
    return false;
  }
};

// Update last message in chat
const updateLastMessage = async (chatId, messageContent, senderId, senderName) => {
  try {
    await Chat.findByIdAndUpdate(chatId, {
      lastMessage: messageContent,
      lastMessageTime: new Date(),
      lastMessageSender: {
        userId: senderId,
        name: senderName
      }
    });
  } catch (error) {
    console.error('Error updating last message:', error);
    throw error;
  }
};

// Increment unread count for participants
const incrementUnreadCount = async (chatId, senderId) => {
  try {
    const chat = await Chat.findById(chatId);

    if (!chat) {
      throw new Error('Chat not found');
    }

    // Increment unread count for all participants except sender
    chat.participants.forEach(participant => {
      if (participant.userId.toString() !== senderId.toString()) {
        const currentCount = chat.unreadCount.get(participant.userId.toString()) || 0;
        chat.unreadCount.set(participant.userId.toString(), currentCount + 1);
      }
    });

    await chat.save();
  } catch (error) {
    console.error('Error incrementing unread count:', error);
    throw error;
  }
};

// Reset unread count for user
const resetUnreadCount = async (chatId, userId) => {
  try {
    await Chat.findByIdAndUpdate(chatId, {
      [`unreadCount.${userId}`]: 0
    });
  } catch (error) {
    console.error('Error resetting unread count:', error);
    throw error;
  }
};

module.exports = {
  getUserChats,
  getOrCreateIndividualChat,
  createGroupChat,
  getChatById,
  updateGroupChat,
  deleteChatForUser,
  verifyUserAccess,
  updateLastMessage,
  incrementUnreadCount,
  resetUnreadCount,
};