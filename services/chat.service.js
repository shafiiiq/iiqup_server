// services/chat.service.js
const Chat = require('../models/chats.model');
const Message = require('../models/messages.model');
const User = require('../models/user.model');
const mongoose = require('mongoose');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const toAvatar = (name) => name?.substring(0, 2).toUpperCase() || 'UN';

const buildGroupSystemMessage = ({
  event,
  actorName,
  targetNames = [],
  groupName,
}) => {
  const actor = actorName || 'Someone';
  const targets = (targetNames || []).filter(Boolean);

  switch (event) {
    case 'created':
      return `${actor} created the group${groupName ? ` “${groupName}”` : ''}`;
    case 'added':
      if (targets.length === 0) return `${actor} added members`;
      if (targets.length === 1) return `${actor} added ${targets[0]}`;
      if (targets.length === 2)
        return `${actor} added ${targets[0]} and ${targets[1]}`;
      return `${actor} added ${targets.slice(0, -1).join(', ')} and ${targets[targets.length - 1]}`;
    case 'removed':
      if (targets.length === 0) return `${actor} removed a member`;
      if (targets.length === 1) return `${actor} removed ${targets[0]}`;
      if (targets.length === 2)
        return `${actor} removed ${targets[0]} and ${targets[1]}`;
      return `${actor} removed ${targets.slice(0, -1).join(', ')} and ${targets[targets.length - 1]}`;
    case 'left':
      return `${actor} left the group`;
    case 'promoted':
      if (targets.length === 0) return `${actor} promoted a member to admin`;
      if (targets.length === 1)
        return `${actor} promoted ${targets[0]} to admin`;
      if (targets.length === 2)
        return `${actor} promoted ${targets[0]} and ${targets[1]} to admin`;
      return `${actor} promoted ${targets.slice(0, -1).join(', ')} and ${targets[targets.length - 1]} to admin`;
    default:
      return `${actor} updated the group`;
  }
};

const enrichParticipants = async (participants) => {
  const ids = participants.map((p) => p.userId);
  const userDetails = await User.find({ _id: { $in: ids } })
    .select('name email')
    .lean();

  return participants.map((p) => {
    const user = userDetails.find(
      (u) => u._id.toString() === p.userId.toString()
    );
    return {
      userId: p.userId,
      userType: p.userType || 'office',
      uniqueCode: p.uniqueCode,
      name: user?.name || 'Unknown',
      avatar: toAvatar(user?.name),
      isAdmin: Boolean(p.isAdmin),
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
    console.log(
      'getUserChats called for userId:',
      userId,
      'userType:',
      userType,
      'teamType:',
      teamType
    );
    const userIdString = String(userId || '');
    const isObjectId = mongoose.Types.ObjectId.isValid(userIdString);
    const participantMatch = isObjectId
      ? { userId: new mongoose.Types.ObjectId(userIdString) }
      : { uniqueCode: userIdString };

    if (userType) {
      participantMatch.userType = userType;
    }

    const query = {
      $and: [
        {
          participants: {
            $elemMatch: participantMatch,
          },
        },
      ],
    };

    if (teamType && teamType !== 'all') {
      query.$and.push({ teamType });
    }

    const chats = await Chat.find(query).sort({ lastMessageTime: -1 }).lean();

    console.log('Found chats count:', chats.length);
    return chats.map((chat) => ({
      ...chat,
      unreadCount: chat.unreadCount?.[userId.toString()] || 0,
      participants: chat.participants.filter((p) =>
        isObjectId
          ? p.userId.toString() !== userId.toString()
          : p.uniqueCode !== userIdString
      ),
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
      type: 'individual',
      teamType,
      'participants.userId': { $all: [user1.userId, user2.userId] },
    }).lean();

    if (existingChat) return existingChat;

    const [user1Details, user2Details] = await Promise.all([
      User.findById(user1.userId).select('name email').lean(),
      User.findById(user2.userId).select('name email').lean(),
    ]);

    const newChat = await Chat.create({
      type: 'individual',
      teamType,
      participants: [
        {
          userId: user1.userId,
          userType: user1.userType,
          uniqueCode: user1.uniqueCode,
          name: user1Details.name,
          avatar: toAvatar(user1Details.name),
        },
        {
          userId: user2.userId,
          userType: user2.userType,
          uniqueCode: user2.uniqueCode,
          name: user2Details.name,
          avatar: toAvatar(user2Details.name),
        },
      ],
      lastMessage: '',
      lastMessageTime: new Date(),
      unreadCount: {},
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
const createGroupChat = async ({
  name,
  teamType,
  participants,
  avatar,
  creatorId,
}) => {
  try {
    const enrichedParticipants = await enrichParticipants(participants);

    const groupChat = await Chat.create({
      type: 'group',
      name,
      teamType,
      participants: enrichedParticipants,
      avatar: avatar || '👥',
      lastMessage: 'Group created',
      lastMessageTime: new Date(),
      unreadCount: {},
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
      _id: chatId,
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
      _id: chatId,
      type: 'group',
      'participants.userId': userId,
    });

    if (!chat) return null;

    const currentUserParticipant = chat.participants.find(
      (p) => p.userId.toString() === userId.toString()
    );
    const isAdmin = currentUserParticipant?.isAdmin;

    if (!isAdmin) {
      throw new Error('Only group admins can manage members');
    }

    if (updates.name) chat.name = updates.name;
    if (updates.avatar) chat.avatar = updates.avatar;

    if (updates.addParticipants?.length > 0) {
      const existingIds = new Set(
        chat.participants.map((p) => p.userId.toString())
      );
      const newParticipants = await enrichParticipants(
        updates.addParticipants
          .filter(
            (participant) =>
              !existingIds.has(String(participant.userId || participant._id))
          )
          .map((participant) => ({ ...participant, isAdmin: false }))
      );
      chat.participants.push(...newParticipants);
    }

    if (updates.removeParticipants?.length > 0) {
      chat.participants = chat.participants.filter(
        (p) =>
          !updates.removeParticipants.some(
            (id) => String(id) === String(p.userId)
          )
      );
    }

    if (updates.promoteParticipants?.length > 0) {
      chat.participants = chat.participants.map((participant) => {
        if (
          updates.promoteParticipants.some(
            (id) => String(id) === String(participant.userId)
          )
        ) {
          return { ...participant, isAdmin: true };
        }
        return participant;
      });
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
const leaveGroupChat = async (chatId, userId) => {
  try {
    const chat = await Chat.findOne({
      _id: chatId,
      type: 'group',
      'participants.userId': userId,
    });

    if (!chat) return null;

    const currentParticipant = chat.participants.find(
      (p) => p.userId.toString() === userId.toString()
    );
    if (!currentParticipant) return null;

    chat.participants = chat.participants.filter(
      (p) => p.userId.toString() !== userId.toString()
    );

    if (chat.participants.length > 0) {
      const hasAdmin = chat.participants.some((p) => p.isAdmin);
      if (!hasAdmin) {
        chat.participants[0].isAdmin = true;
      }
    }

    await chat.save();
    return chat;
  } catch (error) {
    console.error('[ChatService] leaveGroupChat:', error);
    throw error;
  }
};

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
      _id: chatId,
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
const updateLastMessage = async (
  chatId,
  messageContent,
  senderId,
  senderName,
  messageType
) => {
  try {
    await Chat.findByIdAndUpdate(chatId, {
      lastMessage: messageContent,
      lastMessageType: messageType || 'text',
      lastMessageTime: new Date(),
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

    chat.participants.forEach((participant) => {
      if (participant.userId.toString() !== senderId.toString()) {
        const current =
          chat.unreadCount.get(participant.userId.toString()) || 0;
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
  leaveGroupChat,
  deleteChatForUser,
  verifyUserAccess,
  buildGroupSystemMessage,
  // Message Tracking
  updateLastMessage,
  incrementUnreadCount,
  resetUnreadCount,
};
