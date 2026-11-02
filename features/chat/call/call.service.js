const HTTP = require('#shared/response/response.status');
const { AppError } = require('#shared/errors/error.http');
const { paginate } = require('#shared/pagination/pagination');
const Message = require('../message/message.model');
const Chat = require('../shared/chat.model');

const DEFAULT_PAGINATION = { page: 1, limit: 20, skip: 0 };

const getCallHistory = async (userId, pagination = DEFAULT_PAGINATION) => {
  const chatIds = await Chat.distinct('_id', { 'participants.userId': userId });
  const query = {
    chatId: { $in: chatIds },
    messageType: 'voice call',
    $or: [{ senderId: userId }, { 'callData.receiverId': userId }],
  };
  const result = await paginate(Message, query, pagination, { sort: { createdAt: -1 } });
  return { data: result.data, pagination: result.pagination };
};

const saveCallRecord = async ({ chatId, callerId, receiverId, duration = 0, callType = 'voice', status = 'ended' }) => {
  const chat = await Chat.findById(chatId).select('participants').lean();
  if (!chat) throw new AppError('Chat not found', HTTP.NOT_FOUND);

  const caller = chat.participants.find((participant) => String(participant.userId) === String(callerId));
  if (!caller) throw new AppError('Access denied to this chat', HTTP.FORBIDDEN);

  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - duration * 1000);

  return Message.create({
    chatId,
    senderId: callerId,
    senderType: caller.userType,
    senderName: caller.name || 'Unknown',
    messageType: 'voice call',
    content: `${callType} call - ${status}`,
    callData: { receiverId, duration, callType, status, startTime, endTime },
  });
};

module.exports = { getCallHistory, saveCallRecord };