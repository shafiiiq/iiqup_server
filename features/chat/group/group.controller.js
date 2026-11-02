const HTTP = require('#shared/response/response.status');
const { handleChatRoute, assertObjectId } = require('../shared/chat.route.handler');
const realtime = require('../shared/chat.realtime');
const groupService = require('./group.service');
const { createGroupSystemMessage } = require('./group.system.service');

const announce = async (chat, actor, events) => {
  for (const { event, targetNames } of events) {
    const message = await createGroupSystemMessage({ chat, actor, event, targetNames });
    realtime.broadcastSystemMessage(chat, message);
  }
};

const createGroupChat = handleChatRoute('createGroupChat', 'Failed to create group chat', async (req) => {
  const { id, uniqueCode, userType } = req.user;
  const { name, participants } = req.body;
  const { chat, actorName } = await groupService.createGroupChat({ creator: { id, uniqueCode }, name, participants });
  await announce(chat, { id, name: actorName, userType }, [{ event: 'created', targetNames: [] }]);
  return { status: HTTP.CREATED, message: 'Group chat created', data: chat };
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

module.exports = { createGroupChat, updateGroupChat, leaveGroupChat };