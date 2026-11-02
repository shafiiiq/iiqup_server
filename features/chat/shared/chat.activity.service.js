const HTTP = require('#shared/response/response.status');
const { AppError } = require('#shared/errors/error.http');
const Chat = require('./chat.model');

const recordMessage = async ({ chatId, senderId, senderName, messageType, preview, countUnread = true }) => {
  const chat = await Chat.findById(chatId).select('participants').lean();
  if (!chat) throw new AppError('Chat not found', HTTP.NOT_FOUND);

  const update = {
    $set: {
      lastMessage: preview,
      lastMessageType: messageType === 'system' ? 'text' : messageType,
      lastMessageTime: new Date(),
      lastMessageSender: { userId: senderId, name: senderName },
      hiddenFor: [],
    },
  };

  if (countUnread) {
    const increments = {};
    chat.participants
      .filter((participant) => String(participant.userId) !== String(senderId))
      .forEach((participant) => {
        increments[`unreadCount.${participant.userId}`] = 1;
      });
    if (Object.keys(increments).length > 0) update.$inc = increments;
  }

  await Chat.updateOne({ _id: chatId }, update);
};

const resetUnreadCount = (chatId, userId) =>
  Chat.updateOne({ _id: chatId }, { $set: { [`unreadCount.${userId}`]: 0 } });

module.exports = { recordMessage, resetUnreadCount };