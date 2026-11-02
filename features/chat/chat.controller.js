const HTTP = require('#shared/response/response.status');
const { AppError } = require('#shared/errors/error.http');
const { handleChatRoute, assertObjectId } = require('./chat.route.handler');
const chatService = require('./chat.service');
const groupService = require('./chat.group.service');
const systemMessages = require('./message/message.system.service');
const realtime = require('./chat.realtime');

const loadChatForUser = async (chatId, userId) => {
  const chat = await chatService.getChatById(chatId, userId);
  if (!chat) throw new AppError('Chat not found or access denied', HTTP.NOT_FOUND);
  return chat;
};

const announce = async (chat, actor, events) => {
  for (const { event, targetNames } of events) {
    const message = await systemMessages.createGroupSystemMessage({ chat, actor, event, targetNames });
    realtime.broadcastSystemMessage(chat, message);
  }
};

const getUserChats = handleChatRoute('getUserChats', 'Failed to retrieve chats', async (req) => ({
  message: 'Chats retrieved',
  data: await chatService.getUserChats(req.user.id, req.query.userType, req.query.teamType),
}));

const getOrCreateIndividualChat = handleChatRoute('getOrCreateIndividualChat', 'Failed to open chat', async (req) => {
  const { targetUniqueCode, teamType } = req.body;
  if (!targetUniqueCode || !teamType) throw new AppError('targetUniqueCode and teamType are required', HTTP.BAD_REQUEST);
  const chat = await chatService.getOrCreateIndividualChat({
    me: { uniqueCode: req.user.uniqueCode },
    targetUniqueCode,
    teamType,
  });
  return { message: 'Chat retrieved', data: chat };
});

const createGroupChat = handleChatRoute('createGroupChat', 'Failed to create group chat', async (req) => {
  const { id, uniqueCode, userType } = req.user;
  const { name, teamType, participants } = req.body;
  const { chat, actorName } = await groupService.createGroupChat({
    creator: { id, uniqueCode },
    name,
    teamType,
    participants,
  });
  await announce(chat, { id, name: actorName, userType }, [{ event: 'created', targetNames: [] }]);
  return { status: HTTP.CREATED, message: 'Group chat created', data: chat };
});

const getChatDetails = handleChatRoute('getChatDetails', 'Failed to retrieve chat', async (req) => {
  const chatId = assertObjectId(req.params.chatId, 'chat id');
  return { message: 'Chat retrieved', data: await loadChatForUser(chatId, req.user.id) };
});

const getChatPresence = handleChatRoute('getChatPresence', 'Failed to retrieve presence', async (req) => {
  const chatId = assertObjectId(req.params.chatId, 'chat id');
  const chat = await loadChatForUser(chatId, req.user.id);
  const presence = chat.participants
    .filter((participant) => String(participant.userId) !== String(req.user.id))
    .map((participant) => ({
      chatId,
      userId: participant.userId,
      uniqueCode: participant.uniqueCode,
      isOnline: realtime.isOnline(participant.uniqueCode),
    }));
  return { message: 'Presence retrieved', data: presence };
});

const updateGroupChat = handleChatRoute('updateGroupChat', 'Failed to update group chat', async (req) => {
  const chatId = assertObjectId(req.params.chatId, 'chat id');
  const { chat, actorName, events } = await groupService.updateGroupChat(chatId, req.user.id, req.body);
  await announce(chat, { id: req.user.id, name: actorName, userType: req.user.userType }, events);
  return { message: 'Group updated', data: chat };
});

const leaveGroupChat = handleChatRoute('leaveGroupChat', 'Failed to leave group', async (req) => {
  const chatId = assertObjectId(req.params.chatId, 'chat id');
  const { chat, actorName } = await groupService.leaveGroupChat(chatId, req.user.id);
  await announce(chat, { id: req.user.id, name: actorName, userType: req.user.userType }, [
    { event: 'left', targetNames: [] },
  ]);
  return { message: 'Left group', data: chat };
});

const deleteChat = handleChatRoute('deleteChat', 'Failed to delete chat', async (req) => {
  const chatId = assertObjectId(req.params.chatId, 'chat id');
  await chatService.deleteChatForUser(chatId, req.user.id);
  return { message: 'Chat deleted' };
});

module.exports = {
  getUserChats,
  getOrCreateIndividualChat,
  createGroupChat,
  getChatDetails,
  getChatPresence,
  updateGroupChat,
  leaveGroupChat,
  deleteChat,
};