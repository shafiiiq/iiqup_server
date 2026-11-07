const crypto = require('crypto');
const HTTP = require('#shared/response/response.status');
const User = require('#features/user/staff/staff.model');
const { createSession, buildDeviceData } = require('#core/session/session.service');
const { generateAuthTokens } = require('#middlewares/jwt.middleware');

const hashValue = (value) => crypto.createHash('sha256').update(String(value)).digest();

const isMatchingSecret = (providedValue, expectedValue) =>
  crypto.timingSafeEqual(hashValue(providedValue), hashValue(expectedValue));

const normalizeEmail = (email) => String(email).trim().toLowerCase();

const getGuestOfficeAccounts = () =>
  [
    { email: process.env.APPLE_GUEST_OFFICE_EMAIL, password: process.env.APPLE_GUEST_OFFICE_PASS },
    { email: process.env.APPLE_GUEST_OFFICE_EMAIL_USER_B, password: process.env.APPLE_GUEST_OFFICE_PASS_USER_B },
  ].filter((account) => account.email && account.password);

const findGuestOfficeAccount = (email, password) => {
  if (!email || !password) return null;

  return (
    getGuestOfficeAccounts().find(
      (account) =>
        isMatchingSecret(normalizeEmail(email), normalizeEmail(account.email)) &&
        isMatchingSecret(password, account.password)
    ) || null
  );
};

const isGuestOfficeCredentials = (email, password) => Boolean(findGuestOfficeAccount(email, password));

const loginGuestOfficeStaff = async (email, deviceInfo) => {
  const user = await User.findOne({ email: normalizeEmail(email) });
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