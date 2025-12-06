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

export default {
  setupWebSocket,
  sendNotificationToUser,
  broadcastNotification,
  getConnectedUsersCount,
  isUserConnected,
  forceLogoutUser,
  connectedUsers
};