const HTTP = require('#shared/response/response.status');
const { createSession, buildDeviceData } = require('#core/session/session.service');
const { generateAuthTokens } = require('#middlewares/jwt.middleware');
const { resolveOptionalSignedUrl } = require('#core/s3/s3.signed.url');

const ACCOUNT_NOT_FOUND_MESSAGE = 'Your account does not exist in our system. Please contact the admin.';

const findAccountByQatarId = (Model, qatarId) => Model.findOne({ qatarId: String(qatarId).trim() });

const buildAccountSummary = async (account) => ({
  _id: account._id,
  name: account.name,
  designation: account.designation || '',
  profilePic: {
    filePath: account.profilePic?.filePath ?? '',
    signedUrl: await resolveOptionalSignedUrl(account.profilePic?.filePath),
  },
  qatarId: account.qatarId,
});

const buildAccountNotFoundResult = () => ({
  status: HTTP.NOT_FOUND,
  success: false,
  message: ACCOUNT_NOT_FOUND_MESSAGE,
});

const verifyQatarAccount = async (Model, qatarId) => {
  const account = await findAccountByQatarId(Model, qatarId);
  if (!account) return buildAccountNotFoundResult();

  return { status: HTTP.OK, success: true, message: 'Account found', data: await buildAccountSummary(account) };
};

const loginQatarAccount = async ({ Model, sessionUserModel, qatarId, deviceInfo }) => {
  const account = await findAccountByQatarId(Model, qatarId);
  if (!account) return buildAccountNotFoundResult();

  const sessionToken = await createSession(
    account._id,
    sessionUserModel,
    buildDeviceData(deviceInfo),
    deviceInfo?.location || null
  );

  const tokens = generateAuthTokens({
    _id: account._id,
    email: account.qatarId,
    role: account.role,
    uniqueCode: account.uniqueCode,
    userType: account.userType,
    name: account.name,
  });

  return {
    status: HTTP.OK,
    success: true,
    message: 'Login successful',
    authorized: true,
    data: {
      user: {
        _id: account._id,
        name: account.name,
        email: account.email || '',
        role: account.role,
        userType: account.userType,
        uniqueCode: account.uniqueCode,
        designation: account.designation || '',
        profilePic: { filePath: account.profilePic?.filePath ?? '' },
        equipmentNumber: account.equipmentNumber || null,
        qatarId: account.qatarId,
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      sessionToken,
    },
  };
};

module.exports = { verifyQatarAccount, loginQatarAccount };