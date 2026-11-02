const crypto = require('crypto');
const User = require('#features/user/staff/staff.model');

const hashSigningKey = (signingKey) => crypto.createHash('sha256').update(String(signingKey)).digest('hex');

const registerMobileSigningKey = async (userId, deviceId, signingKey) => {
  if (!deviceId || !signingKey) throw { status: 400, message: 'deviceId and signingKey are required' };

  const user = await User.findById(userId);
  if (!user) throw { status: 404, message: 'User not found' };

  const keyHash = hashSigningKey(signingKey);
  const existing = user.mobileSigningKeys.find((k) => k.deviceId === deviceId);

  if (existing) {
    existing.keyHash = keyHash;
    existing.isActive = true;
    existing.registeredAt = new Date();
  } else {
    user.mobileSigningKeys.push({ deviceId, keyHash });
  }

  await user.save({ validateModifiedOnly: true });
  return { status: 200, message: 'Mobile signing key registered', data: { deviceId } };
};

module.exports = {
  registerMobileSigningKey,
};