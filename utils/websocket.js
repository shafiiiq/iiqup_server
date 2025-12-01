// utils/websocket.js
const connectedUsers = new Map(); // Store connected users with their socket IDs
const { sendNetworkReconnectPush } = require('./notifications'); // 🆕 Import the function

const setupWebSocket = (io) => {
  io.on('connection', (socket) => {
    // Handle user authentication/registration
    socket.on('authenticate', async (data) => { // 🆕 Make it async
      const { uniqueCode, userId } = data;
      if (uniqueCode) {
        // 🆕 Check if user was previously disconnected
        const wasDisconnected = !connectedUsers.has(uniqueCode);
        
        connectedUsers.set(uniqueCode, {
          socketId: socket.id,
          userId: userId,
          connectedAt: new Date()
        });
        socket.join(`user_${uniqueCode}`); // Join user-specific room
        
        // Send confirmation
        socket.emit('authenticated', { success: true, message: 'Connected successfully' });
        
        // 🆕 If user was disconnected and now reconnected, send silent push to iOS
        if (wasDisconnected) {
          console.log(`📡 User ${uniqueCode} reconnected - sending iOS silent push`);
          await sendNetworkReconnectPush(uniqueCode);
        }
      }
    });

    // Handle user disconnection
    socket.on('disconnect', () => {
      // Remove user from connected users map
      for (const [uniqueCode, userData] of connectedUsers.entries()) {
        if (userData.socketId === socket.id) {
          console.log(`❌ User ${uniqueCode} disconnected`);
          connectedUsers.delete(uniqueCode);
          break;
        }
      }
    });

    // Handle ping for keeping connection alive
    socket.on('ping', () => {
      socket.emit('pong');
    });
  });
}; 

// Function to send notification to specific user
const sendNotificationToUser = (uniqueCode, notification) => {
  if (global.io) {
    // Add the target uniqueCode to the notification payload
    const enrichedNotification = {
      ...notification,
      meta: {
        ...(notification.meta || {}),
        targetUser: uniqueCode,  // This is the uniqueCode from backend
        sentAt: new Date().toISOString()
      }
    };    
    global.io.to(`user_${uniqueCode}`).emit('new_notification', enrichedNotification);
  }
};

// Function to broadcast notification to all connected users
const broadcastNotification = (notification) => {
  if (global.io) {    
    global.io.emit('new_notification', notification);
  }
};

// Function to get connected users count
const getConnectedUsersCount = () => {
  return connectedUsers.size;
};

// Function to check if user is connected
const isUserConnected = (uniqueCode) => {
  return connectedUsers.has(uniqueCode);
};

module.exports = {
  setupWebSocket,
  sendNotificationToUser,
  broadcastNotification,
  getConnectedUsersCount,
  isUserConnected,
  connectedUsers
};