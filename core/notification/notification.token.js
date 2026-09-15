// notification.token.js
const logger = require('#shared/logger/logger');
const User = require('#features/user/staff/staff.model');
const Operator = require('#features/user/operator/operator.model');
const Mechanic = require('#features/user/mechanic/mechanic.model');

const USER_MODELS = [User, Operator, Mechanic];

const findUserByUniqueCode = async (uniqueCode, projection = 'uniqueCode name pushTokens') => {
  for (const Model of USER_MODELS) {
    const user = await Model.findOne({ uniqueCode }).select(projection);
    if (user) return user;
  }
  return null;
};

const deactivateToken = (token) =>
  User.updateOne(
    { 'pushTokens.token': token },
    { $set: { 'pushTokens.$.isActive': false, updatedAt: new Date() } }
  );

const insertPushToken = async (uniqueCode, pushToken, platform = null) => {
  try {
    const tokenString = String(pushToken || '');
    if (!tokenString || tokenString.length < 100)
      return { success: false, message: 'Invalid push token format' };

    const user = await findUserByUniqueCode(uniqueCode, 'uniqueCode pushTokens');
    if (!user) return { success: false, message: 'User not found' };

    if (!user.pushTokens) user.pushTokens = [];

    const existingIndex = user.pushTokens.findIndex((t) => t.token === pushToken);

    if (existingIndex !== -1) {
      user.pushTokens[existingIndex] = {
        token: pushToken,
        platform: platform || user.pushTokens[existingIndex].platform,
        registeredAt: new Date(),
        isActive: true,
      };
    } else {
      user.pushTokens.push({ token: pushToken, platform, registeredAt: new Date(), isActive: true });
    }

    user.updatedAt = new Date();
    await user.save();

    return {
      success: true,
      message: 'Push token registered successfully',
      data: { uniqueCode: user.uniqueCode, tokenCount: user.pushTokens.length, platform },
    };
  } catch (error) {
    logger.error('[authN.token] insertPushToken', error);
    return { success: false, message: 'Failed to register push token', error: error.message };
  }
};

const insertVoipToken = async (uniqueCode, voipToken) => {
  try {
    const tokenString = String(voipToken || '');
    if (!tokenString) return { success: false, message: 'Invalid VoIP token' };

    for (const Model of USER_MODELS) {
      const updated = await Model.findOneAndUpdate(
        { uniqueCode },
        { voipPushToken: tokenString, updatedAt: new Date() },
        { new: true }
      );
      if (updated) return { success: true, message: 'VoIP token registered successfully' };
    }

    return { success: false, message: 'User not found' };
  } catch (error) {
    logger.error('[authN.token] insertVoipToken', error);
    return { success: false, message: 'Failed to register VoIP token', error: error.message };
  }
};

const removePushToken = async (uniqueCode, pushToken) => {
  try {
    const user = await findUserByUniqueCode(uniqueCode, 'uniqueCode pushTokens');
    if (!user) return { success: false, message: 'User not found' };
    if (!user.pushTokens || user.pushTokens.length === 0)
      return { success: false, message: 'No push tokens found for this user' };

    const initialLength = user.pushTokens.length;
    user.pushTokens = user.pushTokens.filter((t) => t.token !== pushToken);

    if (user.pushTokens.length === initialLength)
      return { success: false, message: 'Push token not found' };

    user.updatedAt = new Date();
    await user.save();

    return { success: true, message: 'Push token removed successfully' };
  } catch (error) {
    logger.error('[authN.token] removePushToken', error);
    return { success: false, message: 'Failed to remove push token', error: error.message };
  }
};

const cleanupInvalidTokens = async (uniqueCode = null) => {
  try {
    const query = uniqueCode ? { uniqueCode } : {};
    const users = await User.find(query);
    let totalCleaned = 0;

    for (const user of users) {
      if (!user.pushTokens || user.pushTokens.length === 0) continue;
      const initialLength = user.pushTokens.length;
      user.pushTokens = user.pushTokens.filter(
        (t) => t.token && typeof t.token === 'string' && t.token.length > 100
      );
      const cleaned = initialLength - user.pushTokens.length;
      if (cleaned > 0) {
        user.updatedAt = new Date();
        await user.save();
        totalCleaned += cleaned;
      }
    }

    return { success: true, message: `Cleaned up ${totalCleaned} invalid tokens`, data: { cleaned: totalCleaned } };
  } catch (error) {
    logger.error('[authN.token] cleanupInvalidTokens', error);
    return { success: false, message: 'Failed to cleanup tokens', error: error.message };
  }
};

const getUserPushTokens = async (uniqueCode) => {
  try {
    const user = await User.findOne({ uniqueCode }).select('uniqueCode name pushTokens');
    if (!user) return { success: false, message: 'User not found' };

    return {
      success: true,
      data: {
        uniqueCode: user.uniqueCode,
        name: user.name,
        pushTokens: user.pushTokens || [],
        tokenCount: user.pushTokens?.length || 0,
      },
    };
  } catch (error) {
    logger.error('[authN.token] getUserPushTokens', error);
    return { success: false, message: 'Failed to get push tokens', error: error.message };
  }
};

module.exports = {
  findUserByUniqueCode,
  deactivateToken,
  insertPushToken,
  insertVoipToken,
  removePushToken,
  cleanupInvalidTokens,
  getUserPushTokens,
};