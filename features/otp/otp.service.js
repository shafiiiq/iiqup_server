const logger = require('#shared/logger/logger');
const HTTP = require('#shared/response/response.status');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const OTP = require('./otp.model');
const User = require('#features/user/staff/staff.model');
const Mechanic = require('#features/user/mechanic/mechanic.model');
const Operator = require('#features/user/operator/operator.model');
const emailService = require('./otp.email');
const { generateAuthTokens } = require('#middlewares/jwt.middleware');
const { createSession } = require('#core/session/session.service');
const { OTP_SALT_ROUNDS, MAX_OTP_ATTEMPTS, OTP_LENGTH, OTP_EXPIRY_MINUTES } = require('./otp.constant');

const generateSecureOTP = () => {
  const num = crypto.randomBytes(4).readUInt32BE(0);
  return ((num % 900000) + 100000).toString();
};

const hashOTP = async (otp) => {
  const salt = await bcrypt.genSalt(OTP_SALT_ROUNDS);
  return bcrypt.hash(otp, salt);
};

const verifyOTPHash = async (plain, hashed) => bcrypt.compare(plain, hashed);

const findUserByAuthMail = async (email) => {
  let user = await User.findOne({ authMail: email });
  if (!user) user = await Mechanic.findOne({ authMail: email });
  if (!user) user = await Operator.findOne({ authMail: email });
  return user;
};

const generateAndSendOTP = async (email, demo_opr = false, name) => {
  try {
    if (!email || !email.match(/^\S+@\S+\.\S+$/)) {
      return { status: HTTP.BAD_REQUEST, success: false, message: 'Valid email address is required' };
    }

    const user = await findUserByAuthMail(email);
    if (!user) {
      return { status: HTTP.NOT_FOUND, success: false, message: 'No user found with this email address' };
    }

    const otp = generateSecureOTP();
    const hashedOTP = await hashOTP(otp);

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + OTP_EXPIRY_MINUTES);

    await OTP.findOneAndUpdate(
      { email },
      { email, otp: hashedOTP, expiresAt, verified: false, attempts: 0, createdAt: new Date() },
      { upsert: true, new: true }
    );

    await emailService.sendOTPEmail(email, otp, demo_opr ? name : user.name, demo_opr);

    const isDemoAccount =
      process.env.DEMO_STAFF == user.email ||
      process.env.DEMO_MECHANIC == user.email ||
      demo_opr;
    const exposeOTP = isDemoAccount || process.env.NODE_ENV === 'development';

    return {
      status: HTTP.OK,
      success: true,
      message: 'OTP sent successfully to your email',
      data: {
        email,
        expiresAt,
        ...(exposeOTP && { otp }),
      },
    };
  } catch (error) {
    logger.error('[otp.service] generateAndSendOTP', error);
    return { status: HTTP.INTERNAL_SERVER_ERROR, success: false, message: 'Failed to generate OTP', error: error.message };
  }
};

const findUserForVerification = (email, type, qatarId) => {
  if (type === 'mechanic') {
    return Mechanic.findOne({ authMail: email }).select('_id name email role uniqueCode userType');
  }
  if (type === 'operator') {
    return Operator.findOne({ qatarId }).select('_id name uniqueCode userType equipmentNumber qatarId');
  }
  return User.findOne({ authMail: email }).select('_id name email role uniqueCode userType');
};

const sessionUserModel = (type) => {
  if (type === 'mechanic') return 'Mechanic';
  if (type === 'operator') return 'Operator';
  return 'User';
};

const verifyOTP = async (email, otp, type, qatarId = null) => {
  try {
    if (!otp || otp.length !== OTP_LENGTH) {
      return { status: HTTP.BAD_REQUEST, success: false, message: 'Invalid OTP format' };
    }

    const otpRecord = await OTP.findOne({ email });
    if (!otpRecord) return { status: HTTP.NOT_FOUND, success: false, message: 'Invalid OTP' };

    if (otpRecord.expiresAt < new Date()) {
      await OTP.deleteOne({ email });
      return { status: HTTP.BAD_REQUEST, success: false, message: 'OTP has expired. Please request a new one.' };
    }

    if (otpRecord.verified) {
      return { status: HTTP.BAD_REQUEST, success: false, message: 'OTP has already been used' };
    }

    if (otpRecord.attempts >= MAX_OTP_ATTEMPTS) {
      await OTP.deleteOne({ email });
      return { status: HTTP.TOO_MANY_REQUESTS, success: false, message: 'Maximum verification attempts exceeded. Please request a new OTP.' };
    }

    const isValid = await verifyOTPHash(otp, otpRecord.otp);

    if (!isValid) {
      otpRecord.attempts = (otpRecord.attempts || 0) + 1;
      await otpRecord.save();
      const remaining = MAX_OTP_ATTEMPTS - otpRecord.attempts;
      return { status: HTTP.BAD_REQUEST, success: false, message: `Invalid OTP. ${remaining} attempt(s) remaining.` };
    }

    otpRecord.verified = true;
    await otpRecord.save();

    const user = await findUserForVerification(email, type, qatarId);
    if (!user) return { status: HTTP.NOT_FOUND, success: false, message: 'User not found' };

    const tokens = generateAuthTokens({
      _id: user._id,
      email: type === 'operator' ? qatarId : user.email,
      role: user.role,
      uniqueCode: user.uniqueCode,
      userType: user.userType,
      name: user.name,
    });

    const sessionToken = await createSession(
      user._id,
      sessionUserModel(type),
      { loginTime: new Date().toISOString() },
      null
    );

    await OTP.deleteOne({ email });

    return {
      status: HTTP.OK,
      success: true,
      message: 'OTP verified successfully',
      authorized: true,
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          userType: user.userType,
          uniqueCode: user.uniqueCode,
          equipmentNumber: user.equipmentNumber || null,
          qatarId: user.qatarId || null,
        },
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        sessionToken,
      },
    };
  } catch (error) {
    logger.error('[otp.service] verifyOTP', error);
    return { status: HTTP.INTERNAL_SERVER_ERROR, success: false, message: 'Failed to verify OTP', error: error.message };
  }
};

module.exports = { generateAndSendOTP, verifyOTP };