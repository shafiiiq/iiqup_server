// utils/websocket.js
const connectedUsers = new Map(); // Store connected users with their socket IDs

const setupWebSocket = (io) => {
  io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    // Handle user authentication/registration
    socket.on('authenticate', (data) => {
      const { uniqueCode, userId } = data;
      if (uniqueCode) {
        connectedUsers.set(uniqueCode, {
          socketId: socket.id,
          userId: userId,
          connectedAt: new Date()
        });
        socket.join(`user_${uniqueCode}`); // Join user-specific room
        console.log(`User ${uniqueCode} authenticated and joined room`);
        
        // Send confirmation
        socket.emit('authenticated', { success: true, message: 'Connected successfully' });
      }
    });

    // Handle user disconnection
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
      
      // Remove user from connected users map
      for (const [uniqueCode, userData] of connectedUsers.entries()) {
        if (userData.socketId === socket.id) {
          connectedUsers.delete(uniqueCode);
          console.log(`User ${uniqueCode} disconnected`);
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
    console.log(`Backend sending to user ${uniqueCode}:`, notification.title || notification.message);
  }
};

// Function to broadcast notification to all connected users
const broadcastNotification = (notification) => {
  if (global.io) {
    global.io.emit('new_notification', notification);
    console.log('Notification broadcasted to all users:', notification.title || notification.message);
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