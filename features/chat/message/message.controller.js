const HTTP = require('#shared/response/response.status');
const { AppError } = require('#shared/errors/error.http');
const { handleChatRoute, assertObjectId } = require('../shared/chat.route.handler');
const { requireChat, verifyUserAccess } = require('../shared/chat.access.service');
const realtime = require('../shared/chat.realtime');
const messageService = require('./message.service');

const getMessages = handleChatRoute('getMessages', 'Failed to retrieve messages', async (req) => {
  const chatId = assertObjectId(req.params.chatId, 'chat id');
  if (!(await verifyUserAccess(chatId, req.user.id))) throw new AppError('Access denied to this chat', HTTP.FORBIDDEN);
  const result = await messageService.getMessages(chatId, req.pagination, req.user.id);
  return { message: 'Messages retrieved', data: result.data, pagination: result.pagination };
});

const getChatPresence = handleChatRoute('getChatPresence', 'Failed to retrieve presence', async (req) => {
  const chatId = assertObjectId(req.params.chatId, 'chat id');
  const chat = await requireChat(chatId, req.user.id);
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

const sendTextMessage = handleChatRoute('sendTextMessage', 'Failed to send message', async (req) => {
  const { id, uniqueCode, name, userType } = req.user;
  const chatId = assertObjectId(req.body.chatId, 'chat id');
  if (!req.body.content) throw new AppError('Content is required', HTTP.BAD_REQUEST);

  const message = await messageService.sendMessage({
    chatId,
    senderId: id,
    senderType: userType,
    senderName: name,
    messageType: 'text',
    content: req.body.content,
  });
  const chat = await requireChat(chatId, id);
  realtime.broadcastNewMessage(chat, message.toObject(), uniqueCode);
  return { status: HTTP.CREATED, message: 'Message sent', data: message };
});

const markAsRead = handleChatRoute('markAsRead', 'Failed to mark messages as read', async (req) => {
  const chatId = assertObjectId(req.params.chatId, 'chat id');
  const { id } = req.user;
  const chat = await requireChat(chatId, id);

  const unread = await messageService.getUnreadMessagesForUser(chatId, id);
  if (unread.length === 0) return { message: 'No unread messages' };

  await messageService.markMessagesAsRead(chatId, unread.map((message) => message._id), id);

  const idsBySender = new Map();
  unread.forEach((message) => {
    const senderId = String(message.senderId);
    idsBySender.set(senderId, [...(idsBySender.get(senderId) || []), String(message._id)]);
  });
  idsBySender.forEach((messageIds, senderId) => {
    const sender = chat.participants.find((participant) => String(participant.userId) === senderId);
    if (!sender) return;
    realtime.emitToParticipants([sender], 'message_status_update', {
      messageIds,
      chatId,
      status: 'read',
      userId: id,
      readAt: new Date().toISOString(),
    });
  });

  return { message: 'Messages marked as read' };
});

const deleteMessage = handleChatRoute('deleteMessage', 'Failed to delete message', async (req) => {
  const messageId = assertObjectId(req.params.messageId, 'message id');
  const deleteForEveryone = Boolean(req.body.deleteForEveryone);

  const result = await messageService.deleteMessage(messageId, req.user.id, deleteForEveryone);
  if (deleteForEveryone) {
    const chat = await requireChat(result.chatId, req.user.id);
    realtime.broadcastMessageUpdate(chat, result.message, req.user.uniqueCode);
  }
  return { message: 'Message deleted' };
});

const editMessage = handleChatRoute('editMessage', 'Failed to edit message', async (req) => {
  const messageId = assertObjectId(req.params.messageId, 'message id');
  const message = await messageService.editMessage(messageId, req.user.id, req.body.content);
  const chat = await requireChat(message.chatId, req.user.id);
  realtime.broadcastMessageUpdate(chat, message, req.user.uniqueCode);
  return { message: 'Message edited', data: message };
});

const updateCaption = handleChatRoute('updateCaption', 'Failed to update caption', async (req) => {
  const messageId = assertObjectId(req.params.messageId, 'message id');
  if (req.body.caption === undefined) throw new AppError('Caption is required', HTTP.BAD_REQUEST);
  const message = await messageService.updateMessageCaption(messageId, req.user.id, req.body.caption);
  const chat = await requireChat(message.chatId, req.user.id);
  realtime.broadcastMessageUpdate(chat, message, req.user.uniqueCode);
  return { message: 'Caption updated', data: message };
});

const forwardMessage = handleChatRoute('forwardMessage', 'Failed to forward message', async (req) => {
  const messageId = assertObjectId(req.params.messageId, 'message id');
  const targetChatId = assertObjectId(req.body.targetChatId, 'target chat id');
  const { id, userType, name, uniqueCode } = req.user;

  const forwarded = await messageService.forwardMessage({ messageId, targetChatId, sender: { id, type: userType, name } });
  const chat = await requireChat(targetChatId, id);
  realtime.broadcastNewMessage(chat, forwarded, uniqueCode);
  return { status: HTTP.CREATED, message: 'Message forwarded', data: forwarded };
});

module.exports = {
  getMessages,
  getChatPresence,
  sendTextMessage,
  markAsRead,
  deleteMessage,
  editMessage,
  updateCaption,
  forwardMessage,
};