const mongoose = require('mongoose');
const HTTP = require('#shared/response/response.status');
const { AppError } = require('#shared/errors/error.http');
const Chat = require('../shared/chat.model');
const Message = require('../message/message.model');
const { CHAT_TYPES } = require('../shared/chat.constant');
const { resolveParticipants } = require('../shared/chat.participant.resolver');
const { verifyUserAccess } = require('../shared/chat.access.service');

const toObjectId = (value) => new mongoose.Types.ObjectId(String(value));

const getUserChats = async (userId) => {
  const userObjectId = toObjectId(userId);
  const chats = await Chat.find({ 'participants.userId': userObjectId, hiddenFor: { $ne: userObjectId } })
    .sort({ lastMessageTime: -1 })
    .lean();

  return chats.map(({ favoriteFor = [], hiddenFor, ...chat }) => ({
    ...chat,
    isFavorite: favoriteFor.some((id) => String(id) === String(userId)),
    unreadCount: chat.unreadCount?.[String(userId)] || 0,
    participants:
      chat.type === CHAT_TYPES.INDIVIDUAL
        ? chat.participants.filter((participant) => String(participant.userId) !== String(userId))
        : chat.participants,
  }));
};

const getOrCreateIndividualChat = async ({ me, targetUniqueCode }) => {
  if (me.uniqueCode === targetUniqueCode) throw new AppError('You cannot chat with yourself', HTTP.BAD_REQUEST);

  const members = await resolveParticipants([{ uniqueCode: me.uniqueCode }, { uniqueCode: targetUniqueCode }]);
  if (members.length < 2) throw new AppError('User not found', HTTP.NOT_FOUND);

  const myId = members.find((member) => member.uniqueCode === me.uniqueCode).userId;
  const existing = await Chat.findOneAndUpdate(
    {
      type: CHAT_TYPES.INDIVIDUAL,
      participants: { $size: 2 },
      'participants.userId': { $all: members.map((member) => member.userId) },
    },
    { $pull: { hiddenFor: toObjectId(myId) } },
    { new: true }
  ).lean();
  if (existing) return existing;

  const created = await Chat.create({ type: CHAT_TYPES.INDIVIDUAL, participants: members });
  return created.toObject();
};

const deleteChatForUser = async (chatId, userId) => {
  if (!(await verifyUserAccess(chatId, userId))) throw new AppError('Chat not found or access denied', HTTP.NOT_FOUND);

  await Promise.all([
    Message.updateMany({ chatId }, { $addToSet: { deletedFor: userId } }),
    Chat.updateOne({ _id: chatId }, { $addToSet: { hiddenFor: userId }, $set: { [`unreadCount.${userId}`]: 0 } }),
  ]);
};

const setFavorite = async (chatId, userId, isFavorite) => {
  if (!(await verifyUserAccess(chatId, userId))) throw new AppError('Chat not found or access denied', HTTP.NOT_FOUND);
  await Chat.updateOne({ _id: chatId }, isFavorite ? { $addToSet: { favoriteFor: userId } } : { $pull: { favoriteFor: userId } });
};

module.exports = { getUserChats, getOrCreateIndividualChat, deleteChatForUser, setFavorite };