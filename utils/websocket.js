// utils/websocket.js
const connectedUsers = new Map(); // uniqueCode -> array of sessions
import { checkSessionStatus } from '../services/user-services.js';

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
      // data = { chatId, senderId, senderType, content, messageType, participants }
      // Save message to DB
      // Emit to all participants except sender
    });

    // Typing indicator
    socket.on('typing', (data) => {
      // data = { chatId, userId, userName }
      // Emit to all chat participants except sender
    });

    socket.on('stop_typing', (data) => {
      // data = { chatId, userId }
      // Emit to all chat participants
    });

    // Message delivered
    socket.on('message_delivered', (data) => {
      // data = { messageId, userId }
      // Update message status in DB
      // Emit to sender
    });

    // Message read
    socket.on('message_read', (data) => {
      // data = { messageId, chatId, userId }
      // Update message status in DB
      // Emit to sender
    });

    // ============ CALL EVENTS ============

    // Initiate call
    socket.on('call_user', (data) => {
      // data = { callerId, receiverUniqueCode, callerName, chatId }
      // Emit to receiver
    });

    // Answer call
    socket.on('call_answer', (data) => {
      // data = { callerId, receiverId }
      // Emit to caller
    });

    // Reject call
    socket.on('call_reject', (data) => {
      // data = { callerId, receiverId, reason }
      // Emit to caller
    });

    // End call
    socket.on('call_end', (data) => {
      // data = { callerId, receiverId, duration }
      // Emit to both parties
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
  // participants = [{ uniqueCode, userId, userType }]
  // Send to all participants except excludeUniqueCode (sender)
};

// Send typing indicator
const sendTypingIndicator = (chatId, participants, typingUser) => {
  // Emit typing event to chat participants
};

// Update message status
const updateMessageStatus = (senderUniqueCode, messageId, status) => {
  // Emit status update to sender
};

// Send call notification
const sendCallNotification = (receiverUniqueCode, callData) => {
  // Emit incoming call to receiver
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