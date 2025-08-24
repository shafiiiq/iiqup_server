const User = require('../models/user.model');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const Mechanic = require('../models/mechanic.model');
const Operator = require('../models/operator.model');
const { default: mongoose } = require('mongoose');
const { renameFilesWithRequestId } = require('../multer/overtime-upload'); // Check this file too
const { Expo } = require('expo-server-sdk');
const { createNotification } = require('../utils/notification-jobs');

// Create a new Expo SDK client
const expo = new Expo();

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
  SUB_ACCOUNTANT: 'SUB_ACCOUNTANT'
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

    if (user.email !== 'ceo@ansarigroup.co' && email !== 'ceo@ansarigroup.co') {

      return {
        status: 200,
        success: true,
        message: 'Authentication successful, user is not a ceo',
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

/**
 * Verify user credentials for login
 * @param {string} email - User's email
 * @param {string} password - User's password
 * @returns {Promise} - Promise with the result of the operation
 */
const verifyUserCredentials = async (email, password, type) => {
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

    // Compare passwords
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return {
        status: 401,
        success: false,
        message: 'Invalid email or password'
      };
    }

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
      authMail: user.authMail
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

      await createNotification({
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
        'normal'
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
    // Find the user by uniqueCode
    const user = await User.findOne({ uniqueCode });

    if (!user) {
      return {
        status: 404,
        message: 'User not found'
      };
    }

    // Find the specific grant access entry by dataId and purpose
    const grantIndex = user.grantAccess.findIndex(grant =>
      grant._id.toString() === dataId && grant.purpose === purpose
    );

    if (grantIndex === -1) {
      return {
        status: 404,
        message: 'Grant access data not found'
      };
    }

    // Get the grant access data
    const grantData = user.grantAccess[grantIndex];

    // Extract mechanicId and data from the grant
    const mechanicId = grantData.data.mechanicId;
    const dataToSend = grantData.data;

    // Mark as granted
    user.grantAccess[grantIndex].granted = true;
    await user.save();

    try {
      // Call the API to store the data permanently
      const response = await fetch(`http://localhost:3001/mechanics/${mechanicId}/overtime`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(dataToSend)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to store data permanently');
      }

      // Schedule removal of the grant access data after approving
      try {
        // Find the user again to get the latest data
        const updatedUser = await User.findOne({ uniqueCode });
        if (updatedUser) {
          // Remove the grant access data
          updatedUser.grantAccess.splice(grantIndex, 1);
          await updatedUser.save();
        }
      } catch (error) {
        console.error('Error removing grant access data:', error);
      }

      try {
        const PushNotificationService = require('../utils/push-notification-jobs');

        const mechanic = await Mechanic.findById(mechanicId)

        // Just add this check before using the times
        let notificationMessage;

        const formattedDate = formatDate(dataToSend.date); // "August 10, 2025"

        if (dataToSend.times && dataToSend.times[0].in && dataToSend.times[0].out) {
          const inTime = convertToAMPM(dataToSend.times[0].in);
          const outTime = convertToAMPM(dataToSend.times[0].out);
          notificationMessage = `Hamsa is accepted overtime of ${mechanic.name} from ${inTime} to ${outTime} for ${formattedDate}`;
        } else {
          notificationMessage = `Hamsa is accepted overtime of ${mechanic.name} has submitted an overtime request for ${formattedDate}`;
        }

        await createNotification({
          title: "Mechanic overtime request",
          description: notificationMessage,
          priority: "high",
          type: 'normal'
        });

        await PushNotificationService.sendGeneralNotification(
          null, // broadcast to all users
          "Mechanic overtime accepted", // title
          notificationMessage, // description
          'high', // priority
          'normal' // type
        );
      } catch (notificationError) {
        console.error('Error sending push notification:', notificationError);
        // Don't fail the entire operation if notification fails
      }


      return {
        status: 200,
        message: 'Grant access request approved successfully',
        data: await response.json()
      };
    } catch (error) {
      // If the API call fails, still keep the data as granted but log the error
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
      { 'specialNotification._id': notificationId },
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
    // Validate the push token format
    if (!Expo.isExpoPushToken(pushToken)) {
      return {
        success: false,
        message: 'Invalid push token format'
      };
    }

    // Find user by unique code
    const user = await User.findOne({ uniqueCode });

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
    // Find user by unique code
    const user = await User.findOne({ uniqueCode });

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
    const user = await User.findOne({ uniqueCode }).select('uniqueCode name pushTokens');

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

    // Get active push tokens
    const activeTokens = user.pushTokens
      .filter(tokenData => tokenData.isActive && Expo.isExpoPushToken(tokenData.token))
      .map(tokenData => tokenData.token);

    if (activeTokens.length === 0) {
      return {
        success: false,
        message: 'No valid push tokens found for this user'
      };
    }

    // Prepare messages
    const messages = activeTokens.map(token => ({
      to: token,
      sound: 'default',
      title: notificationData.title || 'New Notification',
      body: notificationData.body || notificationData.message || 'You have a new notification',
      data: notificationData.data || notificationData,
      priority: notificationData.priority === 'high' ? 'high' : 'normal',
      channelId: getChannelId(notificationData.priority)
    }));

    // Send notifications
    const chunks = expo.chunkPushNotifications(messages);
    const tickets = [];

    for (let chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        console.error('❌ Error sending notification chunk:', error);
      }
    }

    // Check for errors in tickets
    const errors = tickets.filter(ticket => ticket.status === 'error');
    console.log("notification err: ", errors);
    
    const successful = tickets.filter(ticket => ticket.status === 'ok');

    if (errors.length > 0) {
      console.warn(`⚠️ ${errors.length} notifications failed for user ${uniqueCode}`);
    }

    return {
      success: true,
      message: 'Notifications sent successfully',
      data: {
        successful: successful.length,
        failed: errors.length,
        total: tickets.length,
        tickets: tickets
      }
    };

  } catch (error) {
    console.error('❌ Error sending notification to user:', error);
    return {
      success: false,
      message: 'Failed to send notification',
      error: error.message
    };
  }
};


const sendBulkNotifications = async (uniqueCodes, notificationData) => {
  try {
    // Find all users with push tokens
    const users = await User.find({
      uniqueCode: { $in: uniqueCodes }
    }).select('uniqueCode name pushTokens');

    if (users.length === 0) {
      return {
        success: false,
        message: 'No users found'
      };
    }

    // Collect all active tokens
    const allTokens = [];
    const userTokenMap = new Map();

    users.forEach(user => {
      if (user.pushTokens && user.pushTokens.length > 0) {
        const activeTokens = user.pushTokens
          .filter(tokenData => tokenData.isActive && Expo.isExpoPushToken(tokenData.token))
          .map(tokenData => tokenData.token);

        if (activeTokens.length > 0) {
          allTokens.push(...activeTokens);
          userTokenMap.set(user.uniqueCode, activeTokens.length);
        }
      }
    });

    if (allTokens.length === 0) {
      return {
        success: false,
        message: 'No valid push tokens found for any users'
      };
    }

    // Prepare messages
    const messages = allTokens.map(token => ({
      to: token,
      sound: 'default',
      title: notificationData.title || 'New Notification',
      body: notificationData.body || notificationData.message || 'You have a new notification',
      data: notificationData.data || notificationData,
      priority: notificationData.priority === 'high' ? 'high' : 'normal',
      channelId: getChannelId(notificationData.priority)
    }));

    // Send notifications in chunks
    const chunks = expo.chunkPushNotifications(messages);
    const tickets = [];

    for (let chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        console.error('❌ Error sending bulk notification chunk:', error);
      }
    }

    const errors = tickets.filter(ticket => ticket.status === 'error');
    const successful = tickets.filter(ticket => ticket.status === 'ok');

    return {
      success: true,
      message: 'Bulk notifications sent successfully',
      data: {
        usersFound: users.length,
        tokensFound: allTokens.length,
        successful: successful.length,
        failed: errors.length,
        total: tickets.length
      }
    };

  } catch (error) {
    console.error('❌ Error sending bulk notifications:', error);
    return {
      success: false,
      message: 'Failed to send bulk notifications',
      error: error.message
    };
  }
};

const getAuthSignKey = async (password) => {
  const response = await verifyDocAuthUserCreds(password)
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

const cleanupInvalidTokens = async (uniqueCode = null) => {
  try {
    const query = uniqueCode ? { uniqueCode } : {};
    const users = await User.find(query);

    let totalCleaned = 0;

    for (const user of users) {
      if (user.pushTokens && user.pushTokens.length > 0) {
        const initialLength = user.pushTokens.length;

        // Remove invalid tokens
        user.pushTokens = user.pushTokens.filter(tokenData =>
          Expo.isExpoPushToken(tokenData.token)
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

  // Also add the helper functions if needed:
  getFileType,

  USER_ROLES,
};