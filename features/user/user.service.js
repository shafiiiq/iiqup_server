const logger = require('../../shared/logger/logger');

const AppError = require('../../shared/errors/AppError.js');
const HTTP = require('../../shared/constants/httpStatus.constant.js');
// services/user.service.js
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const User = require('./user.model');
const Mechanic = require('../mechanic/mechanic.model');
const Operator = require('../operator/operator.model');
const { paginationUtil: { paginate } } = require('../../shared/pagination');

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const {
  JWT_SECRET,
  USER_ROLES,
  ROLE_PREFIX_MAP,
} = require('./user.constant');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates a signed JWT for a user.
 * @param {object} user
 * @returns {string}
 */
const generateToken = (user) =>
  jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role,
      uniqueCode: user.uniqueCode,
    },
    JWT_SECRET,
    { expiresIn: '365d' }
  );

/**
 * Generates a role-prefixed unique code.
 * @param {string} role
 * @returns {string}
 */
const generateUniqueCode = (role) => {
  const prefix = ROLE_PREFIX_MAP[role] || 'USR';
  return `${prefix}-${uuidv4().substring(0, 6)}`;
};

// ─────────────────────────────────────────────────────────────────────────────
// Write
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a new user, mechanic, or operator.
 * @param {object} userData
 * @returns {Promise}
 */
const insertUser = async (userData) => {
  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(userData.password, salt);

    if (userData.userType === 'office') {
      const existingUser = await User.findOne({ email: userData.email });
      if (existingUser)
        return { status: HTTP.CONFLICT, message: 'User already exists with this email' };

      const uniqueCode = generateUniqueCode(userData.role);
      const newUser = await new User({
        ...userData,
        password: hashedPassword,
        uniqueCode,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).save();
      const token = generateToken(newUser);

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
    }

    if (userData.userType === 'mechanic') {
      const existingMechanic = await Mechanic.findOne({
        email: userData.email,
      });
      if (existingMechanic)
        return {
          status: HTTP.CONFLICT,
          message: 'Mechanic already exists with this email',
        };

      const updatedMechanic = await Mechanic.findByIdAndUpdate(
        userData.id,
        { email: userData.email, password: hashedPassword },
        { new: true }
      );
      if (!updatedMechanic)
        return { status: HTTP.NOT_FOUND, message: 'Mechanic not found' };

      const token = generateToken(updatedMechanic);
      return {
        status: HTTP.CREATED,
        message: 'Mechanic updated successfully',
        data: {
          user: {
            _id: updatedMechanic._id,
            name: updatedMechanic.name,
            email: updatedMechanic.email,
            role: updatedMechanic.role,
            userType: userData.userType,
          },
          token,
        },
      };
    }

    if (userData.userType === 'operator') {
      const existingUser = await Operator.findOne({
        qatarId: userData.qatarId,
      });
      if (existingUser)
        return {
          status: HTTP.CONFLICT,
          message: 'User already exists with this qatar Id',
        };

      const uniqueCode = generateUniqueCode('OPERATOR');
      const newUser = await new Operator({
        name: userData.name,
        qatarId: userData.qatarId,
        role: userData.userType,
        uniqueCode,
        equipment: userData.equipment,
        tag: process.env.TAG_CODE,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).save();
      const token = generateToken(newUser);

      return {
        status: HTTP.CREATED,
        message: 'Operator created successfully',
        data: {
          user: {
            _id: newUser._id,
            name: newUser.name,
            qatarId: newUser.qatarId,
            role: newUser.role,
            uniqueCode: newUser.uniqueCode,
            userType: newUser.userType,
            equipment: newUser.equipment,
          },
          token,
        },
      };
    }
  } catch (error) {
    logger.error('[UserService] insertUser:', error);
    throw {
      status: HTTP.INTERNAL_SERVER_ERROR,
      message: 'Failed to create user',
      error: error.message,
    };
  }
};

/**
 * Updates a user's data by ID.
 * @param {string} userId
 * @param {object} updateData
 * @returns {Promise}
 */
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

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, select: '-password' }
    );
    return {
      status: HTTP.OK,
      message: 'User updated successfully',
      data: updatedUser,
    };
  } catch (error) {
    logger.error('[UserService] userUpdate:', error);
    throw {
      status: HTTP.INTERNAL_SERVER_ERROR,
      message: 'Failed to update user',
      error: error.message,
    };
  }
};

/**
 * Deletes a user by ID.
 * @param {string} userId
 * @returns {Promise}
 */
const userDelete = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) return { status: HTTP.NOT_FOUND, message: 'User not found' };
    await User.findByIdAndDelete(userId);
    return { status: HTTP.OK, message: 'User deleted successfully' };
  } catch (error) {
    logger.error('[UserService] userDelete:', error);
    throw {
      status: HTTP.INTERNAL_SERVER_ERROR,
      message: 'Failed to delete user',
      error: error.message,
    };
  }
};

/**
 * Updates a user's auth email.
 * @param {string} userId
 * @param {string} authMail
 * @param {string} type - 'mechanic' | 'operator' | 'office'
 * @returns {Promise}
 */
const updateUserAuthMail = async (userId, authMail, type) => {
  try {
    if (!authMail)
      return {
        status: HTTP.BAD_REQUEST,
        success: false,
        message: 'Please provide a valid email',
      };

    const update = { authMail, updatedAt: new Date() };
    const options = { new: true };

    let updatedUser;
    if (type === 'mechanic')
      updatedUser = await Mechanic.findByIdAndUpdate(
        userId,
        update,
        options
      ).select('-password');
    else if (type === 'operator')
      updatedUser = await Operator.findByIdAndUpdate(
        userId,
        update,
        options
      ).select('-password');
    else
      updatedUser = await User.findByIdAndUpdate(
        userId,
        update,
        options
      ).select('-password');

    if (!updatedUser)
      return { status: HTTP.NOT_FOUND, success: false, message: 'User not found' };

    return {
      status: HTTP.OK,
      success: true,
      message: 'Authentication email updated successfully',
      data: { _id: updatedUser._id, phone: updatedUser.phone },
    };
  } catch (error) {
    return {
      status: HTTP.INTERNAL_SERVER_ERROR,
      success: false,
      message: 'Failed to update phone number',
      error: error.message,
    };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Read
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches all office users (excludes passwords).
 * @param {object} pagination
 * @returns {Promise}
 */
const fetchUsers = async (pagination) => {
  try {
    const result = await paginate(User, {}, pagination, {
      projection: { password: 0 },
    });
    return {
      status: HTTP.OK,
      message: 'Users fetched successfully',
      data: result.data,
      pagination: result.pagination,
    };
  } catch (error) {
    logger.error('[UserService] fetchUsers:', error);
    throw {
      status: HTTP.INTERNAL_SERVER_ERROR,
      message: 'Failed to fetch users',
      error: error.message,
    };
  }
};

/**
 * Fetches all users across all user types.
 * @param {object} pagination
 * @returns {Promise}
 */
const fetchAllUsers = async (pagination) => {
  try {
    const [office, mechanic, operator] = await Promise.all([
      paginate(User, {}, pagination, { projection: { password: 0 } }),
      paginate(Mechanic, {}, pagination, { projection: { password: 0 } }),
      paginate(Operator, {}, pagination, { projection: { password: 0 } }),
    ]);
    return {
      status: HTTP.OK,
      message: 'Users fetched successfully',
      data: {
        office: office.data,
        mechanic: mechanic.data,
        operator: operator.data,
      },
      pagination: {
        office: office.pagination,
        mechanic: mechanic.pagination,
        operator: operator.pagination,
      },
    };
  } catch (error) {
    logger.error('[UserService] fetchAllUsers:', error);
    throw {
      status: HTTP.INTERNAL_SERVER_ERROR,
      message: 'Failed to fetch users',
      error: error.message,
    };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Logs in an office user by email and password.
 * @param {string} email
 * @param {string} password
 * @returns {Promise}
 */
const loginUser = async (email, password) => {
  try {
    const user = await User.findOne({ email });
    if (!user) return { status: HTTP.NOT_FOUND, message: 'User not found' };

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) return { status: HTTP.UNAUTHORIZED, message: 'Invalid password' };

    const token = generateToken(user);
    return {
      status: HTTP.OK,
      message: 'Login successful',
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          uniqueCode: user.uniqueCode,
        },
        token,
      },
    };
  } catch (error) {
    logger.error('[UserService] loginUser:', error);
    throw { status: HTTP.INTERNAL_SERVER_ERROR, message: 'Login failed', error: error.message };
  }
};

/**
 * Verifies user credentials across all user types and creates a session.
 * @param {string} email
 * @param {string} password
 * @param {string} type
 * @param {object} deviceInfo
 * @returns {Promise}
 */
const verifyUserCredentials = async (email, password, type, deviceInfo) => {
  try {
    const PushNotificationService = require('../notification/notification.push');
    const { sessionAuth: { createSession } } = require('../../shared/auth');

    let user, userModel;

    if (type === 'mechanic') {
      user = await Mechanic.findOne({ email });
      userModel = 'Mechanic';
    } else if (type === 'operator') {
      user = await Operator.findOne({ email });
      userModel = 'Operator';
    } else {
      user = await User.findOne({ email });
      userModel = 'User';
    }

    if (!user)
      return {
        status: HTTP.UNAUTHORIZED,
        success: false,
        message: 'Invalid email or password',
      };
    if (!user.isActive)
      return {
        status: HTTP.FORBIDDEN,
        success: false,
        message:
          'Your account has been deactivated. Please contact an administrator.',
      };

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid)
      return {
        status: HTTP.UNAUTHORIZED,
        success: false,
        message: 'Invalid email or password',
      };

    await PushNotificationService.sendGeneralNotification(
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

    const sessionToken = await createSession(
      user._id,
      userModel,
      deviceData,
      deviceInfo?.location || null
    );

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
        permissions: user.permissions,
        lastLogin: user.lastLogin,
        authMail: user.authMail,
        sessionToken,
      },
    };
  } catch (error) {
    return {
      status: HTTP.INTERNAL_SERVER_ERROR,
      success: false,
      message: 'Authentication failed',
      error: error.message,
    };
  }
};

/**
 * Verifies CEO credentials.
 * @param {string} email
 * @returns {Promise}
 */
const verifyCEOcreds = async (email) => {
  try {
    const user = await User.findOne({ email });
    if (!user)
      return {
        status: HTTP.UNAUTHORIZED,
        success: false,
        message: 'Invalid email or password',
      };
    if (!user.isActive)
      return {
        status: HTTP.FORBIDDEN,
        success: false,
        message:
          'Your account has been deactivated. Please contact an administrator.',
      };

    if (
      user.email !== process.env.CEO_EMAIL &&
      email !== process.env.CEO_EMAIL
    ) {
      return {
        status: HTTP.OK,
        success: true,
        message: 'Authentication failed, user is not a ceo',
        data: null,
      };
    }

    return {
      status: HTTP.OK,
      success: true,
      message: 'Authentication successful',
      data: user.uniqueCode,
    };
  } catch (error) {
    return {
      status: HTTP.INTERNAL_SERVER_ERROR,
      success: false,
      message: 'Authentication failed',
      error: error.message,
    };
  }
};

/**
 * Verifies the doc auth user's password.
 * @param {string} password
 * @returns {Promise}
 */
const verifyDocAuthUserCreds = async (password) => {
  try {
    const user = await User.findOne({ email: process.env.AUTH_USER });
    if (!user)
      return {
        status: HTTP.UNAUTHORIZED,
        success: false,
        message: 'Invalid email or password',
      };
    if (!user.isActive)
      return {
        status: HTTP.FORBIDDEN,
        success: false,
        message:
          'Your account has been deactivated. Please contact an administrator.',
      };

    const isPasswordValid = await bcrypt.compare(password, user.docAuthPasw);
    if (!isPasswordValid)
      return {
        status: HTTP.UNAUTHORIZED,
        success: false,
        message: 'Invalid email or password',
      };

    return { status: HTTP.OK, success: true, message: 'Authentication successful' };
  } catch (error) {
    return {
      status: HTTP.INTERNAL_SERVER_ERROR,
      success: false,
      message: 'Authentication failed',
      error: error.message,
    };
  }
};

/**
 * Changes a user's password.
 * @param {string} email
 * @param {string} currentPassword
 * @param {string} newPassword
 * @returns {Promise}
 */
const changePassword = async (email, currentPassword, newPassword) => {
  try {
    const user = await User.findOne({ email });
    if (!user)
      return {
        status: HTTP.UNAUTHORIZED,
        success: false,
        message: 'Invalid email or password',
      };
    if (!user.isActive)
      return {
        status: HTTP.FORBIDDEN,
        success: false,
        message:
          'Your account has been deactivated. Please contact an administrator.',
      };

    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password
    );
    if (!isPasswordValid)
      return {
        status: HTTP.UNAUTHORIZED,
        success: false,
        message: 'Current password is incorrect',
      };

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    const updatedUser = await User.findByIdAndUpdate(
      user._id,
      { password: hashedPassword },
      { new: true, select: '-password' }
    );

    return {
      status: HTTP.OK,
      success: true,
      message: 'Password changed successfully',
      data: updatedUser,
    };
  } catch (error) {
    return {
      status: HTTP.INTERNAL_SERVER_ERROR,
      success: false,
      message: 'Password change failed',
      error: error.message,
    };
  }
};

/**
 * Resets a user's password to the default.
 * @param {string} email
 * @param {string} type
 * @returns {Promise}
 */
const resetPassword = async (email, type) => {
  try {
    let user;
    if (type === 'mechanic') user = await Mechanic.findOne({ email });
    else if (type === 'operator') user = await Operator.findOne({ email });
    else user = await User.findOne({ email });

    if (!user)
      return {
        status: HTTP.UNAUTHORIZED,
        success: false,
        message: 'Invalid email or password',
      };
    if (!user.isActive)
      return {
        status: HTTP.FORBIDDEN,
        success: false,
        message:
          'Your account has been deactivated. Please contact an administrator.',
      };

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(process.env.INIT_PSWD, salt);
    const updatedUser = await User.findByIdAndUpdate(
      user._id,
      { password: hashedPassword },
      { new: true, select: '-password' }
    );

    return {
      status: HTTP.OK,
      success: true,
      message: 'Reset changed successfully',
      data: updatedUser,
    };
  } catch (error) {
    return {
      status: HTTP.INTERNAL_SERVER_ERROR,
      success: false,
      message: 'Password reset failed',
      error: error.message,
    };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────────────────────────────────────────

const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1] || req.cookies?.token;
  if (!token) return res.status(HTTP.UNAUTHORIZED).json({ message: 'No token provided' });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (error) {
    return res
      .status(HTTP.FORBIDDEN)
      .json({ message: 'Invalid or expired token' + error.message });
  }
};

const checkRole =
  (...roles) =>
  (req, res, next) => {
    if (!req.user) return res.status(HTTP.UNAUTHORIZED).json({ message: 'Unauthorized' });
    if (!roles.includes(req.user.role))
      return res
        .status(HTTP.FORBIDDEN)
        .json({ message: 'Access denied, insufficient permissions' });
    next();
  };

/**
 * Returns the tutorialsSeen array for a user.
 * @param {string} userId
 * @returns {Promise<{ status: number, success: boolean, tutorialsSeen: string[] }>}
 */
const getTutorialsSeen = async (userId) => {
  try {
    const user = await User.findById(userId).select('tutorialsSeen').lean();
    if (!user)
      return { status: HTTP.NOT_FOUND, success: false, message: 'User not found' };
    return {
      status: HTTP.OK,
      success: true,
      tutorialsSeen: user.tutorialsSeen || [],
    };
  } catch (error) {
    throw new Error(`[UserService] getTutorialsSeen:${error.message}`, {
      cause: error,
    });
  }
};

/**
 * Marks a tutorial as seen for a user (idempotent — safe to call multiple times).
 * @param {string} userId
 * @param {string} tutorialId
 * @returns {Promise<{ status: number, success: boolean }>}
 */
const completeTutorial = async (userId, tutorialId) => {
  try {
    await User.findByIdAndUpdate(userId, {
      $addToSet: { tutorialsSeen: tutorialId },
    });
    return { status: HTTP.OK, success: true };
  } catch (error) {
    throw new Error(`[UserService] completeTutorial:${error.message}`, {
      cause: error,
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  USER_ROLES,
  generateToken,
  generateUniqueCode,
  insertUser,
  userUpdate,
  userDelete,
  updateUserAuthMail,
  fetchUsers,
  fetchAllUsers,
  loginUser,
  verifyUserCredentials,
  verifyCEOcreds,
  verifyDocAuthUserCreds,
  changePassword,
  resetPassword,
  verifyToken,
  checkRole,
  getTutorialsSeen,
  completeTutorial,
};
