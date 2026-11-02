const HTTP = require('#shared/response/response.status');
const { AppError } = require('#shared/errors/error.http');
const Chat = require('./chat.model');

const getChatById = (chatId, userId) => Chat.findOne({ _id: chatId, 'participants.userId': userId }).lean();

const verifyUserAccess = async (chatId, userId) =>
  Boolean(await Chat.exists({ _id: chatId, 'participants.userId': userId }));

const requireChat = async (chatId, userId) => {
  const chat = await getChatById(chatId, userId);
  if (!chat) throw new AppError('Chat not found or access denied', HTTP.NOT_FOUND);
  return chat;
};

module.exports = { getChatById, verifyUserAccess, requireChat };