const socketIo = require('socket.io');
const { setupWebSocket } = require('./socket.io');

const initializeSocket = (server) => {
  const io = socketIo(server, {
    cors: { origin: '*', methods: ['GET', 'POST'], credentials: true },
    transports: ['websocket', 'polling'],
    allowEIO3: true,
  });

  setupWebSocket(io);
  return io;
};

module.exports = initializeSocket;