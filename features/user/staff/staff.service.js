const logger = require('#shared/logger/logger')
const { AppError } = require('#shared/errors/error.http');
const HTTP = require('#shared/response/response.status')
const bcrypt = require('bcrypt');
const User = require('./staff.model')
const Mechanic = require('../mechanic/mechanic.model')
const Operator = require('../operator/operator.model')
const { paginate } = require('#shared/pagination/pagination')
const notificatonPush = require('#core/notification/notification.push');
const { createSession } = require('#core/session/session.service');
const { generateAuthTokens } = require('#middlewares/jwt.middleware');
const { generateUniqueCode } = require('./staff.helper');

const insertUser = async (userData) => {
  try {
    if (userData.userType !== 'staff') {
      return { status: HTTP.BAD_REQUEST, message: 'Only staff users can be created via this endpoint' };
    }

    const existingUser = await User.findOne({ email: userData.email });
    if (existingUser) return { status: HTTP.CONFLICT, message: 'User already exists with this email' };

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(userData.password, salt);
    const uniqueCode = generateUniqueCode(userData.role);

    const newUser = await new User({
      ...userData,
      password: hashedPassword,
      uniqueCode,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).save();
    const token = generateAuthTokens(newUser);

    return {
      status: HTTP.OK,
      message: 'User created successfully',
      data: {
        user: {
          _id: newUser._id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
          uniqueCode: newUser.uniqueCode,
          userType: newUser.userType,
        },
        token,
      },
    };
  } catch (error) {
    logger.error('[staff.service] insertUser', error);
    throw { status: HTTP.INTERNAL_SERVER_ERROR, message: 'Failed to create user', error: error.message };
  }
};

const userUpdate = async (userId, updateData) => {
  try {
    const user = await User.findById(userId);
    if (!user) return { status: HTTP.NOT_FOUND, message: 'User not found' };

    if (updateData.password) {
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(updateData.password, salt);
    }

    if (updateData.role && updateData.role !== user.role) {
      updateData.uniqueCode = generateUniqueCode(updateData.role);
    }

    updateData.updatedAt = new Date();

    const updatedUser = await User.findByIdAndUpdate(userId, { $set: updateData }, { new: true, select: '-password' });
    return { status: HTTP.OK, message: 'User updated successfully', data: updatedUser };
  } catch (error) {
    logger.error('[staff.service] userUpdate', error);
    throw { status: HTTP.INTERNAL_SERVER_ERROR, message: 'Failed to update user', error: error.message };
  }
};

const userDelete = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) return { status: HTTP.NOT_FOUND, message: 'User not found' };
    await User.findByIdAndDelete(userId);
    return { status: HTTP.OK, message: 'User deleted successfully' };
  } catch (error) {
    logger.error('[staff.service] userDelete', error);
    throw { status: HTTP.INTERNAL_SERVER_ERROR, message: 'Failed to delete user', error: error.message };
  }
};

const updateUserAuthMail = async (userId, authMail, type) => {
  try {
    if (!authMail) {
      return { status: HTTP.BAD_REQUEST, success: false, message: 'Please provide a valid email' };
    }

    const update = { authMail, updatedAt: new Date() };
    const options = { new: true };

    let updatedUser;
    if (type === 'mechanic') {
      updatedUser = await Mechanic.findByIdAndUpdate(userId, update, options).select('-password');
    } else if (type === 'operator') {
      updatedUser = await Operator.findByIdAndUpdate(userId, update, options).select('-password');
    } else {
      updatedUser = await User.findByIdAndUpdate(userId, update, options).select('-password');
    }

    if (!updatedUser) return { status: HTTP.NOT_FOUND, success: false, message: 'User not found' };

    return {
      status: HTTP.OK,
      success: true,
      message: 'Authentication email updated successfully',
      data: { _id: updatedUser._id, phone: updatedUser.phone },
    };
  } catch (error) {
    logger.error('[staff.service] updateUserAuthMail', error);
    return { status: HTTP.INTERNAL_SERVER_ERROR, success: false, message: 'Failed to update phone number', error: error.message };
  }
};

const fetchUsers = async (pagination) => {
  try {
    const result = await paginate(User, {}, pagination, { projection: { password: 0 } });
    return { status: HTTP.OK, message: 'Users fetched successfully', data: result.data, pagination: result.pagination };
  } catch (error) {
    logger.error('[staff.service] fetchUsers', error);
    throw { status: HTTP.INTERNAL_SERVER_ERROR, message: 'Failed to fetch users', error: error.message };
  }
};

const fetchUserById = async (id) => {
  try {
    const data = await User.findById(id);
    return { status: HTTP.OK, ok: true, data };
  } catch (error) {
    logger.error('[staff.service] fetchUsers', error);
    throw { status: HTTP.INTERNAL_SERVER_ERROR, message: 'Failed to fetch users', error: error.message };
  }
};

const fetchAllUsers = async (pagination) => {
  try {
    const [staff, mechanic, operator] = await Promise.all([
      paginate(User, {}, pagination, { projection: { password: 0 } }),
      paginate(Mechanic, {}, pagination, { projection: { password: 0 } }),
      paginate(Operator, {}, pagination, { projection: { password: 0 } }),
    ]);
    return {
      status: HTTP.OK,
      message: 'Users fetched successfully',
      data: { staff: staff.data, mechanic: mechanic.data, operator: operator.data },
      pagination: { staff: staff.pagination, mechanic: mechanic.pagination, operator: operator.pagination },
    };
  } catch (error) {
    logger.error('[staff.service] fetchAllUsers', error);
    throw { status: HTTP.INTERNAL_SERVER_ERROR, message: 'Failed to fetch users', error: error.message };
  }
};

const verifyStaffCredentials = async (email, password, deviceInfo) => {
  try {
    const user = await User.findOne({ email });

    if (!user) {
      return { status: HTTP.UNAUTHORIZED, success: false, message: 'Invalid email or password' };
    }
    if (!user.isActive) {
      return { status: HTTP.FORBIDDEN, success: false, message: 'Your account has been deactivated. Please contact an administrator.' };
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return { status: HTTP.UNAUTHORIZED, success: false, message: 'Invalid email or password' };
    }

    await notificatonPush.dispatchNotificationToUser(
      user.uniqueCode,
      'Are you certain this is you?',
      "login attempt detected. If this wasn't you, your credentials may be compromised. Update them immediately",
      'high',
      'normal'
    );

    const deviceData = {
      deviceName: deviceInfo?.deviceName || 'Unknown Device',
      deviceModel: deviceInfo?.deviceModel || 'Unknown Model',
      deviceId: deviceInfo?.deviceId || 'Unknown ID',
      brand: deviceInfo?.brand || 'Unknown',
      osName: deviceInfo?.osName || 'Unknown OS',
      osVersion: deviceInfo?.osVersion || 'Unknown',
      platform: deviceInfo?.platform || 'Unknown',
      loginTime: deviceInfo?.loginTime || new Date().toISOString(),
      ipAddress: deviceInfo?.ipAddress || 'Unknown IP',
      locationAddress: deviceInfo?.locationAddress || 'Unknown',
    };

    const sessionToken = await createSession(user._id, 'User', deviceData, deviceInfo?.location || null);

    const tokens = generateAuthTokens({
      _id: user._id,
      email: user.email,
      role: user.role,
      uniqueCode: user.uniqueCode,
      userType: user.userType,
      name: user.name,
    });

    return {
      status: HTTP.OK,
      success: true,
      message: 'Authentication successful',
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        department: user.department,
        uniqueCode: user.uniqueCode,
        lastLogin: user.lastLogin,
        authMail: user.authMail,
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      sessionToken,
    };
  } catch (error) {
    logger.error('[staff.service.js] verifyStaffCredentials', error);
    return { status: HTTP.INTERNAL_SERVER_ERROR, success: false, message: 'Authentication failed', error: error.message };
  }
};

const verifyCEOcreds = async (email) => {
  try {
    const user = await User.findOne({ email });
    if (!user) return { status: HTTP.UNAUTHORIZED, success: false, message: 'Invalid email or password' };
    if (!user.isActive) {
      return { status: HTTP.FORBIDDEN, success: false, message: 'Your account has been deactivated. Please contact an administrator.' };
    }

    if (user.email !== process.env.CEO_EMAIL && email !== process.env.CEO_EMAIL) {
      return { status: HTTP.OK, success: true, message: 'Authentication failed, user is not a ceo', data: null };
    }

    return { status: HTTP.OK, success: true, message: 'Authentication successful', data: user.uniqueCode };
  } catch (error) {
    logger.error('[staff.service] verifyCEOcreds', error);
    return { status: HTTP.INTERNAL_SERVER_ERROR, success: false, message: 'Authentication failed', error: error.message };
  }
};

const verifyDocAuthUserCreds = async (password) => {
  try {
    const user = await User.findOne({ email: process.env.AUTH_USER });
    if (!user) return { status: HTTP.UNAUTHORIZED, success: false, message: 'Invalid email or password' };
    if (!user.isActive) {
      return { status: HTTP.FORBIDDEN, success: false, message: 'Your account has been deactivated. Please contact an administrator.' };
    }

    const isPasswordValid = await bcrypt.compare(password, user.docAuthPasw);
    if (!isPasswordValid) return { status: HTTP.UNAUTHORIZED, success: false, message: 'Invalid email or password' };

    return { status: HTTP.OK, success: true, message: 'Authentication successful' };
  } catch (error) {
    logger.error('[staff.service] verifyDocAuthUserCreds', error);
    return { status: HTTP.INTERNAL_SERVER_ERROR, success: false, message: 'Authentication failed', error: error.message };
  }
};

const changePassword = async (email, currentPassword, newPassword) => {
  try {
    const user = await User.findOne({ email });
    if (!user) return { status: HTTP.UNAUTHORIZED, success: false, message: 'Invalid email or password' };
    if (!user.isActive) {
      return { status: HTTP.FORBIDDEN, success: false, message: 'Your account has been deactivated. Please contact an administrator.' };
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) return { status: HTTP.UNAUTHORIZED, success: false, message: 'Current password is incorrect' };

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    const updatedUser = await User.findByIdAndUpdate(user._id, { password: hashedPassword }, { new: true, select: '-password' });

    return { status: HTTP.OK, success: true, message: 'Password changed successfully', data: updatedUser };
  } catch (error) {
    logger.error('[staff.service] changePassword', error);
    return { status: HTTP.INTERNAL_SERVER_ERROR, success: false, message: 'Password change failed', error: error.message };
  }
};

const resetPassword = async (email, type) => {
  try {
    let user;
    if (type === 'mechanic') user = await Mechanic.findOne({ email });
    else if (type === 'operator') user = await Operator.findOne({ email });
    else user = await User.findOne({ email });

    if (!user) return { status: HTTP.UNAUTHORIZED, success: false, message: 'Invalid email or password' };
    if (!user.isActive) {
      return { status: HTTP.FORBIDDEN, success: false, message: 'Your account has been deactivated. Please contact an administrator.' };
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(process.env.INIT_PSWD, salt);
    const updatedUser = await User.findByIdAndUpdate(user._id, { password: hashedPassword }, { new: true, select: '-password' });

    return { status: HTTP.OK, success: true, message: 'Reset changed successfully', data: updatedUser };
  } catch (error) {
    logger.error('[staff.service] resetPassword', error);
    return { status: HTTP.INTERNAL_SERVER_ERROR, success: false, message: 'Password reset failed', error: error.message };
  }
};

const getTutorialsSeen = async (userId) => {
  try {
    const user = await User.findById(userId).select('tutorialsSeen').lean();
    if (!user) return { status: HTTP.NOT_FOUND, success: false, message: 'User not found' };
    return { status: HTTP.OK, success: true, tutorialsSeen: user.tutorialsSeen || [] };
  } catch (error) {
    logger.error('[staff.service] getTutorialsSeen', error);
    throw new Error(`[staff.service] getTutorialsSeen: ${error.message}`, { cause: error });
  }
};

const completeTutorial = async (userId, tutorialId) => {
  try {
    await User.findByIdAndUpdate(userId, { $addToSet: { tutorialsSeen: tutorialId } });
    return { status: HTTP.OK, success: true };
  } catch (error) {
    logger.error('[staff.service] completeTutorial', error);
    throw new Error(`[staff.service] completeTutorial: ${error.message}`, { cause: error });
  }
};

module.exports = {
  insertUser,
  userUpdate,
  userDelete,
  updateUserAuthMail,
  fetchUsers,
  fetchUserById,
  fetchAllUsers,
  verifyStaffCredentials,
  verifyCEOcreds,
  verifyDocAuthUserCreds,
  changePassword,
  resetPassword,
  getTutorialsSeen,
  completeTutorial,
};