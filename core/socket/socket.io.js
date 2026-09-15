const { checkSessionStatus } = require('#core/session/session.service');
const sessionEvents = require('#core/session/session.events');
const notificationEvents = require('#core/notification/notification.events');
const messageService = require('#features/chat/message/message.service');
const chatService = require('#features/chat/chat.service');
const logger = require('#shared/logger/logger');

let ioInstance = null;
const connectedUsers = new Map();
const typingNotifications = new Map();

const emitToUser = (uniqueCode, event, payload) => {
  if (!ioInstance) return;
  ioInstance.to(`user_${uniqueCode}`).emit(event, payload);
};

const broadcastToParticipants = (participants, excludeUniqueCode, event, payload) => {
  participants.forEach((participant) => {
    if (participant.uniqueCode !== excludeUniqueCode) {
      emitToUser(participant.uniqueCode, event, payload);
    }
  });
};

const notifyChatParticipantsPresence = async (userId, uniqueCode, isOnline) => {
  const chats = await chatService.getUserChats(userId);
  chats.forEach((chat) => {
    chat.participants.forEach((participant) => {
      emitToUser(participant.uniqueCode, isOnline ? 'user_online' : 'user_offline', {
        chatId: chat._id,
        userId,
        uniqueCode,
        isOnline,
        timestamp: new Date().toISOString(),
      });
    });
  });
};

const withErrorLogging = (eventName, handler) => async (...args) => {
  try {
    await handler(...args);
  } catch (error) {
    logger.error(`[socket.io] ${eventName}`, error);
  }
};

const handleAuthenticate = async (socket, data) => {
  const { uniqueCode, userId, sessionToken } = data;

  if (sessionToken) {
    const session = await checkSessionStatus(sessionToken, userId);
    if (!session.success || session.status !== 200) {
      socket.emit('session_invalid', {
        success: false,
        message: session.message || 'Session expired. Please login again.',
        sessionStatus: session.sessionStatus,
      });
      socket.disconnect();
      return;
    }
  }

  if (!uniqueCode) return;

  const userSessions = connectedUsers.get(uniqueCode) || [];
  const wasAlreadyOnline = userSessions.length > 0;
  userSessions.push({ socketId: socket.id, userId, sessionToken, connectedAt: new Date() });
  connectedUsers.set(uniqueCode, userSessions);

  socket.join(`user_${uniqueCode}`);
  socket.emit('authenticated', { success: true, message: 'Connected successfully' });
  logger.info(`[socket.io] authenticated — uniqueCode: ${uniqueCode}, sessions: ${userSessions.length}`);

  if (!wasAlreadyOnline) {
    await notifyChatParticipantsPresence(userId, uniqueCode, true);
  }
};

const handleDisconnect = async (socket) => {
  let offlineUser = null;

  for (const [uniqueCode, sessions] of connectedUsers.entries()) {
    const remaining = sessions.filter((s) => s.socketId !== socket.id);
    if (remaining.length === 0) {
      connectedUsers.delete(uniqueCode);
      const userSession = sessions.find((s) => s.socketId === socket.id);
      if (userSession) offlineUser = { uniqueCode, userId: userSession.userId };
    } else {
      connectedUsers.set(uniqueCode, remaining);
    }
  }

  logger.info(`[socket.io] client disconnected: ${socket.id} — users online: ${connectedUsers.size}`);

  if (offlineUser) {
    await notifyChatParticipantsPresence(offlineUser.userId, offlineUser.uniqueCode, false);
  }
};

const handleSendMessage = async (socket, data) => {
  const {
    chatId, senderId, senderType, senderName, senderAvatar,
    content, messageType, participants, tempId, caption, replyTo, senderUniqueCode,
  } = data;

  const message = await messageService.sendMessage({
    chatId, senderId, senderType, senderName, senderAvatar,
    messageType: messageType || 'text',
    content, caption, replyTo,
    recieverId: participants[0]?.userId,
  });

  const messageObj = { ...message.toObject(), chatId };

  for (const participant of participants) {
    if (participant.uniqueCode === senderUniqueCode) continue;

    notificationEvents.emit('dismiss-notification', {
      uniqueCode: participant.uniqueCode,
      notificationId: `typing_${chatId}_${senderId}`,
    });
    typingNotifications.delete(`${chatId}_${senderId}_${participant.uniqueCode}`);

    emitToUser(participant.uniqueCode, 'user_typing', { chatId, userId: senderId, userName: senderName, isTyping: false });
    emitToUser(participant.uniqueCode, 'new_message', messageObj);
  }

  socket.emit('message_sent', { success: true, message: messageObj, tempId });
};

const handleTyping = async (data) => {
  const { chatId, userId, userName, participants, senderUniqueCode } = data;
  const globalKey = `typing_${chatId}_${userId}`;

  if (typingNotifications.has(globalKey)) return;

  participants.forEach((participant) => {
    if (participant.uniqueCode === senderUniqueCode) return;
    emitToUser(participant.uniqueCode, 'user_typing', { chatId, userId, userName, isTyping: true });
    notificationEvents.emit('send-general-notification', {
      uniqueCode: participant.uniqueCode,
      title: userName,
      description: 'is typing...',
      priority: 'low',
      type: 'typing',
      notificationId: globalKey,
    });
  });

  typingNotifications.set(globalKey, true);
};

const handleStopTyping = async (data) => {
  const { chatId, userId, userName, participants, senderUniqueCode } = data;
  const globalKey = `typing_${chatId}_${userId}`;

  for (const participant of participants) {
    if (participant.uniqueCode === senderUniqueCode) continue;
    emitToUser(participant.uniqueCode, 'user_typing', { chatId, userId, userName, isTyping: false });
    notificationEvents.emit('dismiss-notification', { uniqueCode: participant.uniqueCode, notificationId: globalKey });
  }

  typingNotifications.delete(globalKey);
};

const handleMessageDelivered = async (data) => {
  const { messageIds, userId, senderUniqueCode, chatId } = data;
  await messageService.markMessagesAsDelivered(messageIds, userId);

  if (senderUniqueCode) {
    emitToUser(senderUniqueCode, 'message_status_update', {
      messageIds, chatId, status: 'delivered', userId, deliveredAt: new Date().toISOString(),
    });
  }
};

const handleMessageRead = async (data) => {
  const { messageIds, chatId, userId, senderUniqueCode } = data;
  await messageService.markMessagesAsRead(chatId, messageIds, userId);

  if (senderUniqueCode) {
    emitToUser(senderUniqueCode, 'message_status_update', {
      messageIds, chatId, status: 'read', userId, readAt: new Date().toISOString(),
    });
  }
};

const handleRecordingState = (data, isRecording) => {
  const { chatId, userId, userName, participants, senderUniqueCode } = data;
  broadcastToParticipants(participants, senderUniqueCode, 'user_recording', {
    chatId, userId, userName, isRecording,
  });
};

const handleUploadingState = (data, isUploading) => {
  const { chatId, userId, userName, participants, senderUniqueCode, mediaType } = data;
  broadcastToParticipants(participants, senderUniqueCode, 'user_uploading', {
    chatId, userId, userName, isUploading, mediaType,
  });
};

const handleCallUser = async (data) => {
  const { callerId, callerUniqueCode, receiverUniqueCode, callerName, chatId, callType } = data;

  const callData = { callerId, callerUniqueCode, callerName, chatId, callType: callType || 'voice', timestamp: new Date() };
  emitToUser(receiverUniqueCode, 'incoming_call', callData);

  notificationEvents.emit('voip-call-notification', {
    uniqueCode: receiverUniqueCode,
    callerName,
    callerId,
    chatId,
  });
};

const handleCallAnswer = (data) => {
  const { receiverId, receiverUniqueCode, receiverName, callerUniqueCode } = data;
  emitToUser(callerUniqueCode, 'call_answered', { receiverId, receiverUniqueCode, receiverName, timestamp: new Date() });
};

const handleCallReject = (data) => {
  const { receiverId, receiverUniqueCode, callerUniqueCode, reason } = data;
  emitToUser(callerUniqueCode, 'call_rejected', {
    receiverId, receiverUniqueCode, reason: reason || 'Call declined', timestamp: new Date(),
  });
};

const handleCallEnd = async (data) => {
  const { callerId, callerUniqueCode, receiverId, receiverUniqueCode, duration, chatId, callType } = data;

  if (chatId && duration) {
    await messageService.saveCallRecord({
      chatId, callerId, receiverId, duration,
      callType: callType || 'voice',
      status: 'ended',
      senderType: 'staff',
      messageType: 'voice call',
    });
  }

  const callEndData = { callerId, receiverId, duration, timestamp: new Date() };
  emitToUser(callerUniqueCode, 'call_ended', callEndData);
  emitToUser(receiverUniqueCode, 'call_ended', callEndData);
};

const handleWebrtcOffer = (socket, data) => {
  emitToUser(data.receiverUniqueCode, 'webrtc_offer', { offer: data.offer, callerSocketId: socket.id });
};

const handleWebrtcAnswer = (data) => {
  emitToUser(data.callerUniqueCode, 'webrtc_answer', { answer: data.answer });
};

const handleWebrtcIceCandidate = (data) => {
  emitToUser(data.targetUniqueCode, 'webrtc_ice_candidate', { candidate: data.candidate });
};

const forceLogoutUser = (uniqueCode, userId, sessionToken, reason = 'Session terminated') => {
  const userSessions = connectedUsers.get(uniqueCode);
  if (!userSessions) return;

  const targetSession = userSessions.find((s) => s.sessionToken === sessionToken);
  if (!targetSession || !ioInstance) return;

  ioInstance.to(targetSession.socketId).emit('session_invalid', {
    success: false, message: reason, sessionStatus: 'logged_out', sessionToken,
  });

  const remaining = userSessions.filter((s) => s.sessionToken !== sessionToken);
  if (remaining.length === 0) {
    connectedUsers.delete(uniqueCode);
  } else {
    connectedUsers.set(uniqueCode, remaining);
  }
};

sessionEvents.on('force-logout', ({ uniqueCode, userId, sessionToken, reason }) => {
  forceLogoutUser(uniqueCode, userId, sessionToken, reason);
});

const setupWebSocket = (io) => {
  ioInstance = io;
  logger.info('[socket.io] server initialized');

  io.on('connection', (socket) => {
    logger.info(`[socket.io] client connected: ${socket.id}`);

    socket.on('authenticate', withErrorLogging('authenticate', (data) => handleAuthenticate(socket, data)));
    socket.on('disconnect', withErrorLogging('disconnect', () => handleDisconnect(socket)));
    socket.on('ping', () => socket.emit('pong'));

    socket.on('send_message', withErrorLogging('send_message', (data) => handleSendMessage(socket, data)));
    socket.on('typing', withErrorLogging('typing', handleTyping));
    socket.on('stop_typing', withErrorLogging('stop_typing', handleStopTyping));
    socket.on('message_delivered', withErrorLogging('message_delivered', handleMessageDelivered));
    socket.on('message_read', withErrorLogging('message_read', handleMessageRead));

    socket.on('start_recording', withErrorLogging('start_recording', (data) => handleRecordingState(data, true)));
    socket.on('stop_recording', withErrorLogging('stop_recording', (data) => handleRecordingState(data, false)));
    socket.on('start_uploading', withErrorLogging('start_uploading', (data) => handleUploadingState(data, true)));
    socket.on('stop_uploading', withErrorLogging('stop_uploading', (data) => handleUploadingState(data, false)));

    socket.on('call_user', withErrorLogging('call_user', handleCallUser));
    socket.on('call_answer', withErrorLogging('call_answer', handleCallAnswer));
    socket.on('call_reject', withErrorLogging('call_reject', handleCallReject));
    socket.on('call_end', withErrorLogging('call_end', handleCallEnd));

    socket.on('webrtc_offer', (data) => handleWebrtcOffer(socket, data));
    socket.on('webrtc_answer', handleWebrtcAnswer);
    socket.on('webrtc_ice_candidate', handleWebrtcIceCandidate);
  });
};

const dispatchUserWebSocketNotification = (uniqueCode, notification) => {
  emitToUser(uniqueCode, 'new_notification', {
    ...notification,
    meta: { ...(notification.meta || {}), targetUser: uniqueCode, sentAt: new Date().toISOString() },
  });
};

const dispatchBroadcastWebSocketNotification = (notification) => {
  if (!ioInstance) return;
  ioInstance.emit('new_notification', notification);
};

const getConnectedUsersCount = () => connectedUsers.size;

const isUserConnected = (uniqueCode) => connectedUsers.has(uniqueCode);

const dispatchMessageToChat = (participants, message, excludeUniqueCode = null) => {
  broadcastToParticipants(participants, excludeUniqueCode, 'new_message', message);
};

const dispatchTypingIndicator = (chatId, participants, typingUser, excludeUniqueCode) => {
  broadcastToParticipants(participants, excludeUniqueCode, 'user_typing', {
    chatId, userId: typingUser.userId, userName: typingUser.name, isTyping: true,
  });
};

const updateMessageStatus = (senderUniqueCode, messageIds, status, chatId) => {
  emitToUser(senderUniqueCode, 'message_status_update', {
    messageIds: Array.isArray(messageIds) ? messageIds : [messageIds],
    chatId,
    status,
  });
};

const dispatchCallNotification = (receiverUniqueCode, callData) => {
  emitToUser(receiverUniqueCode, 'incoming_call', callData);
};

const dispatchDashboardUpdate = (...collectionKeys) => {
  if (!ioInstance) return;
  ioInstance.emit('dashboard_update', {
    collectionKeys: collectionKeys.length > 0 ? collectionKeys : null,
    updatedAt: new Date().toISOString(),
  });
};

module.exports = {
  setupWebSocket,
  dispatchUserWebSocketNotification,
  dispatchBroadcastWebSocketNotification,
  getConnectedUsersCount,
  isUserConnected,
  forceLogoutUser,
  dispatchMessageToChat,
  dispatchTypingIndicator,
  updateMessageStatus,
  dispatchCallNotification,
  dispatchDashboardUpdate,
};