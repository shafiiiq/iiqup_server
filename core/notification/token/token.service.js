const logger = require('#shared/logger/logger');
const User = require('#features/user/staff/staff.model');
const Operator = require('#features/user/operator/operator.model');
const Mechanic = require('#features/user/mechanic/mechanic.model');

const USER_MODELS = [User, Operator, Mechanic];
const MIN_PUSH_TOKEN_LENGTH = 100;

const findUserByUniqueCode = async (uniqueCode, projection = 'uniqueCode name pushTokens') => {
  for (const Model of USER_MODELS) {
    const user = await Model.findOne({ uniqueCode }).select(projection);
    if (user) return user;
  }
  return null;
};

const deactivateToken = (token) =>
  Promise.all(
    USER_MODELS.map((Model) =>
      Model.updateMany(
        { 'pushTokens.token': token },
        { $set: { 'pushTokens.$[entry].isActive': false } },
        { arrayFilters: [{ 'entry.token': token }] }
      )
    )
  );

const removeTokenFromOtherUsers = (uniqueCode, pushToken) =>
  Promise.all(
    USER_MODELS.map((Model) =>
      Model.updateMany(
        { uniqueCode: { $ne: uniqueCode }, 'pushTokens.token': pushToken },
        { $pull: { pushTokens: { token: pushToken } } }
      )
    )
  );

const insertPushToken = async (uniqueCode, pushToken, platform = null) => {
  try {
    const tokenString = String(pushToken || '');
    if (tokenString.length < MIN_PUSH_TOKEN_LENGTH) {
      return { success: false, message: 'Invalid push token format' };
    }

    const user = await findUserByUniqueCode(uniqueCode, 'uniqueCode pushTokens');
    if (!user) return { success: false, message: 'User not found' };

    await removeTokenFromOtherUsers(uniqueCode, tokenString);

    const existingIndex = user.pushTokens.findIndex((entry) => entry.token === tokenString);
    if (existingIndex !== -1) {
      user.pushTokens[existingIndex] = {
        token: tokenString,
        platform: platform || user.pushTokens[existingIndex].platform,
        registeredAt: new Date(),
        isActive: true,
      };
    } else {
      user.pushTokens.push({ token: tokenString, platform, registeredAt: new Date(), isActive: true });
    }

    await user.save();

    return {
      success: true,
      message: 'Push token registered successfully',
      data: { uniqueCode: user.uniqueCode, tokenCount: user.pushTokens.length, platform },
    };
  } catch (error) {
    logger.error('[token.service] insertPushToken', error);
    return { success: false, message: 'Failed to register push token' };
  }
};

const insertVoipToken = async (uniqueCode, voipToken) => {
  try {
    const tokenString = String(voipToken || '');
    if (!tokenString) return { success: false, message: 'Invalid VoIP token' };

    for (const Model of USER_MODELS) {
      const updated = await Model.findOneAndUpdate({ uniqueCode }, { voipPushToken: tokenString }, { new: true });
      if (updated) return { success: true, message: 'VoIP token registered successfully' };
    }
    return { success: false, message: 'User not found' };
  } catch (error) {
    logger.error('[token.service] insertVoipToken', error);
    return { success: false, message: 'Failed to register VoIP token' };
  }
};

const clearVoipToken = (voipToken) =>
  Promise.all(
    USER_MODELS.map((Model) =>
      Model.updateMany({ voipPushToken: voipToken }, { $set: { voipPushToken: null } })
    )
  );

const removePushToken = async (uniqueCode, pushToken) => {
  try {
    const user = await findUserByUniqueCode(uniqueCode, 'uniqueCode pushTokens');
    if (!user) return { success: false, message: 'User not found' };

    const initialCount = user.pushTokens.length;
    user.pushTokens = user.pushTokens.filter((entry) => entry.token !== pushToken);
    if (user.pushTokens.length === initialCount) return { success: false, message: 'Push token not found' };

    await user.save();
    return { success: true, message: 'Push token removed successfully' };
  } catch (error) {
    logger.error('[token.service] removePushToken', error);
    return { success: false, message: 'Failed to remove push token' };
  }
};

const insertWebPushSubscription = async (uniqueCode, subscription) => {
  try {
    await User.updateMany(
      { uniqueCode: { $ne: uniqueCode }, 'webPushSubscription.endpoint': subscription.endpoint },
      { $set: { webPushSubscription: null } }
    );
    const updated = await User.findOneAndUpdate({ uniqueCode }, { $set: { webPushSubscription: subscription } });
    if (!updated) return { success: false, message: 'User not found' };
    return { success: true, message: 'Web push subscription registered successfully' };
  } catch (error) {
    logger.error('[token.service] insertWebPushSubscription', error);
    return { success: false, message: 'Failed to register web push subscription' };
  }
};

const removeWebPushSubscription = async (uniqueCode, endpoint) => {
  try {
    await User.updateOne(
      { uniqueCode, 'webPushSubscription.endpoint': endpoint },
      { $set: { webPushSubscription: null } }
    );
    return { success: true, message: 'Web push subscription removed successfully' };
  } catch (error) {
    logger.error('[token.service] removeWebPushSubscription', error);
    return { success: false, message: 'Failed to remove web push subscription' };
  }
};

const getUserPushTokens = async (uniqueCode) => {
  const user = await findUserByUniqueCode(uniqueCode);
  if (!user) return { success: false, message: 'User not found' };
  return {
    success: true,
    message: 'Push tokens retrieved',
    data: { uniqueCode: user.uniqueCode, name: user.name, pushTokens: user.pushTokens, tokenCount: user.pushTokens.length },
  };
};

module.exports = {
  findUserByUniqueCode,
  deactivateToken,
  insertPushToken,
  insertVoipToken,
  clearVoipToken,
  removePushToken,
  insertWebPushSubscription,
  removeWebPushSubscription,
  getUserPushTokens,
};