// utils/websocket.js
const { checkSessionStatus }  = require('../services/session.service');
const messageService          = require('../services/message.service');
const chatService             = require('../services/chat.service');

// ─────────────────────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────────────────────

const connectedUsers = new Map(); // uniqueCode → [{ socketId, userId, sessionToken, connectedAt }]

// ─────────────────────────────────────────────────────────────────────────────
// Setup
// ─────────────────────────────────────────────────────────────────────────────

const setupWebSocket = (io) => {
  console.log('[WebSocket] server initialized');

  io.on('connection', (socket) => {
    console.log(`[WebSocket] client connected: ${socket.id}`);

    // ── Authentication ─────────────────────────────────────────────────────

    socket.on('authenticate', async (data) => {
      const { uniqueCode, userId, sessionToken } = data;

      if (sessionToken) {
        const session = await checkSessionStatus(sessionToken, userId);

        if (!session.success || session.status !== 200) {
          socket.emit('session_invalid', {
            success:       false,
            message:       session.message || 'Session expired. Please login again.',
            sessionStatus: session.sessionStatus,
          });
          socket.disconnect();
          return;
        }
      }

      if (!uniqueCode) return;

      const userSessions = connectedUsers.get(uniqueCode) || [];
      userSessions.push({ socketId: socket.id, userId, sessionToken, connectedAt: new Date() });
      connectedUsers.set(uniqueCode, userSessions);

      socket.join(`user_${uniqueCode}`);
      socket.emit('authenticated', { success: true, message: 'Connected successfully' });

      console.log(`[WebSocket] authenticated — uniqueCode: ${uniqueCode}, sessions: ${userSessions.length}`);
    });

    // ── Disconnect ─────────────────────────────────────────────────────────

    socket.on('disconnect', () => {
      for (const [uniqueCode, sessions] of connectedUsers.entries()) {
        const remaining = sessions.filter(s => s.socketId !== socket.id);
        if (remaining.length === 0) {
          connectedUsers.delete(uniqueCode);
        } else {
          connectedUsers.set(uniqueCode, remaining);
        }
      }
      console.log(`[WebSocket] client disconnected: ${socket.id} — users online: ${connectedUsers.size}`);
    });

    // ── Ping ───────────────────────────────────────────────────────────────

    socket.on('ping', () => socket.emit('pong'));

    // ── Chat ───────────────────────────────────────────────────────────────

    socket.on('send_message', async (data) => {
      try {
        const { chatId, senderId, senderType, senderName, senderAvatar, content, messageType, participants } = data;

        const message = await messageService.sendMessage({
          chatId,
          senderId,
          senderType,
          senderName,
          senderAvatar,
          messageType: messageType || 'text',
          content,
          recieverId: participants[0].userId,
        });

        participants.forEach(participant => {
          if (participant.uniqueCode !== data.senderUniqueCode) {
            global.io.to(`user_${participant.uniqueCode}`).emit('new_message', {
              ...message.toObject(),
              chatId,
            });
          }
        });

        socket.emit('message_sent', { success: true, message: message.toObject() });
      } catch (error) {
        console.error('[WebSocket] send_message:', error);
        socket.emit('message_error', { success: false, message: error.message });
      }
    });

    socket.on('typing', async (data) => {
      try {
        const { chatId, userId, userName, participants, senderUniqueCode } = data;
        const PushNotificationService = require('./push-notification');
        const typingNotificationSent  = new Map();

        participants.forEach(participant => {
          if (participant.uniqueCode === senderUniqueCode) return;

          global.io.to(`user_${participant.uniqueCode}`).emit('user_typing', {
            chatId, userId, userName, isTyping: true,
          });

          const key = `${chatId}_${userId}_${participant.uniqueCode}`;
          if (!typingNotificationSent.has(key)) {
            PushNotificationService.sendGeneralNotification(
              participant.uniqueCode, `${userName}`, 'is typing...', 'low', 'typing', `typing_${chatId}_${userId}`
            );
            typingNotificationSent.set(key, true);
          }
        });
      } catch (error) {
        console.error('[WebSocket] typing:', error);
      }
    });

    socket.on('stop_typing', async (data) => {
      try {
        const { chatId, userId, userName, participants, senderUniqueCode } = data;
        const PushNotificationService = require('./push-notification');

        for (const participant of participants) {
          if (participant.uniqueCode === senderUniqueCode) continue;

          global.io.to(`user_${participant.uniqueCode}`).emit('user_typing', {
            chatId, userId, userName, isTyping: false,
          });

          await PushNotificationService.dismissNotification(
            participant.uniqueCode, `typing_${chatId}_${userId}`
          );
        }
      } catch (error) {
        console.error('[WebSocket] stop_typing:', error);
      }
    });

    socket.on('message_delivered', async (data) => {
      try {
        const { messageIds, userId, senderUniqueCode } = data;
        await messageService.markMessagesAsDelivered(messageIds, userId);

        if (senderUniqueCode) {
          global.io.to(`user_${senderUniqueCode}`).emit('message_status_update', {
            messageIds, status: 'delivered', userId,
          });
        }
      } catch (error) {
        console.error('[WebSocket] message_delivered:', error);
      }
    });

    socket.on('message_read', async (data) => {
      try {
        const { messageIds, chatId, userId, senderUniqueCode } = data;
        await messageService.markMessagesAsRead(chatId, messageIds, userId);

        if (senderUniqueCode) {
          global.io.to(`user_${senderUniqueCode}`).emit('message_status_update', {
            messageIds, chatId, status: 'read', userId,
          });
        }
      } catch (error) {
        console.error('[WebSocket] message_read:', error);
      }
    });

    // ── Calls ──────────────────────────────────────────────────────────────

    socket.on('call_user', async (data) => {
      try {
        const { callerId, callerUniqueCode, receiverUniqueCode, callerName, chatId, callType } = data;
        const PushNotificationService = require('./push-notification');

        const callData = { callerId, callerUniqueCode, callerName, chatId, callType: callType || 'voice', timestamp: new Date() };

        global.io.to(`user_${receiverUniqueCode}`).emit('incoming_call', callData);

        await PushNotificationService.sendVoIPCallNotification(receiverUniqueCode, callerName, callerId, chatId);
      } catch (error) {
        console.error('[WebSocket] call_user:', error);
      }
    });

    socket.on('call_answer', (data) => {
      try {
        const { receiverId, receiverUniqueCode, receiverName, callerUniqueCode } = data;
        global.io.to(`user_${callerUniqueCode}`).emit('call_answered', {
          receiverId, receiverUniqueCode, receiverName, timestamp: new Date(),
        });
      } catch (error) {
        console.error('[WebSocket] call_answer:', error);
      }
    });

    socket.on('call_reject', (data) => {
      try {
        const { receiverId, receiverUniqueCode, callerUniqueCode, reason } = data;
        global.io.to(`user_${callerUniqueCode}`).emit('call_rejected', {
          receiverId, receiverUniqueCode, reason: reason || 'Call declined', timestamp: new Date(),
        });
      } catch (error) {
        console.error('[WebSocket] call_reject:', error);
      }
    });

    socket.on('call_end', async (data) => {
      try {
        const { callerId, callerUniqueCode, receiverId, receiverUniqueCode, duration, chatId } = data;

        if (chatId && duration) {
          await messageService.saveCallRecord({
            chatId, callerId, receiverId, duration,
            callType:    data.callType || 'voice',
            status:      'ended',
            senderType:  'office',
            messageType: 'voice call',
          });
        }

        const callEndData = { callerId, receiverId, duration, timestamp: new Date() };
        global.io.to(`user_${callerUniqueCode}`).emit('call_ended', callEndData);
        global.io.to(`user_${receiverUniqueCode}`).emit('call_ended', callEndData);
      } catch (error) {
        console.error('[WebSocket] call_end:', error);
      }
    });

    // ── WebRTC ─────────────────────────────────────────────────────────────

    socket.on('webrtc_offer', (data) => {
      global.io.to(`user_${data.receiverUniqueCode}`).emit('webrtc_offer', {
        offer: data.offer, callerSocketId: socket.id,
      });
    });

    socket.on('webrtc_answer', (data) => {
      global.io.to(`user_${data.callerUniqueCode}`).emit('webrtc_answer', { answer: data.answer });
    });

    socket.on('webrtc_ice_candidate', (data) => {
      global.io.to(`user_${data.targetUniqueCode}`).emit('webrtc_ice_candidate', { candidate: data.candidate });
    });
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────────────────────

const sendNotificationToUser = (uniqueCode, notification) => {
  if (!global.io) return;
  global.io.to(`user_${uniqueCode}`).emit('new_notification', {
    ...notification,
    meta: { ...(notification.meta || {}), targetUser: uniqueCode, sentAt: new Date().toISOString() },
  });
};

const broadcastNotification = (notification) => {
  if (!global.io) return;
  global.io.emit('new_notification', notification);
};

const getConnectedUsersCount = () => connectedUsers.size;

const isUserConnected = (uniqueCode) => connectedUsers.has(uniqueCode);

const forceLogoutUser = (uniqueCode, userId, sessionToken, reason = 'Session terminated') => {
  if (!global.io) return;

  const userSessions = connectedUsers.get(uniqueCode);
  if (!userSessions) return;

  const targetSession = userSessions.find(s => s.sessionToken === sessionToken);
  if (!targetSession) return;

  global.io.to(targetSession.socketId).emit('session_invalid', {
    success:       false,
    message:       reason,
    sessionStatus: 'logged_out',
    sessionToken,
  });

  const remaining = userSessions.filter(s => s.sessionToken !== sessionToken);
  remaining.length === 0
    ? connectedUsers.delete(uniqueCode)
    : connectedUsers.set(uniqueCode, remaining);
};

const sendMessageToChat = (participants, message, excludeUniqueCode = null) => {
  if (!global.io) return;
  participants.forEach(participant => {
    if (participant.uniqueCode !== excludeUniqueCode) {
      global.io.to(`user_${participant.uniqueCode}`).emit('new_message', message);
    }
  });
};

const sendTypingIndicator = (chatId, participants, typingUser, excludeUniqueCode) => {
  if (!global.io) return;
  participants.forEach(participant => {
    if (participant.uniqueCode !== excludeUniqueCode) {
      global.io.to(`user_${participant.uniqueCode}`).emit('user_typing', {
        chatId, userId: typingUser.userId, userName: typingUser.name, isTyping: true,
      });
    }
  });
};

const updateMessageStatus = (senderUniqueCode, messageIds, status, chatId) => {
  if (!global.io) return;
  global.io.to(`user_${senderUniqueCode}`).emit('message_status_update', {
    messageIds: Array.isArray(messageIds) ? messageIds : [messageIds],
    chatId,
    status,
  });
};

const sendCallNotification = (receiverUniqueCode, callData) => {
  if (!global.io) return;
  global.io.to(`user_${receiverUniqueCode}`).emit('incoming_call', callData);
};

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  default: {
    setupWebSocket,
    sendNotificationToUser,
    broadcastNotification,
    getConnectedUsersCount,
    isUserConnected,
    forceLogoutUser,
    sendMessageToChat,
    sendTypingIndicator,
    updateMessageStatus,
    sendCallNotification,
    connectedUsers,
  },
};