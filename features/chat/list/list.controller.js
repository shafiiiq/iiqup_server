const HTTP = require('#shared/response/response.status');
const { AppError } = require('#shared/errors/error.http');
const { handleChatRoute, assertObjectId } = require('../shared/chat.route.handler');
const { requireChat } = require('../shared/chat.access.service');
const listService = require('./list.service');

const getUserChats = handleChatRoute('getUserChats', 'Failed to retrieve chats', async (req) => ({
  message: 'Chats retrieved',
  data: await listService.getUserChats(req.user.id),
}));

const getOrCreateIndividualChat = handleChatRoute('getOrCreateIndividualChat', 'Failed to open chat', async (req) => {
  const { targetUniqueCode } = req.body;
  if (!targetUniqueCode) throw new AppError('targetUniqueCode is required', HTTP.BAD_REQUEST);
  const chat = await listService.getOrCreateIndividualChat({ me: { uniqueCode: req.user.uniqueCode }, targetUniqueCode });
  return { message: 'Chat retrieved', data: chat };
});

const getChatDetails = handleChatRoute('getChatDetails', 'Failed to retrieve chat', async (req) => {
  const chatId = assertObjectId(req.params.chatId, 'chat id');
  return { message: 'Chat retrieved', data: await requireChat(chatId, req.user.id) };
});

const setFavorite = handleChatRoute('setFavorite', 'Failed to update favorite', async (req) => {
  const chatId = assertObjectId(req.params.chatId, 'chat id');
  await listService.setFavorite(chatId, req.user.id, Boolean(req.body.isFavorite));
  return { message: 'Favorite updated' };
});

const deleteChat = handleChatRoute('deleteChat', 'Failed to delete chat', async (req) => {
  const chatId = assertObjectId(req.params.chatId, 'chat id');
  await listService.deleteChatForUser(chatId, req.user.id);
  return { message: 'Chat deleted' };
});

module.exports = { getUserChats, getOrCreateIndividualChat, getChatDetails, setFavorite, deleteChat };