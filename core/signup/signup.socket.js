const SIGNUP_ROOM_PREFIX = 'signup:'

let socketServer = null

const registerSignupSocket = (io) => {
  socketServer = io
  io.on('connection', (socket) => {
    socket.on('signup_watch', (requestId) => {
      if (typeof requestId === 'string') socket.join(`${SIGNUP_ROOM_PREFIX}${requestId}`)
    })
  })
}

const emitSignupStatus = (requestId, status) => {
  if (!socketServer) return
  socketServer.to(`${SIGNUP_ROOM_PREFIX}${requestId}`).emit('signup_status', { requestId: String(requestId), status })
}

module.exports = { registerSignupSocket, emitSignupStatus }