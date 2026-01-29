const User = require('../models/user.model');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const Mechanic = require('../models/mechanic.model');
const Operator = require('../models/operator.model');
const { default: mongoose } = require('mongoose');
const { renameFilesWithRequestId } = require('../multer/overtime-upload'); // Check this file too
const admin = require('firebase-admin');
const { createNotification } = require('../utils/notification-jobs');
const UAParser = require('ua-parser-js');
const mechanicServices = require('../services/mechanic-service.js')
const Session = require('../models/sessions.model');

// Initialize Firebase Admin
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('✅ Firebase Admin initialized');
} else {
  console.log('ℹ️ Firebase Admin already initialized');
}


const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = process.env.DEVICE_ENCRYPTION_KEY;

// JWT Secret key - should be stored in environment variables in production
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// User roles definition
const USER_ROLES = {
  CEO: 'CEO',
  SUPER_ADMIN: 'SUPER_ADMIN',
  CAMP_BOX: 'CAMP_BOSS',
  MD: 'MD',
  MANAGER: 'MANAGER',
  ASSISTANT_MANAGER: 'ASSISTANT_MANAGER',
  PURCHASE_MANAGER: 'PURCHASE_MANAGER',
  WORKSHOP_MANAGER: 'WORKSHOP_MANAGER',
  MAINTENANCE_HEAD: 'MAINTENANCE_HEAD',
  MECHANIC_HEAD: 'MECHANIC_HEAD',
  OPERATOR: 'OPERATOR',
  GUEST_USER: 'GUEST_USER',
  ACCOUNTANT: 'ACCOUNTANT',
  ASSISTANT_ACCOUNTANT: 'ASSISTANT_ACCOUNTANT',
  OFFICE_ADMIN: 'OFFICE_ADMIN',
  ASSISTANT_OFFICE_ADMIN: 'ASSISTANT_OFFICE_ADMIN',
  SUB_ADMIN: 'SUB_ADMIN',
  SUB_ACCOUNTANT: 'SUB_ACCOUNTANT',
  SUB_ASSISTANT_MANAGER: 'SUB_ASSISTANT_MANAGER',
};

// Insert a new user
const insertUser = async (userData) => {

  try {
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(userData.password, salt);

    // Check userType and decide where to store
    if (userData.userType === 'office') {
      // Check if user already exists in User schema
      const existingUser = await User.findOne({ email: userData.email });
      if (existingUser) {
        return {
          status: 409,
          message: 'User already exists with this email'
        };
      }

      // Generate unique identification code for the user
      const uniqueCode = generateUniqueCode(userData.role);

      // Create new user with the unique code
      const newUser = new User({
        ...userData,
        password: hashedPassword,
        uniqueCode,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      await newUser.save();

      // Generate token
      const token = generateToken(newUser);

      return {
        status: 200,
        message: 'User created successfully',
        data: {
          user: {
            _id: newUser._id,
            name: newUser.name,
            email: newUser.email,
            role: newUser.role,
            uniqueCode: newUser.uniqueCode,
            userType: newUser.userType
          },
          token
        }
      };
    } else if (userData.userType === 'mechanic') {
      // Check if mechanic already exists with this email
      const existingMechanic = await Mechanic.findOne({ email: userData.email });
      if (existingMechanic) {
        return {
          status: 409,
          message: 'Mechanic already exists with this email'
        };
      }

      // Update mechanic email and password
      const updatedMechanic = await Mechanic.findByIdAndUpdate(
        userData.id,
        {
          email: userData.email,
          password: hashedPassword
        },
        { new: true }
      );

      if (!updatedMechanic) {
        return {
          status: 404,
          message: 'Mechanic not found'
        };
      }

      // Generate token
      const token = generateToken(updatedMechanic);

      return {
        status: 201,
        message: 'Mechanic updated successfully',
        data: {
          user: {
            _id: updatedMechanic._id,
            name: updatedMechanic.name,
            email: updatedMechanic.email,
            role: updatedMechanic.role,
            userType: userData.userType
          },
          token
        }
      };
    } else if (userData.userType === 'operator') {
      // Check if user already exists in User schema
      const existingUser = await Operator.findOne({ qatarId: userData.qatarId });
      if (existingUser) {
        return {
          status: 409,
          message: 'User already exists with this qatar Id'
        };
      }

      const uniqueCode = generateUniqueCode('OPERATOR');

      // Create new user with the unique code
      const newUser = new Operator({
        name: userData.name,
        qatarId: userData.qatarId,
        role: userData.userType,
        uniqueCode: uniqueCode,
        equipment: userData.equipment,
        tag: process.env.TAG_CODE,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      await newUser.save();

      // Generate token
      const token = generateToken(newUser);

      return {
        status: 201,
        message: 'Operator created successfully',
        data: {
          user: {
            _id: newUser._id,
            name: newUser.name,
            qatarId: newUser.qatarId,
            role: newUser.role,
            uniqueCode: newUser.uniqueCode,
            userType: newUser.userType,
            equipment: newUser.equipment
          },
          token
        }
      };
    }
  } catch (error) {
    console.error('Error creating user:', error);
    throw {
      status: 500,
      message: 'Failed to create user',
      error: error.message
    };
  }
};

// Fetch all users
const fetchUsers = async () => {
  try {
    const users = await User.find({}, { password: 0 }); // Exclude password from results

    return {
      status: 200,
      message: 'Users fetched successfully',
      data: users
    };
  } catch (error) {
    console.error('Error fetching users:', error);
    throw {
      status: 500,
      message: 'Failed to fetch users',
      error: error.message
    };
  }
};

const fetchAllUsers = async () => {
  try {
    const office = await User.find({}, { password: 0 }); // Exclude password from results
    const mechanic = await Mechanic.find({}, { password: 0 }); // Exclude password from results
    const operator = await Operator.find({}, { password: 0 }); // Exclude password from results

    return {
      status: 200,
      message: 'Users fetched successfully',
      data: {
        office: office,
        mechanic: mechanic,
        operator: operator
      }
    };
  } catch (error) {
    console.error('Error fetching users:', error);
    throw {
      status: 500,
      message: 'Failed to fetch users',
      error: error.message
    };
  }
};

// Update user
const userUpdate = async (userId, updateData) => {
  try {
    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return {
        status: 404,
        message: 'User not found'
      };
    }

    // Handle password update separately if it exists in updateData
    if (updateData.password) {
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(updateData.password, salt);
    }

    // Update uniqueCode if role is changed
    if (updateData.role && updateData.role !== user.role) {
      updateData.uniqueCode = generateUniqueCode(updateData.role);
    }

    updateData.updatedAt = new Date();

    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, select: '-password' } // Return updated document and exclude password
    );

    return {
      status: 200,
      message: 'User updated successfully',
      data: updatedUser
    };
  } catch (error) {
    console.error('Error updating user:', error);
    throw {
      status: 500,
      message: 'Failed to update user',
      error: error.message
    };
  }
};

// Delete user
const userDelete = async (userId) => {
  try {
    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return {
        status: 404,
        message: 'User not found'
      };
    }

    // Delete user
    await User.findByIdAndDelete(userId);

    return {
      status: 200,
      message: 'User deleted successfully'
    };
  } catch (error) {
    console.error('Error deleting user:', error);
    throw {
      status: 500,
      message: 'Failed to delete user',
      error: error.message
    };
  }
};

// User login
const loginUser = async (email, password) => {
  try {
    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return {
        status: 404,
        message: 'User not found'
      };
    }

    // Validate password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return {
        status: 401,
        message: 'Invalid password'
      };
    }

    // Generate token
    const token = generateToken(user);

    return {
      status: 200,
      message: 'Login successful',
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          uniqueCode: user.uniqueCode
        },
        token
      }
    };
  } catch (error) {
    console.error('Error logging in:', error);
    throw {
      status: 500,
      message: 'Login failed',
      error: error.message
    };
  }
};

// Verify JWT token middleware
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1] || req.cookies?.token;

  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Error verifying token:', error);
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
};

// Check user role middleware
const checkRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied, insufficient permissions' });
    }

    next();
  };
};

// Generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role,
      uniqueCode: user.uniqueCode
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
};

// Generate unique identification code based on role
const generateUniqueCode = (role) => {
  // Creating a prefix based on role
  let prefix;
  switch (role) {
    case USER_ROLES.CEO:
      prefix = 'CEO';
      break;
    case USER_ROLES.SUPER_ADMIN:
      prefix = 'SAD';
      break;
    case USER_ROLES.CAMP_BOSS:
      prefix = 'CBS';
      break;
    case USER_ROLES.MD:
      prefix = 'MND';
      break;
    case USER_ROLES.MANAGER:
      prefix = 'MGR';
      break;
    case USER_ROLES.ASSISTANT_MANAGER:
      prefix = 'AMG';
      break;
    case USER_ROLES.PURCHASE_MANAGER:
      prefix = 'PUR';
      break;
    case USER_ROLES.WORKSHOP_MANAGER:
      prefix = 'WSM';
      break;
    case USER_ROLES.MAINTENANCE_HEAD:
      prefix = 'MNT';
      break;
    case USER_ROLES.MECHANIC_HEAD:
      prefix = 'MEC';
      break;
    case USER_ROLES.OPERATOR:
      prefix = 'OPR';
      break;
    case USER_ROLES.ACCOUNTANT:
      prefix = 'ACT';
      break;
    case USER_ROLES.ASSISTANT_ACCOUNTANT:
      prefix = 'AST';
      break;
    case USER_ROLES.OFFICE_ADMIN:
      prefix = 'OFA';
      break;
    case USER_ROLES.ASSISTANT_OFFICE_ADMIN:
      prefix = 'ASN';
      break;
    case USER_ROLES.SUB_ADMIN:
      prefix = 'SBN';
      break;
    case USER_ROLES.SUB_ACCOUNTANT:
      prefix = 'SBC';
      break;
    case USER_ROLES.GUEST_USER:
      prefix = 'GUE';
      break;
    default:
      prefix = 'USR';
  }

  // Generate a short random string (6 characters)
  const randomString = uuidv4().substring(0, 6);

  // Combine prefix and random string for unique code
  return `${prefix}-${randomString}`;
};


const verifyCEOcreds = async (email) => {
  try {
    // Find user by email
    const user = await User.findOne({ email });

    if (!user) {
      return {
        status: 401,
        success: false,
        message: 'Invalid email or password',
      };
    }

    // Check if user is active
    if (!user.isActive) {
      return {
        status: 403,
        success: false,
        message: 'Your account has been deactivated. Please contact an administrator.'
      };
    }

    if (user.email !== process.env.CEO_EMAIL && email !== process.env.CEO_EMAIL) {
      return {
        status: 200,
        success: true,
        message: 'Authentication failed, user is not a ceo',
        data: null
      }
    }

    return {
      status: 200,
      success: true,
      message: 'Authentication successful',
      data: user.uniqueCode
    };
  } catch (error) {
    return {
      status: 500,
      success: false,
      message: 'Authentication failed',
      error: error.message
    };
  }
};

const createSession = async (userId, userModel, deviceInfo, location) => {
  try {
    // Generate unique session token
    const sessionToken = crypto.randomBytes(32).toString('hex');

    // Session expires in 30 days
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const session = new Session({
      userId,
      userModel,
      sessionToken,
      deviceInfo,
      location,  // Store location separately
      isActive: true,
      expiresAt
    });

    await session.save();

    return sessionToken;
  } catch (error) {
    throw error;
  }
};
// helper function for session management end

/**
 * Verify user credentials for login
 * @param {string} email - User's email
 * @param {string} password - User's password
 * @param {string} type - User's type
 * @param {string} userAgent - User's userAgent
 * @param {string} ipAddress - User's ipAddress
 * @returns {Promise} - Promise with the result of the operation
 */
const verifyUserCredentials = async (email, password, type, deviceInfo) => {
  try {
    const PushNotificationService = require('../utils/push-notification-jobs');
    let user;
    let userModel;

    // Find user by email
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

    if (!user) {
      return {
        status: 401,
        success: false,
        message: 'Invalid email or password',
      };
    }

    // Check if user is active
    if (!user.isActive) {
      return {
        status: 403,
        success: false,
        message: 'Your account has been deactivated. Please contact an administrator.'
      };
    }

    // Compare passwords
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return {
        status: 401,
        success: false,
        message: 'Invalid email or password'
      };
    }

    await PushNotificationService.sendGeneralNotification(
      user.uniqueCode,
      `Are you certain this is you?`,
      `login attempt detected. If this wasn't  you, your credentials may be compromised. Update them immediately`,
      'high',
      'normal',
    );

    // Merge device info from frontend with backend parsing
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
      locationAddress: deviceInfo?.locationAddress || 'Unknown'
    };

    // Add location if available
    const locationData = deviceInfo?.location || null;

    // Create session
    const sessionToken = await createSession(
      user._id,
      userModel,
      deviceData,
      locationData  // Pass location separately
    );

    // Return user data without password
    const userData = {
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
      sessionToken
    };

    return {
      status: 200,
      success: true,
      message: 'Authentication successful',
      data: userData
    };
  } catch (error) {
    return {
      status: 500,
      success: false,
      message: 'Authentication failed',
      error: error.message
    };
  }
};

const changePassword = async (email, currentPassword, newPassword) => {
  try {
    // Find user by email
    const user = await User.findOne({ email });

    if (!user) {
      return {
        status: 401,
        success: false,
        message: 'Invalid email or password',
      };
    }

    // Check if user is active
    if (!user.isActive) {
      return {
        status: 403,
        success: false,
        message: 'Your account has been deactivated. Please contact an administrator.'
      };
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);

    if (!isPasswordValid) {
      return {
        status: 401,
        success: false,
        message: 'Current password is incorrect'
      };
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password using user._id (not email)
    const updatedUser = await User.findByIdAndUpdate(
      user._id,  // Use _id from found user
      { password: hashedPassword },  // Update password field
      { new: true, select: '-password' } // Return updated document without password
    );

    return {
      status: 200,
      success: true,
      message: 'Password changed successfully',
      data: updatedUser
    };
  } catch (error) {
    return {
      status: 500,
      success: false,
      message: 'Password change failed',
      error: error.message
    };
  }
};

const resetPassword = async (email, type) => {
  try {

    let user
    // Find user by email
    if (type === 'mechanic') {
      user = await Mechanic.findOne({ email });
    } else if (type === 'operator') {
      user = await Operator.findOne({ email });
    } else {
      user = await User.findOne({ email });
    }

    if (!user) {
      return {
        status: 401,
        success: false,
        message: 'Invalid email or password',
      };
    }

    // Check if user is active
    if (!user.isActive) {
      return {
        status: 403,
        success: false,
        message: 'Your account has been deactivated. Please contact an administrator.'
      };
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(process.env.INIT_PSWD, salt);

    const updatedUser = await User.findByIdAndUpdate(
      user._id,  // Use _id from found user
      { password: hashedPassword },  // reset password field
      { new: true, select: '-password' } // Return updated document without password
    );

    return {
      status: 200,
      success: true,
      message: 'Reset changed successfully',
      data: updatedUser
    };
  } catch (error) {
    return {
      status: 500,
      success: false,
      message: 'Password reset failed',
      error: error.message
    };
  }
};

/**
 * Verify doc auth user credentials for login
 * @param {string} email - User's email
 * @param {string} password - User's password
 * @returns {Promise} - Promise with the result of the operation
 */
const verifyDocAuthUserCreds = async (password) => {
  try {

    const user = await User.findOne({ email: process.env.AUTH_USER });

    if (!user) {
      return {
        status: 401,
        success: false,
        message: 'Invalid email or password',
      };
    }

    // Check if user is active
    if (!user.isActive) {
      return {
        status: 403,
        success: false,
        message: 'Your account has been deactivated. Please contact an administrator.'
      };
    }

    // Compare passwords
    const isPasswordValid = await bcrypt.compare(password, user.docAuthPasw);

    console.log(isPasswordValid);


    if (!isPasswordValid) {
      return {
        status: 401,
        success: false,
        message: 'Invalid email or password'
      };
    }

    return {
      status: 200,
      success: true,
      message: 'Authentication successful',
    };
  } catch (error) {
    return {
      status: 500,
      success: false,
      message: 'Authentication failed',
      error: error.message
    };
  }
};


/**
 * Update user's phone number
 * @param {string} userId - User's ID
 * @param {string} phone - New phone number
 * @returns {Promise} - Promise with the result of the operation
 */
const updateUserAuthMail = async (userId, authMail, type) => {
  try {
    // Check if email is valid
    if (!authMail) {
      return {
        status: 400,
        success: false,
        message: 'Please provide a valid email'
      };
    }

    let updatedUser

    // Update user's auth mail
    if (type === 'mechanic') {
      updatedUser = await Mechanic.findByIdAndUpdate(
        userId,
        {
          authMail: authMail,
          updatedAt: new Date()
        },
        { new: true }
      ).select('-password');
    } else if (type === 'operator') {
      updatedUser = await Operator.findByIdAndUpdate(
        userId,
        {
          authMail: authMail,
          updatedAt: new Date()
        },
        { new: true }
      ).select('-password');
    } else {
      updatedUser = await User.findByIdAndUpdate(
        userId,
        {
          authMail: authMail,
          updatedAt: new Date()
        },
        { new: true }
      ).select('-password');
    }

    if (!updatedUser) {
      return {
        status: 404,
        success: false,
        message: 'User not found'
      };
    }

    return {
      status: 200,
      success: true,
      message: 'Authentication email updated successfully',
      data: {
        _id: updatedUser._id,
        phone: updatedUser.phone
      }
    };
  } catch (error) {
    return {
      status: 500,
      success: false,
      message: 'Failed to update phone number',
      error: error.message
    };
  }
};

// Grant permission 
const grantPermission = async (mechanicId, purpose, data) => {
  try {
    const mechanic = await Mechanic.findById(mechanicId);

    if (!mechanic) {
      return {
        status: 404,
        message: 'Mechanic not found'
      };
    }

    let grantReceiver;

    switch (purpose) {
      case 'overtime':
        grantReceiver = await User.findOne({ uniqueCode: process.env.OVERTIME_AUTHORISE_CODE });
        break;
    }

    if (!grantReceiver) {
      return {
        status: 404,
        message: `No authorized user found to handle ${purpose} requests`
      };
    }

    const tempRequestId = new mongoose.Types.ObjectId();

    // Prepare media files data (files will be uploaded directly to S3 by client)
    const finalMediaFiles = (data.mediaFiles || []).map(file => ({
      fileName: file.fileName,
      originalName: file.originalName,
      filePath: file.filePath,
      fileSize: 0, // Will be updated after upload
      mimeType: file.mimeType,
      type: file.type,
      uploadDate: file.uploadDate,
      url: file.filePath // Will be replaced with actual URL when needed
    }));

    // Create the new grant access entry
    const grantEntry = {
      _id: tempRequestId,
      purpose: purpose,
      data: {
        ...data,
        mechanicId: mechanicId,
        mechanicName: mechanic.name,
        mechanicUserId: mechanic.userId,
        requestDate: new Date(),
        mediaFiles: finalMediaFiles,
        totalFiles: finalMediaFiles.length
      },
      granted: false,
      requestDate: new Date(),
      status: 'pending'
    };

    // Add the grant entry and save
    grantReceiver.grantAccess.push(grantEntry);
    await grantReceiver.save();

    // Send notification (same as before)
    try {
      const PushNotificationService = require('../utils/push-notification-jobs');
      const formattedDate = formatDate(data.date);
      let notificationMessage;

      if (data.times && data.times[0].in && data.times[0].out) {
        const inTime = convertToAMPM(data.times[0].in);
        const outTime = convertToAMPM(data.times[0].out);
        notificationMessage = `${mechanic.name} is requested to overtime from ${inTime} to ${outTime} for ${formattedDate}`;
      } else {
        notificationMessage = `${mechanic.name} has submitted an overtime request for ${formattedDate}`;
      }

      const notification = await createNotification({
        title: "Mechanic overtime request",
        description: notificationMessage,
        priority: "high",
        type: 'normal'
      });

      await PushNotificationService.sendGeneralNotification(
        null,
        "Mechanic overtime request",
        notificationMessage,
        'high',
        'normal',
        notification.data._id.toString()
      );
    } catch (notificationError) {
      console.error('Error sending push notification:', notificationError);
    }

    return {
      status: 200,
      message: `Permission request for ${purpose} has been submitted successfully`,
      data: {
        requestId: tempRequestId,
        mechanicName: mechanic.name,
        mechanicUserId: mechanic.userId,
        submittedAt: new Date(),
        mediaFilesUploaded: finalMediaFiles.length,
        mediaFiles: finalMediaFiles.map(f => ({
          fileName: f.fileName,
          type: f.type,
          uploadUrl: f.uploadUrl // Send back the presigned URL for client to upload
        }))
      }
    };

  } catch (error) {
    console.error('Error in grantPermission:', error);
    return {
      status: 500,
      message: 'Internal server error',
      error: error.message
    };
  }
};

const requestPermission = async (data) => {
  try {
    const user = await User.findOne({ userCode: data.userCode });

    if (!user) {
      return {
        status: 404,
        message: 'User not found'
      };
    }

    let grantReceiver;

    switch (data.type) {
      case 'loan':
        grantReceiver = await User.findOne({ uniqueCode: process.env.OVERTIME_AUTHORISE_CODE });
        break;
      case 'leave':
        grantReceiver = await User.findOne({ uniqueCode: process.env.OVERTIME_AUTHORISE_CODE });
        break;
      // Add other cases as needed
      // default:
      //   grantReceiver = await User.findOne({ role: userRoles.SUPER_ADMIN });
    }

    if (!grantReceiver) {
      return {
        status: 404,
        message: `No authorized user found to handle ${data.type} requests`
      };
    }

    data.requestDate = new Date()
    // Create the new grant access entry
    const grantEntry = {
      purpose: data.type,
      data: data,
      granted: false,
      requestDate: new Date(),
      status: 'pending'
    };

    // Add the grant entry to get the request ID
    grantReceiver.grantAccess.push(grantEntry);
    await grantReceiver.save();

    return {
      status: 200,
      message: `Permission request for ${data.type} has been submitted successfully`,
      data: {
        submittedAt: new Date(),
      }
    };
  } catch (error) {
    console.error('Error in grantPermission:', error);
    return {
      status: 500,
      message: 'Internal server error',
      error: error.message
    };
  }
};

const addComplaints = async (regNo, userUniqueCode, data, uploadedFiles = null) => {
  try {
    const operator = await Mechanic.findOne({ uniqueCode: userUniqueCode });

    if (!operator) {
      // Clean up uploaded files if mechanic not found
      if (uploadedFiles && uploadedFiles.length > 0) {
        cleanupFiles(uploadedFiles);
      }
      return {
        status: 404,
        message: 'Mechanic not found'
      };
    }

    let grantReceiver;

    grantReceiver = await User.findOne({ uniqueCode: process.env.OVERTIME_AUTHORISE_CODE });

    if (!grantReceiver) {
      // Clean up uploaded files if no grant receiver found
      if (uploadedFiles && uploadedFiles.length > 0) {
        cleanupFiles(uploadedFiles);
      }
      return {
        status: 404,
        message: `No authorized user found to handle complaint requests`
      };
    }

    // Create the new grant access entry
    const grantEntry = {
      purpose: purpose,
      data: {
        ...data,
        mechanicId: mechanicId,
        mechanicName: mechanic.name,
        mechanicUserId: mechanic.userId,
        requestDate: new Date()
      },
      granted: false,
      requestDate: new Date(),
      status: 'pending'
    };

    // Add the grant entry to get the request ID
    grantReceiver.grantAccess.push(grantEntry);
    await grantReceiver.save();

    // Get the newly created request ID
    const newRequestId = grantReceiver.grantAccess[grantReceiver.grantAccess.length - 1]._id;

    // Rename files with proper naming convention if files were uploaded
    let finalMediaFiles = [];
    if (uploadedFiles && uploadedFiles.length > 0) {
      try {
        const renamedFiles = await renameFilesWithRequestId(uploadedFiles, mechanicId, newRequestId);

        // Process the renamed files
        finalMediaFiles = renamedFiles.map(file => ({
          fileName: file.filename,
          originalName: file.originalname,
          filePath: file.path,
          fileSize: file.size,
          mimeType: file.mimetype,
          fieldName: file.fieldname,
          uploadDate: new Date(),
          type: getFileType(file.mimetype),
          url: file.url || `/uploads/overtime/${file.filename}`
        }));

        // Update the grant entry with the properly named files
        const updatedGrantEntry = grantReceiver.grantAccess[grantReceiver.grantAccess.length - 1];
        updatedGrantEntry.data.mediaFiles = finalMediaFiles;
        updatedGrantEntry.data.totalFiles = finalMediaFiles.length;

        await grantReceiver.save();

      } catch (error) {
        console.error('Error renaming files:', error);
        // If renaming fails, clean up the original files and remove the grant entry
        cleanupFiles(uploadedFiles);
        grantReceiver.grantAccess.pop();
        await grantReceiver.save();

        return {
          status: 500,
          message: 'Error processing uploaded files',
          error: error.message
        };
      }
    }

    return {
      status: 200,
      message: `Permission request for ${purpose} has been submitted successfully`,
      data: {
        requestId: newRequestId,
        mechanicName: mechanic.name,
        mechanicUserId: mechanic.userId,
        submittedAt: new Date(),
        mediaFilesUploaded: finalMediaFiles.length,
        mediaFiles: finalMediaFiles.map(f => ({
          fileName: f.fileName,
          type: f.type,
          size: f.fileSize
        }))
      }
    };
  } catch (error) {
    console.error('Error in grantPermission:', error);

    // Clean up uploaded files if there's an error
    if (uploadedFiles && uploadedFiles.length > 0) {
      cleanupFiles(uploadedFiles);
    }

    return {
      status: 500,
      message: 'Internal server error',
      error: error.message
    };
  }
};


const grantAccept = async (uniqueCode, dataId, purpose) => {
  try {
    if (uniqueCode === process.env.WORKSHOP_MANAGER) {
      uniqueCode = process.env.MAINTENANCE_HEAD;
    }

    const user = await User.findOne({ uniqueCode });

    if (!user) {
      return {
        status: 404,
        message: 'User not found'
      };
    }

    const grantIndex = user.grantAccess.findIndex(grant =>
      grant._id.toString() === dataId && grant.purpose === purpose
    );

    if (grantIndex === -1) {
      return {
        status: 404,
        message: 'Grant access data not found'
      };
    }

    const grantData = user.grantAccess[grantIndex];
    const mechanicId = grantData.data.mechanicId;
    const dataToSend = grantData.data;

    user.grantAccess[grantIndex].granted = true;
    await user.save();

    try {
      const response = await mechanicServices.addOvertime(mechanicId, dataToSend);

      if (!response || response.status !== 201) {
        throw new Error(response.message || 'Failed to store data permanently');
      }

      try {
        const updatedUser = await User.findOne({ uniqueCode });
        if (updatedUser) {
          updatedUser.grantAccess.splice(grantIndex, 1);
          await updatedUser.save();
        }
      } catch (error) {
        console.error('Error removing grant access data:', error);
      }

      try {
        const PushNotificationService = require('../utils/push-notification-jobs');
        const mechanic = await Mechanic.findById(mechanicId);

        let notificationMessage;
        const formattedDate = formatDate(dataToSend.date);

        if (dataToSend.times && dataToSend.times[0] && dataToSend.times[0].in && dataToSend.times[0].out) {
          const inTime = convertToAMPM(dataToSend.times[0].in);
          const outTime = convertToAMPM(dataToSend.times[0].out);
          notificationMessage = `Hamsa is accepted overtime of ${mechanic.name} from ${inTime} to ${outTime} for ${formattedDate}`;
        } else {
          notificationMessage = `Hamsa is accepted overtime of ${mechanic.name} has submitted an overtime request for ${formattedDate}`;
        }

        const notification = await createNotification({
          title: "Mechanic overtime request",
          description: notificationMessage,
          priority: "high",
          type: 'normal'
        });

        await PushNotificationService.sendGeneralNotification(
          null,
          "Mechanic overtime accepted",
          notificationMessage,
          'high',
          'normal',
          notification.data._id.toString()
        );
      } catch (notificationError) {
        console.error('Error sending push notification:', notificationError);
      }

      return {
        status: 200,
        message: 'Grant access request approved successfully',
        data: response.data
      };
    } catch (error) {
      console.error('Error calling the API:', error);
      return {
        status: 500,
        message: 'Failed to process the grant request with the external system',
        error: error.message
      };
    }
  } catch (error) {
    console.error('Error in grantAccept:', error);
    return {
      status: 500,
      message: 'Internal server error',
      error: error.message
    };
  }
};


const fetchAccessData = async (uniqueCode, purpose) => {
  try {
    if (uniqueCode === process.env.WORKSHOP_MANAGER) {
      uniqueCode = process.env.MAINTENANCE_HEAD
    }

    const user = await User.findOne({ uniqueCode });

    if (!user) {
      return {
        status: 404,
        message: 'User not found',
        data: null
      };
    }

    let grantAccessData = user.grantAccess || [];

    // Filter data by purpose if purpose parameter is provided
    if (purpose) {
      grantAccessData = grantAccessData.filter(item => item.purpose === purpose);
    }
    return {
      status: 200,
      message: 'Grant access data fetched successfully',
      data: grantAccessData
    };

  } catch (error) {
    console.error('Error fetching access data:', error);
    throw error;
  }
};

const pushSpecialNotification = async (uniqueCode, stockCount, stockId, message) => {
  try {
    const user = await User.findOne({ uniqueCode });

    if (!user) {
      return {
        status: 404,
        message: 'User not found',
        data: null
      };
    }

    let description = {
      message: message,
      stockCount: stockCount,
      status: 'low_stock'
    }

    // Create notification object with current date
    const notification = {
      title: 'Low stock',
      description: description,
      time: new Date(), // Store actual Date object
      priority: 'high',
      stockId: stockId
    };

    // Check if notification with same stockId already exists
    const existingNotificationIndex = user.specialNotification.findIndex(
      notif => notif.stockId.toString() === stockId.toString()
    );

    if (existingNotificationIndex !== -1) {
      // Update existing notification
      user.specialNotification[existingNotificationIndex] = notification;
    } else {
      // Add new notification to user's specialNotification array
      user.specialNotification.push(notification);
    }

    // Update the updatedAt field
    user.updatedAt = new Date();

    // Save the user
    await user.save();

    return {
      status: 200,
      message: existingNotificationIndex !== -1
        ? 'Special notification updated successfully'
        : 'Special notification added successfully',
      data: {
        notification: notification,
        totalNotifications: user.specialNotification.length,
        isUpdate: existingNotificationIndex !== -1
      }
    };

  } catch (error) {
    console.error('Error adding/updating special notification:', error);
    return {
      status: 500,
      message: 'Error adding/updating special notification',
      data: null
    };
  }
};

const fetchSpecialNotification = async (uniqueCode) => {
  try {
    const user = await User.aggregate([
      {
        $match: { uniqueCode: uniqueCode }
      },
      {
        $lookup: {
          from: 'stocks', // Collection name for Stock model (usually lowercase and plural)
          localField: 'specialNotification.stockId',
          foreignField: '_id',
          as: 'stockData'
        }
      },
      {
        $project: {
          _id: 1,
          name: 1,
          email: 1,
          uniqueCode: 1,
          specialNotification: 1,
          stockData: 1
        }
      }
    ]);

    if (!user || user.length === 0) {
      return {
        status: 404,
        message: 'User not found',
        data: null
      };
    }

    const userData = user[0];

    // Map notifications with corresponding stock data
    const notificationsWithStockData = userData.specialNotification.map(notification => {
      const stockInfo = userData.stockData.find(stock =>
        stock._id.toString() === notification.stockId.toString()
      );

      return {
        ...notification,
        stockInfo: stockInfo || null
      };
    });

    return {
      status: 200,
      message: 'Special notifications fetched successfully',
      data: {
        user: {
          _id: userData._id,
          name: userData.name,
          email: userData.email,
          uniqueCode: userData.uniqueCode
        },
        notifications: notificationsWithStockData,
        totalNotifications: notificationsWithStockData.length
      }
    };

  } catch (error) {
    console.error('Error fetching push notifications:', error);
    return {
      status: 500,
      message: 'Error fetching push notifications',
      data: null
    };
  }
};

const deleteNotification = async (notificationId) => {
  try {
    // Validate if the provided ID is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      return {
        status: 400,
        success: false,
        message: 'Invalid notification ID format'
      };
    }

    // Find the user that contains the notification and remove it
    const result = await User.updateOne(
      { 'specialnotification.data._id.toString()': notificationId },
      {
        $pull: {
          specialNotification: { _id: notificationId }
        }
      }
    );

    // Check if any document was modified
    if (result.modifiedCount === 0) {
      return {
        status: 404,
        success: false,
        message: 'Notification not found'
      };
    }

    return {
      status: 200,
      success: true,
      message: 'Notification deleted successfully'
    };

  } catch (error) {
    console.error('Error deleting notification:', error);
    return {
      status: 500,
      success: false,
      message: 'Internal server error',
      error: error.message
    };
  }
};

// real time push notifications <<<<<<<<<<<<<< --------------------------------------- >>>>>>>>>>>>>>>>>>>>>>>>
const insertPushToken = async (uniqueCode, pushToken, platform = null) => {
  try {

    // Convert to string if it's not already
    const tokenString = String(pushToken || '');

    console.log("pushToken", tokenString);
    console.log("pushToken type:", typeof tokenString);
    console.log("pushToken length:", tokenString.length);

    // Validate FCM token format (basic check)
    if (!tokenString || tokenString.length < 100) {
      return {
        success: false,
        message: 'Invalid push token format'
      };
    }

    let user
    // Find user by unique code
    user = await User.findOne({ uniqueCode });

    if (!user) {
      user = await Operator.findOne({ uniqueCode });
    }

    if (!user) {
      user = await Mechanic.findOne({ uniqueCode });
    }

    if (!user) {
      return {
        success: false,
        message: 'User not found'
      };
    }

    // Initialize pushTokens array if it doesn't exist
    if (!user.pushTokens) {
      user.pushTokens = [];
    }

    // Check if token already exists
    const existingTokenIndex = user.pushTokens.findIndex(
      tokenData => tokenData.token === pushToken
    );

    if (existingTokenIndex !== -1) {
      // Update existing token data
      user.pushTokens[existingTokenIndex] = {
        token: pushToken,
        platform: platform || user.pushTokens[existingTokenIndex].platform,
        registeredAt: new Date(),
        isActive: true
      };
    } else {
      // Add new token
      user.pushTokens.push({
        token: pushToken,
        platform: platform,
        registeredAt: new Date(),
        isActive: true
      });
    }

    // default for operator 
    user.profilePic = {}

    // Update the user
    user.updatedAt = new Date();
    await user.save();

    return {
      success: true,
      message: 'Push token registered successfully',
      data: {
        uniqueCode: user.uniqueCode,
        tokenCount: user.pushTokens.length,
        platform: platform
      }
    };

  } catch (error) {
    console.error('❌ Error registering push token:', error);
    return {
      success: false,
      message: 'Failed to register push token',
      error: error.message
    };
  }
};

const removePushToken = async (uniqueCode, pushToken) => {
  try {

    let user
    // Find user by unique code
    user = await User.findOne({ uniqueCode });

    if (!user) {
      user = await Operator.findOne({ uniqueCode });
    }

    if (!user) {
      user = await Mechanic.findOne({ uniqueCode });
    }

    if (!user) {
      return {
        success: false,
        message: 'User not found'
      };
    }

    if (!user.pushTokens || user.pushTokens.length === 0) {
      return {
        success: false,
        message: 'No push tokens found for this user'
      };
    }

    // Remove the specific token
    const initialLength = user.pushTokens.length;
    user.pushTokens = user.pushTokens.filter(
      tokenData => tokenData.token !== pushToken
    );

    if (user.pushTokens.length === initialLength) {
      return {
        success: false,
        message: 'Push token not found'
      };
    }

    // Update the user
    user.updatedAt = new Date();
    await user.save();

    return {
      success: true,
      message: 'Push token removed successfully'
    };

  } catch (error) {
    console.error('❌ Error removing push token:', error);
    return {
      success: false,
      message: 'Failed to remove push token',
      error: error.message
    };
  }
};

const getUserPushTokens = async (uniqueCode) => {
  try {
    // Find user by unique code
    const user = await User.findOne({ uniqueCode }).select('uniqueCode name pushTokens');

    if (!user) {
      return {
        success: false,
        message: 'User not found'
      };
    }

    return {
      success: true,
      data: {
        uniqueCode: user.uniqueCode,
        name: user.name,
        pushTokens: user.pushTokens || [],
        tokenCount: user.pushTokens ? user.pushTokens.length : 0
      }
    };

  } catch (error) {
    console.error('❌ Error getting push tokens:', error);
    return {
      success: false,
      message: 'Failed to get push tokens',
      error: error.message
    };
  }
};

const sendNotificationToUser = async (uniqueCode, notificationData) => {
  try {
    // Find user with push tokens
    let user = await User.findOne({ uniqueCode }).select('uniqueCode name pushTokens');

    if (!user) {
      user = await Operator.findOne({ uniqueCode }).select('uniqueCode name pushTokens');
    }

    if (!user) {
      user = await Mechanic.findOne({ uniqueCode }).select('uniqueCode name pushTokens');
    }

    if (!user) {
      return {
        success: false,
        message: 'User not found'
      };
    }

    if (!user.pushTokens || user.pushTokens.length === 0) {
      console.log('❌ No push tokens array');
      return {
        success: false,
        message: 'No push tokens found for this user'
      };
    }

    // Get active FCM tokens
    const activeTokens = user.pushTokens
      .filter(tokenData => tokenData.isActive && tokenData.token)
      .map(tokenData => tokenData.token);

    if (activeTokens.length === 0) {
      console.log('❌ No active tokens after filtering');
      return {
        success: false,
        message: 'No valid push tokens found for this user'
      };
    }
    // ✅ USE NOTIFICATION OBJECT INSTEAD OF DATA (for iOS)
    const message = {
      notification: {
        title: String(notificationData.title || 'New Notification'),
        body: String(notificationData.description || notificationData.message || '')
      },
      data: {
        notificationId: String(notificationData.notificationId || notificationData._id?.toString() || ''),
        type: String(notificationData.type || 'normal'),
        priority: String(notificationData.priority || 'medium')
      },
      apns: {
        headers: {
          'apns-priority': '10'
        },
        payload: {
          aps: {
            alert: {
              title: String(notificationData.title || 'New Notification'),
              body: String(notificationData.description || notificationData.message || '')
            },
            sound: 'default'
          }
        }
      },
      android: {
        priority: 'high',
        notification: {
          title: String(notificationData.title || 'New Notification'),
          body: String(notificationData.description || notificationData.message || ''),
          sound: 'default'
        }
      }
    };

    if (notificationData.type === 'call') {
      message.data.callAction = 'incoming';
      message.data.callerId = String(notificationData.callerId || '');
      message.data.callerName = String(notificationData.callerName || '');
      message.android.priority = 'max'; // Maximum priority for calls
      message.apns.headers['apns-priority'] = '10';
      message.apns.payload.aps['content-available'] = 1; // Wake iOS
    }

    const results = await Promise.allSettled(
      activeTokens.map((token, index) => {
        return admin.messaging().send({ ...message, token });
      })
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        // console.error(`❌ Token ${index + 1} failed:`);
      } else {
      }
    });

    return {
      success: successful > 0,
      message: `Sent: ${successful} successful, ${failed} failed`,
      data: {
        successful,
        failed,
        total: activeTokens.length
      }
    };

  } catch (error) {
    console.error('❌ ERROR:', error);
    return {
      success: false,
      message: 'Failed to send notification',
      error: error.message
    };
  }
};

// 🆕 NEW FUNCTION - Send silent push for iOS network reconnection
const sendNetworkReconnectPush = async (uniqueCode) => {
  try {
    // Find user
    let user = await User.findOne({ uniqueCode }).select('uniqueCode pushTokens');
    if (!user) {
      user = await Operator.findOne({ uniqueCode }).select('uniqueCode pushTokens');
    }
    if (!user) {
      user = await Mechanic.findOne({ uniqueCode }).select('uniqueCode pushTokens');
    }
    if (!user) {
      return { success: false, message: 'User not found' };
    }

    // Get only iOS tokens (you need to store platform in pushTokens)
    const iosTokens = user.pushTokens
      .filter(tokenData => tokenData.isActive && tokenData.platform === 'ios')
      .map(tokenData => tokenData.token);

    if (iosTokens.length === 0) {
      return { success: false, message: 'No iOS tokens' };
    }

    // Silent push message (iOS only)
    const silentMessage = {
      data: {
        type: 'network-reconnect',
        action: 'sync',
        timestamp: Date.now().toString()
      },
      apns: {
        headers: {
          'apns-push-type': 'background',
          'apns-priority': '5',
        },
        payload: {
          aps: {
            'content-available': 1
          }
        }
      }
    };

    // Send to iOS tokens only
    await Promise.allSettled(
      iosTokens.map(token => admin.messaging().send({ ...silentMessage, token }))
    );

    console.log(`✅ Sent network reconnect push to ${iosTokens.length} iOS devices`);
    return { success: true };
  } catch (error) {
    console.error('❌ Silent push error:', error);
    return { success: false, error: error.message };
  }
};

const sendBulkNotifications = async (uniqueCodes, notificationData) => {
  try {
    const superAdminCode = process.env.SUPER_ADMIN;

    let user = await User.findOne({ uniqueCode: superAdminCode }).select('uniqueCode name pushTokens');
    if (!user) user = await Operator.findOne({ uniqueCode: superAdminCode }).select('uniqueCode name pushTokens');
    if (!user) user = await Mechanic.findOne({ uniqueCode: superAdminCode }).select('uniqueCode name pushTokens');

    if (!user || !user.pushTokens || user.pushTokens.length === 0) {
      return { success: false, message: 'No tokens found' };
    }

    const activeTokens = user.pushTokens
      .filter(t => t.isActive && t.token && t.token.length > 100)
      .map(t => t.token);

    if (activeTokens.length === 0) {
      return { success: false, message: 'No valid tokens' };
    }

    // ✅ USE NOTIFICATION OBJECT INSTEAD OF DATA (for iOS)
    const message = {
      notification: {
        title: String(notificationData.title || 'Test'),
        body: String(notificationData.description || notificationData.message || 'Test')
      },
      apns: {
        headers: {
          'apns-priority': '10'
        },
        payload: {
          aps: {
            alert: {
              title: String(notificationData.title || 'Test'),
              body: String(notificationData.description || notificationData.message || 'Test')
            },
            sound: 'default'
          }
        }
      },
      android: {
        priority: 'high',
        notification: {
          title: String(notificationData.title || 'Test'),
          body: String(notificationData.description || notificationData.message || 'Test'),
          sound: 'default'
        }
      }
    };

    console.log('📨 Sending notification...');

    const results = await Promise.allSettled(
      activeTokens.map(token => admin.messaging().send({ ...message, token }))
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log(`✅ ${successful} sent, ${failed} failed`);

    return {
      success: successful > 0,
      data: { successful, failed, total: activeTokens.length }
    };

  } catch (error) {
    console.error('❌ Error:', error);
    return { success: false, error: error.message };
  }
};

const getAuthSignKey = async (password) => {
  const response = await verifyDocAuthUserCreds(password)
  console.log("response", response);

  try {
    if (response.status !== 200) {
      return {
        status: 500,
        message: 'Failed to fetch doc sign key',
        error: response.message
      }
    }

    return {
      status: 200,
      data: {
        sign_key: process.env.DOC_SIGN_KEY,
      }
    };
  } catch (error) {
    console.error('Error fetching doc sign key:', error);
    throw {
      status: 500,
      message: 'Failed to fetch doc sign key',
      error: error.message
    };
  }
};

// Ensure key is exactly 32 bytes
const getEncryptionKey = () => {
  if (!ENCRYPTION_KEY) {
    throw new Error('DEVICE_ENCRYPTION_KEY is not set');
  }

  // If the key is hex, convert it to buffer
  if (/^[0-9a-fA-F]{64}$/.test(ENCRYPTION_KEY)) {
    return Buffer.from(ENCRYPTION_KEY, 'hex');
  }

  // Otherwise, use it as-is but ensure it's 32 bytes
  const key = Buffer.from(ENCRYPTION_KEY, 'utf8');
  if (key.length !== 32) {
    throw new Error('Encryption key must be 32 bytes (64 hex characters or 32 UTF-8 characters)');
  }
  return key;
};

// Encrypt device data
const encryptDeviceData = (data) => {
  try {
    if (!data) {
      throw new Error('Data to encrypt cannot be empty');
    }

    const iv = crypto.randomBytes(16);
    const keyBuffer = getEncryptionKey();
    const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);

    // Ensure data is a string and trim whitespace
    const dataString = String(data).trim();

    let encrypted = cipher.update(dataString, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return {
      encryptedData: encrypted,
      iv: iv.toString('hex')
    };
  } catch (error) {
    console.error('Encryption error:', error.message);
    throw error;
  }
};

// Decrypt and verify device data
const decryptAndVerifyDeviceData = (encryptedData, iv, originalData) => {
  try {
    if (!encryptedData || !iv || !originalData) {
      console.log('Missing required parameters for decryption');
      return false;
    }

    const keyBuffer = getEncryptionKey();
    const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, Buffer.from(iv, 'hex'));

    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    // Ensure both strings are trimmed before comparison
    const decryptedTrimmed = decrypted.trim();
    const originalTrimmed = String(originalData).trim();

    const isMatch = decryptedTrimmed === originalTrimmed;

    // Debug logging (remove in production)
    if (!isMatch) {
      console.log('Decryption mismatch:', {
        decryptedLength: decryptedTrimmed.length,
        originalLength: originalTrimmed.length,
        decryptedFirst20: decryptedTrimmed.substring(0, 20),
        originalFirst20: originalTrimmed.substring(0, 20)
      });
    }

    return isMatch;
  } catch (error) {
    console.error('Decryption error:', error.message);
    return false;
  }
};

// Activate signature with device trust
const activateSignatureAccess = async (userId, activationKey, signType, deviceInfo) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw { status: 404, message: 'User not found' };
    }

    // Find or create signature activation record
    let signActivation = user.signatureActivation.find(s => s.signType === signType);

    if (!signActivation) {
      throw { status: 404, message: 'Signature type not configured for this user' };
    }

    // Verify activation key
    const isKeyValid = await bcrypt.compare(activationKey, signActivation.activationKey);
    if (!isKeyValid) {
      throw { status: 401, message: 'Invalid activation key' };
    }

    // Encrypt each device field separately with validation
    if (!deviceInfo.deviceFingerprint || !deviceInfo.ipAddress || !deviceInfo.location ||
      !deviceInfo.userAgent || !deviceInfo.browserInfo) {
      throw { status: 400, message: 'Incomplete device information' };
    }

    const encryptedUniqueCode = encryptDeviceData(deviceInfo.deviceFingerprint);
    const encryptedIpAddress = encryptDeviceData(deviceInfo.ipAddress);
    const encryptedLocation = encryptDeviceData(deviceInfo.location);
    const encryptedUserAgent = encryptDeviceData(deviceInfo.userAgent);
    const encryptedBrowserInfo = encryptDeviceData(deviceInfo.browserInfo);

    // Check if device already exists
    const existingDeviceIndex = signActivation.trustedDevices.findIndex(d => {
      if (!d.isActive) return false;

      return decryptAndVerifyDeviceData(d.uniqueCode, d.uniqueCodeIv, deviceInfo.deviceFingerprint) &&
        decryptAndVerifyDeviceData(d.ipAddress, d.ipAddressIv, deviceInfo.ipAddress) &&
        decryptAndVerifyDeviceData(d.userAgent, d.userAgentIv, deviceInfo.userAgent) &&
        decryptAndVerifyDeviceData(d.browserInfo, d.browserInfoIv, deviceInfo.browserInfo) &&
        decryptAndVerifyDeviceData(d.location, d.locationIv, deviceInfo.location);
    });

    if (existingDeviceIndex !== -1) {
      // Update existing device
      signActivation.trustedDevices[existingDeviceIndex].lastUsed = new Date();
      signActivation.trustedDevices[existingDeviceIndex].isActive = true;
    } else {
      // Add new trusted device
      const deviceRecord = {
        uniqueCode: encryptedUniqueCode.encryptedData,
        uniqueCodeIv: encryptedUniqueCode.iv,
        ipAddress: encryptedIpAddress.encryptedData,
        ipAddressIv: encryptedIpAddress.iv,
        location: encryptedLocation.encryptedData,
        locationIv: encryptedLocation.iv,
        userAgent: encryptedUserAgent.encryptedData,
        userAgentIv: encryptedUserAgent.iv,
        browserInfo: encryptedBrowserInfo.encryptedData,
        browserInfoIv: encryptedBrowserInfo.iv,
        activatedAt: new Date(),
        lastUsed: new Date(),
        isActive: true
      };

      signActivation.trustedDevices.push(deviceRecord);
    }

    signActivation.isActivated = true;
    signActivation.activatedAt = new Date();
    signActivation.activatedBy = userId;

    await user.save();

    return {
      status: 200,
      message: 'Signature activated successfully',
      data: {
        signType,
        deviceTrusted: true
      }
    };
  } catch (error) {
    console.error('Activation error:', error);
    throw error;
  }
};

// Verify trusted device
const verifyTrustedDevice = async (userId, signType, deviceInfo) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw { status: 404, message: 'User not found' };
    }

    const signActivation = user.signatureActivation.find(s => s.signType === signType);

    if (!signActivation || !signActivation.isActivated) {
      return {
        status: 200,
        data: {
          isActivated: false,
          isTrusted: false
        }
      };
    }

    // Validate device info
    if (!deviceInfo.deviceFingerprint || !deviceInfo.ipAddress || !deviceInfo.location ||
      !deviceInfo.userAgent || !deviceInfo.browserInfo) {
      console.log('Incomplete device information provided');
      throw { status: 400, message: 'Incomplete device information' };
    }

    // Check if device is trusted
    const trustedDevice = signActivation.trustedDevices.find(d => {
      if (!d.isActive) return false;

      const isUniqueCodeValid = decryptAndVerifyDeviceData(d.uniqueCode, d.uniqueCodeIv, deviceInfo.deviceFingerprint);
      const isIpAddressValid = decryptAndVerifyDeviceData(d.ipAddress, d.ipAddressIv, deviceInfo.ipAddress);
      const isUserAgentValid = decryptAndVerifyDeviceData(d.userAgent, d.userAgentIv, deviceInfo.userAgent);
      const isBrowserInfoValid = decryptAndVerifyDeviceData(d.browserInfo, d.browserInfoIv, deviceInfo.browserInfo);
      const isLocationValid = decryptAndVerifyDeviceData(d.location, d.locationIv, deviceInfo.location);

      return isUniqueCodeValid &&
        isIpAddressValid &&
        isUserAgentValid &&
        isBrowserInfoValid &&
        isLocationValid;
    });

    if (!trustedDevice) {
      return {
        status: 401,
        data: {
          isActivated: false,
          isTrusted: false
        }
      };
    }

    // Update last used timestamp
    trustedDevice.lastUsed = new Date();
    await user.save();

    return {
      status: 200,
      data: {
        isActivated: true,
        isTrusted: true
      }
    };
  } catch (error) {
    console.error('Verification error:', error);
    throw error;
  }
};

// Updated sign key services with device verification
const getPmAuthSignKey = async (userId, deviceInfo) => {
  try {
    const verificationResult = await verifyTrustedDevice(userId, 'pm', deviceInfo);

    if (!verificationResult.data.isTrusted) {
      throw {
        status: 403,
        message: 'Device not trusted. Please activate signature access first.'
      };
    }

    return {
      status: 200,
      data: {
        sign_key: process.env.PM_SIGN_KEY,
        expiresIn: 30 // seconds
      }
    };
  } catch (error) {
    throw error;
  }
};

const getAccountsAuthSignKey = async (userId, deviceInfo) => {
  try {
    const verificationResult = await verifyTrustedDevice(userId, 'accounts', deviceInfo);

    if (!verificationResult.data.isTrusted) {
      throw { status: 403, message: 'Device not trusted' };
    }

    return {
      status: 200,
      data: {
        sign_key: process.env.ACCOUNTS_SIGN_KEY,
        expiresIn: 30
      }
    };
  } catch (error) {
    throw error;
  }
};

const getManagerAuthSignKey = async (userId, deviceInfo) => {
  try {
    const verificationResult = await verifyTrustedDevice(userId, 'manager', deviceInfo);

    if (!verificationResult.data.isTrusted) {
      throw { status: 403, message: 'Device not trusted' };
    }

    return {
      status: 200,
      data: {
        sign_key: process.env.MANAGER_SIGN_KEY,
        expiresIn: 30
      }
    };
  } catch (error) {
    throw error;
  }
};

const getAuthorizedAuthSignKey = async (userId, deviceInfo) => {
  try {
    const verificationResult = await verifyTrustedDevice(userId, 'authorized', deviceInfo);

    if (!verificationResult.data.isTrusted) {
      throw { status: 403, message: 'Device not trusted' };
    }

    return {
      status: 200,
      data: {
        sign_key: process.env.AUTHORIZED_SIGN_KEY,
        expiresIn: 30
      }
    };
  } catch (error) {
    throw error;
  }
};

const getAuthSealKey = async (userId, deviceInfo) => {
  try {
    const verificationResult = await verifyTrustedDevice(userId, 'seal', deviceInfo);

    if (!verificationResult.data.isTrusted) {
      throw { status: 403, message: 'Device not trusted' };
    }

    return {
      status: 200,
      data: {
        sign_key: process.env.SEAL_KEY,
        expiresIn: 30
      }
    };
  } catch (error) {
    throw error;
  }
};

const cleanupInvalidTokens = async (uniqueCode = null) => {
  try {
    const query = uniqueCode ? { uniqueCode } : {};
    const users = await User.find(query);

    let totalCleaned = 0;

    for (const user of users) {
      if (user.pushTokens && user.pushTokens.length > 0) {
        const initialLength = user.pushTokens.length;

        // Remove invalid tokens (basic validation for FCM)
        user.pushTokens = user.pushTokens.filter(tokenData =>
          tokenData.token && typeof tokenData.token === 'string' && tokenData.token.length > 100
        );

        const cleaned = initialLength - user.pushTokens.length;

        if (cleaned > 0) {
          user.updatedAt = new Date();
          await user.save();
          totalCleaned += cleaned;
        }
      }
    }

    return {
      success: true,
      message: `Cleaned up ${totalCleaned} invalid tokens`,
      data: { cleaned: totalCleaned }
    };

  } catch (error) {
    console.error('❌ Error cleaning up tokens:', error);
    return {
      success: false,
      message: 'Failed to cleanup tokens',
      error: error.message
    };
  }
};

const cleanupFiles = (files) => {
  if (!files || !Array.isArray(files)) return;

  const fs = require('fs');
  files.forEach(file => {
    try {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    } catch (error) {
      console.error(`Error cleaning up file ${file.filename}:`, error.message);
    }
  });
};

const getChannelId = (priority) => {
  switch (priority) {
    case 'high':
    case 'urgent':
      return 'urgent';
    case 'low':
      return 'silent';
    default:
      return 'default';
  }
};

// Helper function to determine file type
const getFileType = (mimeType) => {
  if (mimeType.startsWith('image/')) {
    return 'photo';
  } else if (mimeType.startsWith('video/')) {
    return 'video';
  } else if (mimeType.startsWith('audio/')) {
    return 'audio';
  }
  return 'unknown';
};

const formatDate = (isoString) => {
  if (!isoString) return 'Invalid Date';

  const date = new Date(isoString);
  if (isNaN(date.getTime())) return 'Invalid Date';

  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

const convertToAMPM = (isoString) => {
  if (!isoString) return 'Invalid Time';

  const date = new Date(isoString);
  if (isNaN(date.getTime())) return 'Invalid Date';

  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};

// Get all sessions for a user
const getUserSessions = async (userId, currentSessionToken) => {
  try {
    const sessions = await Session.find({
      userId,
      isActive: true
    }).sort({ lastActivity: -1 });

    // Mark current session
    const sessionsWithCurrent = sessions.map(session => ({
      ...session.toObject(),
      isCurrent: session.sessionToken === currentSessionToken
    }));

    return {
      status: 200,
      success: true,
      message: 'Sessions retrieved successfully',
      data: {
        sessions: sessionsWithCurrent,
        total: sessions.length
      }
    };
  } catch (error) {
    return {
      status: 500,
      success: false,
      message: 'Failed to retrieve sessions',
      error: error.message
    };
  }
};

// Logout specific session
const logoutSession = async (sessionId, userId, currentSessionToken) => {
  try {
    const session = await Session.findOne({
      _id: sessionId,
      userId
    });

    if (!session) {
      return {
        status: 404,
        success: false,
        message: 'Session not found'
      };
    }

    // Prevent logging out current session
    if (session.sessionToken === currentSessionToken) {
      return {
        status: 400,
        success: false,
        message: 'Cannot logout current session. Use logout instead.'
      };
    }

    // Deactivate session
    session.isActive = false;
    await session.save();

    const userToLogout = await User.findById(userId);
    if (userToLogout) {
      const websocket = await import('../utils/websocket.js');
      websocket.default.forceLogoutUser(userToLogout.uniqueCode, userToLogout._id, session.sessionToken, 'Logged out from another device');
    }
    return {
      status: 200,
      success: true,
      message: 'Session logged out successfully'
    };
  } catch (error) {
    return {
      status: 500,
      success: false,
      message: 'Failed to logout session',
      error: error.message
    };
  }
};

// Block device
const blockDevice = async (sessionId, userId) => {
  try {
    const session = await Session.findOne({
      _id: sessionId,
      userId
    });

    if (!session) {
      return {
        status: 404,
        success: false,
        message: 'Session not found'
      };
    }

    // Delete session permanently (blocking)
    await Session.deleteOne({ _id: sessionId });

    const userToBlock = await User.findById(userId);
    if (userToBlock) {
      const websocket = await import('../utils/websocket.js');
      websocket.default.forceLogoutUser(userToBlock.uniqueCode, userToBlock._id, session.sessionToken, 'Device blocked');
    }

    // Optionally: Add device ID to blocked devices list in User model
    // This would prevent this device from logging in again

    return {
      status: 200,
      success: true,
      message: 'Device blocked successfully'
    };
  } catch (error) {
    return {
      status: 500,
      success: false,
      message: 'Failed to block device',
      error: error.message
    };
  }
};

// Logout all other sessions
const logoutAllSessions = async (userId, currentSessionToken) => {
  try {
    const result = await Session.updateMany(
      {
        userId,
        sessionToken: { $ne: currentSessionToken },
        isActive: true
      },
      {
        $set: { isActive: false }
      }
    );

    const userToLogout = await User.findById(userId);
    if (userToLogout) {
      const websocket = await import('../utils/websocket.js');
      websocket.default.forceLogoutUser(userToLogout.uniqueCode, userToLogout._id, result.sessionToken, 'Logged out from all devices');
    }

    return {
      status: 200,
      success: true,
      message: 'All other sessions logged out successfully',
      data: {
        loggedOutCount: result.modifiedCount
      }
    };
  } catch (error) {
    return {
      status: 500,
      success: false,
      message: 'Failed to logout all sessions',
      error: error.message
    };
  }
};

// Check if session is logged out or blocked
const checkSessionStatus = async (sessionId, userId) => {
  try {
    const session = await Session.findOne({
      sessionToken: sessionId,
      userId
    });

    // Session doesn't exist - it was blocked/deleted
    if (!session) {
      return {
        status: 401,
        success: false,
        sessionStatus: 'blocked',
        message: 'Session was blocked from another device',
        action: 'redirect_to_login' // Suggest action for frontend
      };
    }

    // Session exists but is inactive - it was logged out
    if (!session.isActive) {
      return {
        status: 401,
        success: false,
        sessionStatus: 'logged_out',
        message: 'Session was logged out from another device',
        action: 'redirect_to_login'
      };
    }

    // Session is active and valid
    return {
      status: 200,
      success: true,
      sessionStatus: 'active',
      message: 'Session is active',
      action: 'continue_to_work',
      session: {
        id: session._id,
        deviceInfo: session.deviceInfo,
        lastActivity: session.lastActivity
      }
    };

  } catch (error) {
    return {
      status: 500,
      success: false,
      message: 'Failed to check session status',
      error: error.message
    };
  }
};

const generateBiometricToken = async (uniqueCode, deviceInfo) => {
  try {
    const user = await User.findOne({ uniqueCode });

    if (!user) {
      return {
        success: false,
        message: 'User not found'
      };
    }

    // Generate secure random token
    const biometricToken = crypto.randomBytes(64).toString('hex');

    // Token expires in 90 days
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 90);

    // Check if token exists for this device, update or create new
    const existingTokenIndex = user.biometricTokens.findIndex(
      t => t.deviceInfo.deviceId === deviceInfo.deviceId
    );

    if (existingTokenIndex !== -1) {
      // Update existing token
      user.biometricTokens[existingTokenIndex] = {
        token: biometricToken,
        deviceInfo,
        createdAt: new Date(),
        expiresAt,
        isActive: true,
        lastUsed: new Date()
      };
    } else {
      // Add new token
      user.biometricTokens.push({
        token: biometricToken,
        deviceInfo,
        expiresAt,
        isActive: true
      });
    }

    await user.save();

    return {
      success: true,
      data: {
        biometricToken,
        expiresAt,
        expiresIn: '90 days'
      }
    };

  } catch (error) {
    console.error('❌ Error generating biometric token:', error);
    return {
      success: false,
      message: 'Failed to generate biometric token',
      error: error.message
    };
  }
};

const biometricLogin = async (biometricToken, deviceInfo) => {
  try {
    // Find user with matching biometric token
    const user = await User.findOne({
      'biometricTokens.token': biometricToken,
      'biometricTokens.isActive': true
    });

    if (!user) {
      return {
        success: false,
        message: 'Invalid biometric token'
      };
    }

    // Find the specific token
    const tokenData = user.biometricTokens.find(
      t => t.token === biometricToken && t.isActive
    );

    if (!tokenData) {
      return {
        success: false,
        message: 'Token not found or inactive'
      };
    }

    // Check if token expired
    if (new Date() > tokenData.expiresAt) {
      tokenData.isActive = false;
      await user.save();
      return {
        success: false,
        message: 'Biometric token expired. Please login again.'
      };
    }

    // Verify device info matches
    if (tokenData.deviceInfo.deviceId !== deviceInfo.deviceId) {
      return {
        success: false,
        message: 'Device mismatch. Please login again.'
      };
    }

    // Update last used
    tokenData.lastUsed = new Date();
    user.lastLogin = new Date();
    await user.save();

    // Generate auth tokens (same as normal login)
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const auth0token = jwt.sign(
      {
        userId: user._id,
        email: user.email,
        uniqueCode: user.uniqueCode
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const refresh_token = jwt.sign(
      { userId: user._id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '30d' }
    );

    return {
      success: true,
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          userType: user.userType,
          uniqueCode: user.uniqueCode,
          auth0token,
          refresh_token,
          sessionToken
        }
      }
    };

  } catch (error) {
    console.error('❌ Error in biometric login:', error);
    return {
      success: false,
      message: 'Failed to login with biometric',
      error: error.message
    };
  }
};

const revokeBiometricToken = async (uniqueCode, deviceInfo) => {
  try {
    const user = await User.findOne({ uniqueCode });

    if (!user) {
      return {
        success: false,
        message: 'User not found'
      };
    }

    if (deviceInfo && deviceInfo.deviceId) {
      // Revoke specific device token
      const tokenIndex = user.biometricTokens.findIndex(
        t => t.deviceInfo.deviceId === deviceInfo.deviceId
      );

      if (tokenIndex !== -1) {
        user.biometricTokens[tokenIndex].isActive = false;
      }
    } else {
      // Revoke all tokens
      user.biometricTokens.forEach(token => {
        token.isActive = false;
      });
    }

    await user.save();

    return {
      success: true,
      message: 'Biometric token revoked successfully'
    };

  } catch (error) {
    console.error('❌ Error revoking biometric token:', error);
    return {
      success: false,
      message: 'Failed to revoke biometric token',
      error: error.message
    };
  }
};

module.exports = {
  insertUser,
  fetchUsers,
  userUpdate,
  userDelete,
  loginUser,
  verifyToken,
  checkRole,
  verifyUserCredentials,
  updateUserAuthMail,
  grantPermission,
  grantAccept,
  fetchAccessData,
  pushSpecialNotification,
  fetchSpecialNotification,
  deleteNotification,
  verifyCEOcreds,
  requestPermission,

  // Add the missing push notification functions:
  insertPushToken,
  removePushToken,
  getUserPushTokens,
  sendNotificationToUser,
  sendBulkNotifications,
  cleanupInvalidTokens,
  verifyDocAuthUserCreds,
  getAuthSignKey,
  fetchAllUsers,
  getFileType,
  getPmAuthSignKey,
  getAccountsAuthSignKey,
  getManagerAuthSignKey,
  getAuthorizedAuthSignKey,
  getAuthSealKey,
  activateSignatureAccess,
  verifyTrustedDevice,
  changePassword,
  resetPassword,
  sendNetworkReconnectPush,
  getUserSessions,
  logoutSession,
  blockDevice,
  logoutAllSessions,
  checkSessionStatus,
  revokeBiometricToken,
  biometricLogin,
  generateBiometricToken,
  USER_ROLES,
};