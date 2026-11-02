const gateway = require('#core/socket/socket.io');

const emitToParticipants = (participants, event, payload, excludeUniqueCode = null) => {
  participants.forEach((participant) => {
    if (participant.uniqueCode && participant.uniqueCode !== excludeUniqueCode) {
      gateway.dispatchUserWebSocketEvent(participant.uniqueCode, event, payload);
    }
  });
};

const broadcastNewMessage = (chat, message, excludeUniqueCode = null) =>
  gateway.dispatchMessageToChat(chat.participants, { ...message, chatId: chat._id }, excludeUniqueCode);

const broadcastSystemMessage = (chat, message) => {
  if (!message) return;
  gateway.dispatchMessageToChat(chat.participants, { ...message.toObject(), chatId: chat._id });
};

const broadcastMessageUpdate = (chat, message, excludeUniqueCode) =>
  emitToParticipants(chat.participants, 'message_updated', { chatId: String(chat._id), message }, excludeUniqueCode);

const isOnline = (uniqueCode) => gateway.isUserConnected(uniqueCode);

module.exports = { emitToParticipants, broadcastNewMessage, broadcastSystemMessage, broadcastMessageUpdate, isOnline };