// services/chat.service.js
const Chat     = require('../models/chats.model');
const Message  = require('../models/messages.model');
const User     = require('../models/user.model');
const mongoose = require('mongoose');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const toAvatar = (name) => name?.substring(0, 2).toUpperCase() || 'UN';

const enrichParticipants = async (participants) => {
  const ids         = participants.map(p => p.userId);
  const userDetails = await User.find({ _id: { $in: ids } }).select('name email').lean();

  return participants.map(p => {
    const user = userDetails.find(u => u._id.toString() === p.userId.toString());
    return {
      userId:     p.userId,
      userType:   p.userType,
      uniqueCode: p.uniqueCode,
      name:       user?.name || 'Unknown',
      avatar:     toAvatar(user?.name),
    };
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// Chat Management
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns all chats for a user, optionally filtered by team type.
 * Unread count is resolved per-user and other-participants are pre-filtered.
 */
const getUserChats = async (userId, userType, teamType = null) => {
  try {
    const query = {
      $and: [
        {
          participants: {
            $elemMatch: { userId: new mongoose.Types.ObjectId(userId.toString()), userType }
          }
        }
      ]
    };

    if (teamType && teamType !== 'all') {
      query.$and.push({ teamType });
    }

    const chats = await Chat.find(query).sort({ lastMessageTime: -1 }).lean();

    return chats.map(chat => ({
      ...chat,
      unreadCount:  chat.unreadCount?.[userId.toString()] || 0,
      participants: chat.participants.filter(p => p.userId.toString() !== userId.toString()),
    }));
  } catch (error) {
    console.error('[ChatService] getUserChats:', error);
    throw error;
  }
};

/**
 * Returns an existing individual chat between two users,
 * or creates one if it does not exist.
 */
const getOrCreateIndividualChat = async ({ user1, user2, teamType }) => {
  try {
    const existingChat = await Chat.findOne({
      type:                    'individual',
      teamType,
      'participants.userId':   { $all: [user1.userId, user2.userId] },
    }).lean();

    if (existingChat) return existingChat;

    const [user1Details, user2Details] = await Promise.all([
      User.findById(user1.userId).select('name email').lean(),
      User.findById(user2.userId).select('name email').lean(),
    ]);

    const newChat = await Chat.create({
      type:            'individual',
      teamType,
      participants: [
        {
          userId:     user1.userId,
          userType:   user1.userType,
          uniqueCode: user1.uniqueCode,
          name:       user1Details.name,
          avatar:     toAvatar(user1Details.name),
        },
        {
          userId:     user2.userId,
          userType:   user2.userType,
          uniqueCode: user2.uniqueCode,
          name:       user2Details.name,
          avatar:     toAvatar(user2Details.name),
        },
      ],
      lastMessage:     '',
      lastMessageTime: new Date(),
      unreadCount:     {},
    });

    return newChat;
  } catch (error) {
    console.error('[ChatService] getOrCreateIndividualChat:', error);
    throw error;
  }
};

/**
 * Creates a new group chat with enriched participant details.
 */
const createGroupChat = async ({ name, teamType, participants, avatar, creatorId }) => {
  try {
    const enrichedParticipants = await enrichParticipants(participants);

    const groupChat = await Chat.create({
      type:            'group',
      name,
      teamType,
      participants:    enrichedParticipants,
      avatar:          avatar || '👥',
      lastMessage:     'Group created',
      lastMessageTime: new Date(),
      unreadCount:     {},
    });

    return groupChat;
  } catch (error) {
    console.error('[ChatService] createGroupChat:', error);
    throw error;
  }
};

/**
 * Returns a chat by ID, verifying the requesting user is a participant.
 */
const getChatById = async (chatId, userId) => {
  try {
    const chat = await Chat.findOne({
      _id:                   chatId,
      'participants.userId': userId,
    }).lean();

    return chat;
  } catch (error) {
    console.error('[ChatService] getChatById:', error);
    throw error;
  }
};

/**
 * Updates a group chat's name, avatar, or participant list.
 * Returns null if the chat is not found or the user is not a participant.
 */
const updateGroupChat = async (chatId, userId, updates) => {
  try {
    const chat = await Chat.findOne({
      _id:                   chatId,
      type:                  'group',
      'participants.userId': userId,
    });

    if (!chat) return null;

    if (updates.name)   chat.name   = updates.name;
    if (updates.avatar) chat.avatar = updates.avatar;

    if (updates.addParticipants?.length > 0) {
      const newParticipants = await enrichParticipants(updates.addParticipants);
      chat.participants.push(...newParticipants);
    }

    if (updates.removeParticipants?.length > 0) {
      chat.participants = chat.participants.filter(
        p => !updates.removeParticipants.includes(p.userId.toString())
      );
    }

    await chat.save();
    return chat;
  } catch (error) {
    console.error('[ChatService] updateGroupChat:', error);
    throw error;
  }
};

/**
 * Soft-deletes all messages in a chat for a specific user.
 */
const deleteChatForUser = async (chatId, userId) => {
  try {
    const chat = await Chat.findById(chatId);

    if (!chat) throw new Error('Chat not found');

    await Message.updateMany({ chatId }, { $addToSet: { deletedFor: userId } });

    return true;
  } catch (error) {
    console.error('[ChatService] deleteChatForUser:', error);
    throw error;
  }
};

/**
 * Returns true if the user is a participant in the given chat.
 */
const verifyUserAccess = async (chatId, userId) => {
  try {
    const chat = await Chat.findOne({
      _id:                   chatId,
      'participants.userId': userId,
    });

    return !!chat;
  } catch (error) {
    console.error('[ChatService] verifyUserAccess:', error);
    return false;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Message Tracking
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Updates the last message preview and sender on a chat.
 */
const updateLastMessage = async (chatId, messageContent, senderId, senderName) => {
  try {
    await Chat.findByIdAndUpdate(chatId, {
      lastMessage:       messageContent,
      lastMessageTime:   new Date(),
      lastMessageSender: { userId: senderId, name: senderName },
    });
  } catch (error) {
    console.error('[ChatService] updateLastMessage:', error);
    throw error;
  }
};

/**
 * Increments the unread message count for all participants except the sender.
 */
const incrementUnreadCount = async (chatId, senderId) => {
  try {
    const chat = await Chat.findById(chatId);

    if (!chat) throw new Error('Chat not found');

    chat.participants.forEach(participant => {
      if (participant.userId.toString() !== senderId.toString()) {
        const current = chat.unreadCount.get(participant.userId.toString()) || 0;
        chat.unreadCount.set(participant.userId.toString(), current + 1);
      }
    });

    await chat.save();
  } catch (error) {
    console.error('[ChatService] incrementUnreadCount:', error);
    throw error;
  }
};

/**
 * Resets the unread message count to zero for a specific user in a chat.
 */
const resetUnreadCount = async (chatId, userId) => {
  try {
    await Chat.findByIdAndUpdate(chatId, {
      [`unreadCount.${userId}`]: 0,
    });
  } catch (error) {
    console.error('[ChatService] resetUnreadCount:', error);
    throw error;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  // Chat Management
  getUserChats,
  getOrCreateIndividualChat,
  createGroupChat,
  getChatById,
  updateGroupChat,
  deleteChatForUser,
  verifyUserAccess,
  // Message Tracking
  updateLastMessage,
  incrementUnreadCount,
  resetUnreadCount,
};