const HTTP = require('#shared/response/response.status');
const { AppError } = require('#shared/errors/error.http');
const { handleChatRoute, assertObjectId } = require('../shared/chat.route.handler');
const callService = require('./call.service');

const getCallHistory = handleChatRoute('getCallHistory', 'Failed to retrieve call history', async (req) => {
  const result = await callService.getCallHistory(req.user.id, req.pagination);
  return { message: 'Call history retrieved', data: result.data, pagination: result.pagination };
});

const saveCallRecord = handleChatRoute('saveCallRecord', 'Failed to save call record', async (req) => {
  const { receiverId, duration, callType, status } = req.body;
  const chatId = assertObjectId(req.body.chatId, 'chat id');
  if (!receiverId || !callType) throw new AppError('Receiver ID and call type are required', HTTP.BAD_REQUEST);

  const record = await callService.saveCallRecord({ chatId, callerId: req.user.id, receiverId, duration, callType, status });
  return { status: HTTP.CREATED, message: 'Call record saved', data: record };
});

module.exports = { getCallHistory, saveCallRecord };