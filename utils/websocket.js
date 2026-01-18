// utils/websocket.js
const connectedUsers = new Map(); // uniqueCode -> array of sessions
import { checkSessionStatus } from '../services/user-services.js';
import messageService from '../services/message-services.js';
import chatService from '../services/chat-services.js';

const setupWebSocket = (io) => {
  console.log('🔌 WebSocket server initialized');

  io.on('connection', (socket) => {
    console.log('✅ New client connected:', socket.id);

    // Handle user authentication/registration
    socket.on('authenticate', async (data) => {
      console.log('🔐 Authentication attempt:', data);

      const { uniqueCode, userId, sessionToken } = data;

      if (sessionToken) {
        const isSessionValid = await checkSessionStatus(sessionToken, userId);

        if (!isSessionValid.success || isSessionValid.status !== 200) {
          console.log('❌ Invalid session:', isSessionValid.message);
          socket.emit('session_invalid', {
            success: false,
            message: isSessionValid.message || 'Session expired. Please login again.',
            sessionStatus: isSessionValid.sessionStatus
          });
          socket.disconnect();
          return;
        }

        console.log('✅ Session valid');
      }

      if (uniqueCode) {
        // Get existing sessions or create new array
        const userSessions = connectedUsers.get(uniqueCode) || [];

        // Add this session
        userSessions.push({
          socketId: socket.id,
          userId: userId,
          sessionToken: sessionToken,
          connectedAt: new Date()
        });

        connectedUsers.set(uniqueCode, userSessions);

        socket.join(`user_${uniqueCode}`);
        console.log(`✅ User authenticated - uniqueCode: ${uniqueCode}, socketId: ${socket.id}`);
        console.log(`📊 Total sessions for ${uniqueCode}: ${userSessions.length}`);

        // Send confirmation
        socket.emit('authenticated', { success: true, message: 'Connected successfully' });
        console.log('📤 Authenticated event sent to client');
      } else {
        console.log('❌ Authentication failed - no uniqueCode');
      }
    });

    // Handle user disconnection
    socket.on('disconnect', () => {
      console.log('❌ Client disconnected:', socket.id);

      // Remove THIS socket from user's sessions
      for (const [uniqueCode, sessions] of connectedUsers.entries()) {
        const filteredSessions = sessions.filter(s => s.socketId !== socket.id);

        if (filteredSessions.length === 0) {
          connectedUsers.delete(uniqueCode);
          console.log(`🗑️ Removed user ${uniqueCode} - no more sessions`);
        } else {
          connectedUsers.set(uniqueCode, filteredSessions);
          console.log(`🗑️ Removed one session for ${uniqueCode} - ${filteredSessions.length} remaining`);
        }
      }
      console.log(`📊 Total connected users: ${connectedUsers.size}`);
    });

    // Handle ping for keeping connection alive
    socket.on('ping', () => {
      console.log('🏓 Ping received from:', socket.id);
      socket.emit('pong');
    });

    // ============ CHAT EVENTS ============

    // Send message
    socket.on('send_message', async (data) => {
      try {
        console.log('💬 Message received for :', data);
        const { chatId, senderId, senderType, senderName, senderAvatar, content, messageType, participants } = data;

        // Save message to DB 
        const message = await messageService.sendMessage({
          chatId,
          senderId,
          senderType,
          senderName,
          senderAvatar,
          messageType: messageType || 'text',
          content,
          recieverId: data.participants[0].userId
        });

        console.log('✅ Message saved to DB:', message._id);

        // Emit to all participants except sender
        participants.forEach(participant => {
          if (participant.uniqueCode !== data.senderUniqueCode) {
            global.io.to(`user_${participant.uniqueCode}`).emit('new_message', {
              ...message.toObject(),
              chatId
            });
            console.log(`📤 Message sent to: ${participant.uniqueCode}`);
          }
        });

        // Confirm to sender
        socket.emit('message_sent', {
          success: true,
          message: message.toObject()
        });
      } catch (error) {
        console.error('❌ Error sending message:', error);
        socket.emit('message_error', {
          success: false,
          message: error.message
        });
      }
    });

    // Typing indicator
    socket.on('typing', (data) => {
      try {
        console.log('⌨️ User typing:', data);
        const { chatId, userId, userName, participants, senderUniqueCode } = data;

        // Emit to all chat participants except sender
        participants.forEach(participant => {
          if (participant.uniqueCode !== senderUniqueCode) {
            global.io.to(`user_${participant.uniqueCode}`).emit('user_typing', {
              chatId,
              userId,
              userName,
              isTyping: true
            });
          }
        });
      } catch (error) {
        console.error('❌ Error in typing event:', error);
      }
    });

    socket.on('stop_typing', (data) => {
      try {
        console.log('⌨️ User stopped typing:', data);
        const { chatId, userId, participants, senderUniqueCode } = data;

        // Emit to all chat participants
        participants.forEach(participant => {
          if (participant.uniqueCode !== senderUniqueCode) {
            global.io.to(`user_${participant.uniqueCode}`).emit('user_typing', {
              chatId,
              userId,
              isTyping: false
            });
          }
        });
      } catch (error) {
        console.error('❌ Error in stop typing event:', error);
      }
    });

    // Message delivered
    socket.on('message_delivered', async (data) => {
      try {
        console.log('✓ Message delivered:', data);
        const { messageIds, userId, senderUniqueCode } = data;

        // Update message status in DB
        await messageService.markMessagesAsDelivered(messageIds, userId);

        // Emit to sender
        if (senderUniqueCode) {
          global.io.to(`user_${senderUniqueCode}`).emit('message_status_update', {
            messageIds,
            status: 'delivered',
            userId
          });
        }
      } catch (error) {
        console.error('❌ Error marking message as delivered:', error);
      }
    });

    // Message read
    socket.on('message_read', async (data) => {
      try {
        console.log('✓✓ Message read:', data);
        const { messageIds, chatId, userId, senderUniqueCode } = data;

        // Update message status in DB
        await messageService.markMessagesAsRead(chatId, messageIds, userId);

        // Emit to sender - ADD chatId here
        if (senderUniqueCode) {
          global.io.to(`user_${senderUniqueCode}`).emit('message_status_update', {
            messageIds,
            chatId,  // ← This line is already there but make sure it's being sent
            status: 'read',
            userId
          });
        }
      } catch (error) {
        console.error('❌ Error marking message as read:', error);
      }
    });

    // ============ CALL EVENTS ============

    // Initiate call
    socket.on('call_user', async (data) => {
      try {
        console.log('📞 Initiating call:', data);
        const { callerId, callerUniqueCode, receiverUniqueCode, callerName, chatId, callType } = data;

        const callData = {
          callerId,
          callerUniqueCode,
          callerName,
          chatId,
          callType: callType || 'voice',
          timestamp: new Date()
        };

        // 1. Send via WebSocket
        global.io.to(`user_${receiverUniqueCode}`).emit('incoming_call', callData);

        // 2. Send FCM push
        const PushNotificationService = await import('../utils/push-notification-jobs.js');
        await PushNotificationService.default.sendGeneralNotification(
          receiverUniqueCode,
          `Incoming call from ${callerName}`,
          'Tap to answer',
          'high',
          'call',
          `call_${callerId}_${Date.now()}`
        );

        console.log(`📤 Call notification sent to: ${receiverUniqueCode}`);
      } catch (error) {
        console.error('❌ Error initiating call:', error);
      }
    });

    // Answer call
    socket.on('call_answer', (data) => {
      try {
        console.log('✅ Call answered:', data);
        const { callerId, callerUniqueCode, receiverId, receiverUniqueCode, receiverName } = data;

        // Emit to caller
        global.io.to(`user_${callerUniqueCode}`).emit('call_answered', {
          receiverId,
          receiverUniqueCode,
          receiverName,
          timestamp: new Date()
        });

        console.log(`📤 Call answered notification sent to: ${callerUniqueCode}`);
      } catch (error) {
        console.error('❌ Error answering call:', error);
      }
    });

    // Reject call
    socket.on('call_reject', (data) => {
      try {
        console.log('❌ Call rejected:', data);
        const { callerId, callerUniqueCode, receiverId, receiverUniqueCode, reason } = data;

        // Emit to caller
        global.io.to(`user_${callerUniqueCode}`).emit('call_rejected', {
          receiverId,
          receiverUniqueCode,
          reason: reason || 'Call declined',
          timestamp: new Date()
        });

        console.log(`📤 Call rejected notification sent to: ${callerUniqueCode}`);
      } catch (error) {
        console.error('❌ Error rejecting call:', error);
      }
    });

    // End call
    socket.on('call_end', async (data) => {
      try {
        console.log('📴 Call ended:', data);
        const { callerId, callerUniqueCode, receiverId, receiverUniqueCode, duration, chatId } = data;

        // Save call record to DB
        if (chatId && duration) {
          await messageService.saveCallRecord({
            chatId,
            callerId,
            receiverId,
            duration,
            callType: data.callType || 'voice',
            status: 'ended',
            senderType: 'office',
            messageType: 'voice call'
          });
        }

        // Emit to both parties
        const callEndData = {
          callerId,
          receiverId,
          duration,
          timestamp: new Date()
        };

        global.io.to(`user_${callerUniqueCode}`).emit('call_ended', callEndData);
        global.io.to(`user_${receiverUniqueCode}`).emit('call_ended', callEndData);

        console.log(`📤 Call ended notification sent to both parties`);
      } catch (error) {
        console.error('❌ Error ending call:', error);
      }
    });

    // WebRTC signaling for peer-to-peer connection
    socket.on('webrtc_offer', (data) => {
      const { receiverUniqueCode, offer } = data;
      global.io.to(`user_${receiverUniqueCode}`).emit('webrtc_offer', {
        offer,
        callerSocketId: socket.id
      });
    });

    socket.on('webrtc_answer', (data) => {
      const { callerUniqueCode, answer } = data;
      global.io.to(`user_${callerUniqueCode}`).emit('webrtc_answer', {
        answer
      });
    });

    socket.on('webrtc_ice_candidate', (data) => {
      const { targetUniqueCode, candidate } = data;
      global.io.to(`user_${targetUniqueCode}`).emit('webrtc_ice_candidate', {
        candidate
      });
    });
  });
};

// Function to send notification to specific user (ALL sessions)
const sendNotificationToUser = (uniqueCode, notification) => {
  console.log(`📬 Sending notification to user: ${uniqueCode}`);
  if (global.io) {
    const enrichedNotification = {
      ...notification,
      meta: {
        ...(notification.meta || {}),
        targetUser: uniqueCode,
        sentAt: new Date().toISOString()
      }
    };

    global.io.to(`user_${uniqueCode}`).emit('new_notification', enrichedNotification);
    console.log(`✅ Notification sent to room: user_${uniqueCode}`);
  } else {
    console.log('❌ global.io not available');
  }
};

// Function to broadcast notification to all connected users
const broadcastNotification = (notification) => {
  console.log('📢 Broadcasting notification to all users');
  if (global.io) {
    global.io.emit('new_notification', notification);
    console.log(`✅ Broadcast sent to ${connectedUsers.size} users`);
  } else {
    console.log('❌ global.io not available');
  }
};

// Function to get connected users count
const getConnectedUsersCount = () => {
  return connectedUsers.size;
};

// Function to check if user is connected
const isUserConnected = (uniqueCode) => {
  const connected = connectedUsers.has(uniqueCode);
  console.log(`🔍 Checking if ${uniqueCode} is connected: ${connected}`);
  return connected;
};

// Logout SPECIFIC session only
const forceLogoutUser = (uniqueCode, userId, sessionToken, reason = 'Session terminated') => {
  console.log(`🚪 Force logout session: ${sessionToken} for user: ${uniqueCode}`);

  if (global.io) {
    const userSessions = connectedUsers.get(uniqueCode);
    console.log("connectedUsers", connectedUsers);

    console.log("userSessions", userSessions);
    if (userSessions) {

      // Find session with matching sessionToken 
      const targetSession = userSessions.find(s => s.sessionToken === sessionToken);
      console.log("targetSession", targetSession);

      if (targetSession) {
        // Emit ONLY to this specific socketId
        global.io.to(targetSession.socketId).emit('session_invalid', {
          success: false,
          message: reason,
          sessionStatus: 'logged_out',
          sessionToken: sessionToken
        });
        console.log(`✅ Logout signal sent to socket: ${targetSession.socketId}`);

        // Remove this session from the map
        const filteredSessions = userSessions.filter(s => s.sessionToken !== sessionToken);
        if (filteredSessions.length === 0) {
          connectedUsers.delete(uniqueCode);
        } else {
          connectedUsers.set(uniqueCode, filteredSessions);
        }
      } else {
        console.log(`❌ Session ${sessionToken} not found for user ${uniqueCode}`);
      }
    } else {
      console.log(`❌ No sessions found for user ${uniqueCode}`);
    }
  }
};

// Send message to chat participants
const sendMessageToChat = (participants, message, excludeUniqueCode = null) => {
  console.log('📤 Sending message to chat participants');
  if (global.io) {
    participants.forEach(participant => {
      if (participant.uniqueCode !== excludeUniqueCode) {
        global.io.to(`user_${participant.uniqueCode}`).emit('new_message', message);
        console.log(`✅ Message sent to: ${participant.uniqueCode}`);
      }
    });
  }
};

// Send typing indicator
const sendTypingIndicator = (chatId, participants, typingUser, excludeUniqueCode) => {
  console.log('⌨️ Sending typing indicator');
  if (global.io) {
    participants.forEach(participant => {
      if (participant.uniqueCode !== excludeUniqueCode) {
        global.io.to(`user_${participant.uniqueCode}`).emit('user_typing', {
          chatId,
          userId: typingUser.userId,
          userName: typingUser.name,
          isTyping: true
        });
      }
    });
  }
};

// Update message status
const updateMessageStatus = (senderUniqueCode, messageIds, status, chatId) => {
  console.log(`✓ Updating message status to: ${status} for chat: ${chatId}`);
  if (global.io) {
    global.io.to(`user_${senderUniqueCode}`).emit('message_status_update', {
      messageIds: Array.isArray(messageIds) ? messageIds : [messageIds],
      chatId,
      status
    });
  }
};

// Send call notification
const sendCallNotification = (receiverUniqueCode, callData) => {
  console.log('📞 Sending call notification');
  if (global.io) {
    global.io.to(`user_${receiverUniqueCode}`).emit('incoming_call', callData);
    console.log(`✅ Call notification sent to: ${receiverUniqueCode}`);
  }
};

export default {
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
  connectedUsers
};