const crypto = require('crypto');
const HTTP = require('#shared/response/response.status');
const User = require('#features/user/staff/staff.model');
const { createSession, buildDeviceData } = require('#core/session/session.service');
const { generateAuthTokens } = require('#middlewares/jwt.middleware');

const hashValue = (value) => crypto.createHash('sha256').update(String(value)).digest();

const isMatchingSecret = (providedValue, expectedValue) =>
  crypto.timingSafeEqual(hashValue(providedValue), hashValue(expectedValue));

const normalizeEmail = (email) => String(email).trim().toLowerCase();

const isGuestOfficeCredentials = (email, password) => {
  const guestOfficeEmail = process.env.APPLE_GUEST_OFFICE_EMAIL;
  const guestOfficePassword = process.env.APPLE_GUEST_OFFICE_PASS;
  if (!guestOfficeEmail || !guestOfficePassword || !email || !password) return false;

  return (
    isMatchingSecret(normalizeEmail(email), normalizeEmail(guestOfficeEmail)) &&
    isMatchingSecret(password, guestOfficePassword)
  );
};

const loginGuestOfficeStaff = async (deviceInfo) => {
  const user = await User.findOne({ email: normalizeEmail(process.env.APPLE_GUEST_OFFICE_EMAIL) });
  if (!user) {
    return { status: HTTP.NOT_FOUND, success: false, message: 'Guest office account not found' };
  }
  if (!user.isActive) {
    return { status: HTTP.FORBIDDEN, success: false, message: 'Your account has been deactivated. Please contact an administrator.' };
  }

  const tokens = generateAuthTokens({
    _id: user._id,
    email: user.email,
    role: user.role,
    uniqueCode: user.uniqueCode,
    userType: user.userType,
    name: user.name,
  });

  const sessionToken = await createSession(
    user._id,
    'User',
    deviceInfo ? buildDeviceData(deviceInfo) : { loginTime: new Date().toISOString() },
    deviceInfo?.location || null
  );

  return {
    status: HTTP.OK,
    success: true,
    message: 'Login successful',
    authorized: true,
    data: {
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        userType: user.userType,
        uniqueCode: user.uniqueCode,
        designation: user.designation || '',
        profilePic: { filePath: user.profilePic?.filePath ?? '' },
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      sessionToken,
    },
  };
};

module.exports = { isGuestOfficeCredentials, loginGuestOfficeStaff };