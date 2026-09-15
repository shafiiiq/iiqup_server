const crypto = require('crypto');
const mongoose = require('mongoose');
const Session = require('./session.model');
const User = require('#features/user/staff/staff.model');
const sessionEvents = require('./session.events');

const createSession = async (userId, userModel, deviceInfo, location) => {
  const sessionToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + 10);

  const session = new Session({
    userId,
    userModel,
    sessionToken,
    deviceInfo,
    location,
    isActive: true,
    expiresAt,
  });
  await session.save();
  return sessionToken;
};

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
      sessionEvents.emit('force-logout', {
        uniqueCode: userToLogout.uniqueCode,
        userId: userToLogout._id,
        sessionToken: session.sessionToken,
        reason: 'Logged out from another device',
      });
    }

    return { status: 200, success: true, message: 'Session logged out successfully' };
  } catch (error) {
    return { status: 500, success: false, message: 'Failed to logout session', error: error.message };
  }
};

const blockDevice = async (sessionId, userId) => {
  try {
    const session = await Session.findOne({ _id: sessionId, userId });
    if (!session) return { status: 404, success: false, message: 'Session not found' };

    await Session.deleteOne({ _id: sessionId });

    const userToBlock = await User.findById(userId);
    if (userToBlock) {
      sessionEvents.emit('force-logout', {
        uniqueCode: userToBlock.uniqueCode,
        userId: userToBlock._id,
        sessionToken: session.sessionToken,
        reason: 'Device blocked',
      });
    }

    return { status: 200, success: true, message: 'Device blocked successfully' };
  } catch (error) {
    return { status: 500, success: false, message: 'Failed to block device', error: error.message };
  }
};

const logoutAllSessions = async (userId, currentSessionToken) => {
  try {
    const result = await Session.updateMany(
      { userId, sessionToken: { $ne: currentSessionToken }, isActive: true },
      { $set: { isActive: false } }
    );

    const userToLogout = await User.findById(userId);
    if (userToLogout) {
      sessionEvents.emit('force-logout', {
        uniqueCode: userToLogout.uniqueCode,
        userId: userToLogout._id,
        sessionToken: null,
        reason: 'Logged out from all devices',
      });
    }

    return {
      status: 200,
      success: true,
      message: 'All other sessions logged out successfully',
      data: { loggedOutCount: result.modifiedCount },
    };
  } catch (error) {
    return { status: 500, success: false, message: 'Failed to logout all sessions', error: error.message };
  }
};

const getUserSessions = async (userId, currentSessionToken) => {
  try {
    const sessions = await Session.find({ userId, isActive: true }).sort({ lastActivity: -1 });

    const sessionsWithCurrent = sessions.map((session) => ({
      ...session.toObject(),
      isCurrent: session.sessionToken === currentSessionToken,
    }));

    return {
      status: 200,
      success: true,
      message: 'Sessions retrieved successfully',
      data: { sessions: sessionsWithCurrent, total: sessions.length },
    };
  } catch (error) {
    return { status: 500, success: false, message: 'Failed to retrieve sessions', error: error.message };
  }
};

const checkSessionStatus = async (sessionId, userId) => {
  try {
    const session = await Session.findOne({
      sessionToken: sessionId,
      userId: mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId,
    });

    if (!session) {
      return {
        status: 401,
        success: false,
        sessionStatus: 'blocked',
        message: 'Session was blocked from another device',
        action: 'redirect_to_login',
      };
    }

    if (!session.isActive) {
      return {
        status: 401,
        success: false,
        sessionStatus: 'logged_out',
        message: 'Session was logged out from another device',
        action: 'redirect_to_login',
      };
    }

    return {
      status: 200,
      success: true,
      sessionStatus: 'active',
      message: 'Session is active',
      action: 'continue_to_work',
      session: {
        id: session._id,
        deviceInfo: session.deviceInfo,
        lastActivity: session.lastActivity,
      },
    };
  } catch (error) {
    return { status: 500, success: false, message: 'Failed to check session status', error: error.message };
  }
};

module.exports = {
  createSession,
  getUserSessions,
  checkSessionStatus,
  logoutSession,
  blockDevice,
  logoutAllSessions,
};