// services/session.service.js
const crypto  = require('crypto');
const Session = require('../models/session.model.js');
const User    = require('../models/user.model.js');

// ─────────────────────────────────────────────────────────────────────────────
// Write
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a new session for a user.
 * @param {string} userId
 * @param {string} userModel
 * @param {object} deviceInfo
 * @param {object} location
 * @returns {Promise<string>} sessionToken
 */
const createSession = async (userId, userModel, deviceInfo, location) => {
  const sessionToken = crypto.randomBytes(32).toString('hex');
  const expiresAt    = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  const session = new Session({ userId, userModel, sessionToken, deviceInfo, location, isActive: true, expiresAt });
  await session.save();
  return sessionToken;
};

/**
 * Logs out a specific session by ID.
 * @param {string} sessionId
 * @param {string} userId
 * @param {string} currentSessionToken
 * @returns {Promise}
 */
const logoutSession = async (sessionId, userId, currentSessionToken) => {
  try {
    const session = await Session.findOne({ _id: sessionId, userId });
    if (!session) return { status: 404, success: false, message: 'Session not found' };

    if (session.sessionToken === currentSessionToken) {
      return { status: 400, success: false, message: 'Cannot logout current session. Use logout instead.' };
    }

    session.isActive = false;
    await session.save();

    const userToLogout = await User.findById(userId);
    if (userToLogout) {
      const websocket = require('../sockets/websocket.js');
      websocket.default.forceLogoutUser(userToLogout.uniqueCode, userToLogout._id, session.sessionToken, 'Logged out from another device');
    }

    return { status: 200, success: true, message: 'Session logged out successfully' };
  } catch (error) {
    return { status: 500, success: false, message: 'Failed to logout session', error: error.message };
  }
};

/**
 * Blocks a device by deleting its session permanently.
 * @param {string} sessionId
 * @param {string} userId
 * @returns {Promise}
 */
const blockDevice = async (sessionId, userId) => {
  try {
    const session = await Session.findOne({ _id: sessionId, userId });
    if (!session) return { status: 404, success: false, message: 'Session not found' };

    await Session.deleteOne({ _id: sessionId });

    const userToBlock = await User.findById(userId);
    if (userToBlock) {
      const websocket = require('../sockets/websocket.js');
      websocket.default.forceLogoutUser(userToBlock.uniqueCode, userToBlock._id, session.sessionToken, 'Device blocked');
    }

    return { status: 200, success: true, message: 'Device blocked successfully' };
  } catch (error) {
    return { status: 500, success: false, message: 'Failed to block device', error: error.message };
  }
};

/**
 * Logs out all sessions except the current one.
 * @param {string} userId
 * @param {string} currentSessionToken
 * @returns {Promise}
 */
const logoutAllSessions = async (userId, currentSessionToken) => {
  try {
    const result = await Session.updateMany(
      { userId, sessionToken: { $ne: currentSessionToken }, isActive: true },
      { $set: { isActive: false } }
    );

    const userToLogout = await User.findById(userId);
    if (userToLogout) {
      const websocket = require('../sockets/websocket.js');
      websocket.default.forceLogoutUser(userToLogout.uniqueCode, userToLogout._id, null, 'Logged out from all devices');
    }

    return { status: 200, success: true, message: 'All other sessions logged out successfully', data: { loggedOutCount: result.modifiedCount } };
  } catch (error) {
    return { status: 500, success: false, message: 'Failed to logout all sessions', error: error.message };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Read
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches all active sessions for a user.
 * @param {string} userId
 * @param {string} currentSessionToken
 * @returns {Promise}
 */
const getUserSessions = async (userId, currentSessionToken) => {
  try {
    const sessions = await Session.find({ userId, isActive: true }).sort({ lastActivity: -1 });

    const sessionsWithCurrent = sessions.map(session => ({
      ...session.toObject(),
      isCurrent: session.sessionToken === currentSessionToken,
    }));

    return { status: 200, success: true, message: 'Sessions retrieved successfully', data: { sessions: sessionsWithCurrent, total: sessions.length } };
  } catch (error) {
    return { status: 500, success: false, message: 'Failed to retrieve sessions', error: error.message };
  }
};

/**
 * Checks if a session is active, blocked, or logged out.
 * @param {string} sessionId - session token
 * @param {string} userId
 * @returns {Promise}
 */
const checkSessionStatus = async (sessionId, userId) => {
  try {
    const session = await Session.findOne({ sessionToken: sessionId, userId });

    if (!session) {
      return { status: 401, success: false, sessionStatus: 'blocked', message: 'Session was blocked from another device', action: 'redirect_to_login' };
    }

    if (!session.isActive) {
      return { status: 401, success: false, sessionStatus: 'logged_out', message: 'Session was logged out from another device', action: 'redirect_to_login' };
    }

    return {
      status: 200, success: true, sessionStatus: 'active', message: 'Session is active', action: 'continue_to_work',
      session: { id: session._id, deviceInfo: session.deviceInfo, lastActivity: session.lastActivity }
    };
  } catch (error) {
    return { status: 500, success: false, message: 'Failed to check session status', error: error.message };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = { createSession, getUserSessions, checkSessionStatus, logoutSession, blockDevice, logoutAllSessions };