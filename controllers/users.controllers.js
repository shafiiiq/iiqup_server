const userServices = require('../services/user-services')
const path = require('path');
const { putObject } = require('../s3bucket/s3.bucket')
require('dotenv').config();

const addUsers = async (req, res) => {
  userServices.insertUser(req.body)
    .then((addedUser) => {
      if (addedUser) {
        res.status(addedUser.status).json(addedUser)
      }
    })
    .catch((err) => {
      res.status(err.status || 500).json({ error: err.message })
    })
}

const getUsers = async (req, res) => {
  userServices.fetchUsers()
    .then((fetchedUsers) => {
      if (fetchedUsers) {
        res.status(fetchedUsers.status).json(fetchedUsers)
      }
    })
    .catch((err) => {
      res.status(err.status || 500).json({ message: 'Cannot get all users', error: err.message })
    })
}

const getAllUsers = async (req, res) => {
  userServices.fetchAllUsers()
    .then((fetchedUsers) => {
      if (fetchedUsers) {
        res.status(fetchedUsers.status).json(fetchedUsers)
      }
    })
    .catch((err) => {
      res.status(err.status || 500).json({ message: 'Cannot get all users', error: err.message })
    })
}

const updateUser = async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  userServices.userUpdate(id, updateData)
    .then((updatedUser) => {
      if (updatedUser) {
        res.status(updatedUser.status).json(updatedUser)
      }
    })
    .catch((err) => {
      res.status(err.status).json({ error: err.message })
    })
}

const deleteUser = async (req, res) => {
  const { id } = req.params;

  userServices.userDelete(id)
    .then((response) => {
      if (response) {
        res.status(response.status).json(response)
      }
    })
    .catch((err) => {
      res.status(err.status).json({ error: err.message })
    })
}

const verifyCEO = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      message: 'Email is required'
    });
  }

  try {
    const result = await userServices.verifyCEOcreds(email);
    res.status(result.status).json(result);
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: 'Authentication failed',
      error: err.message
    });
  }
}

const verifyUser = async (req, res) => {
  const { email, password, type, deviceInfo } = req.body;
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email and password are required'
    });
  }

  try {
    const result = await userServices.verifyUserCredentials(
      email,
      password,
      type,
      deviceInfo
    );

    res.status(result.status).json(result);
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: 'Authentication failed',
      error: err.message
    });
  }
};

const changePassword = async (req, res) => {
  const { email, currentPassword, newPassword } = req.body;

  // Validation
  if (!email || !currentPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      message: 'Email, current password, and new password are required'
    });
  }

  if (currentPassword == newPassword) {
    return res.status(400).json({
      success: false,
      message: 'New password must be different from current password'
    });
  }

  // Password strength validation
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
  if (!passwordRegex.test(newPassword)) {
    return res.status(400).json({
      success: false,
      message: 'New password does not meet security requirements'
    });
  }

  // Prevent same password
  if (currentPassword === newPassword) {
    return res.status(400).json({
      success: false,
      message: 'New password must be different from current password'
    });
  }

  try {
    const result = await userServices.changePassword(email, currentPassword, newPassword);
    res.status(result.status).json(result);
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: 'Password change failed',
      error: err.message
    });
  }
};

const resetPassword = async (req, res) => {
  const { email, type } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      message: 'Email is required'
    });
  }

  try {
    const result = await userServices.resetPassword(email, type);
    res.status(result.status).json(result);
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: 'Password change failed',
      error: err.message
    });
  }
};


const updateAuthMail = async (req, res) => {
  const { userId, authMail, type } = req.body;

  if (!userId || !authMail) {
    return res.status(400).json({
      success: false,
      message: 'User ID and Authentication email are required'
    });
  }

  try {
    const result = await userServices.updateUserAuthMail(userId, authMail, type);
    res.status(result.status).json(result);
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: 'Failed to update phone number',
      error: err.message
    });
  }
}

const requestGrant = async (req, res) => {
  try {
    const { mechanicId } = req.params;
    let purpose = 'overtime';

    let overtimeData = req.body

    if (purpose === 'overtime') {
      const { date, regNo, times, workDetails, files } = req.body;
      if (!date || !regNo || !times || !workDetails) {
        return res.status(400).json({
          error: 'Missing required fields: date, regNo, times, and workDetails are required'
        });
      }

      if (!Array.isArray(times) || times.length === 0) {
        return res.status(400).json({
          error: 'Times must be a non-empty array'
        });
      }

      for (let i = 0; i < times.length; i++) {
        const time = times[i];
        if (!time.in || !time.out) {
          return res.status(400).json({
            error: `Time entry ${i + 1} is missing 'in' or 'out' time`
          });
        }
      }

      // Generate presigned URLs for each file
      let filesWithUploadData = [];
      if (files && files.length > 0) {
        filesWithUploadData = await Promise.all(
          files.map(async (file) => {
            const ext = path.extname(file.fileName);
            const finalFilename = `${mechanicId}-${Date.now()}${ext}`;
            const s3Key = `overtime/${mechanicId}/${finalFilename}`;

            const uploadUrl = await putObject(
              file.fileName,
              s3Key,
              file.mimeType
            );

            return {
              fileName: finalFilename,
              originalName: file.fileName,
              filePath: s3Key,
              mimeType: file.mimeType,
              type: file.mimeType.startsWith('video/') ? 'video' : 'photo',
              uploadUrl: uploadUrl,
              uploadDate: new Date()
            };
          })
        );
      }

      const tempOvertimeData = {
        ...overtimeData,
        mediaFiles: filesWithUploadData,
        totalFiles: filesWithUploadData.length
      };

      const response = await userServices.grantPermission(mechanicId, purpose, tempOvertimeData);

      if (response) {
        res.status(response.status).json({
          status: response.status,
          message: 'Pre-signed URLs generated',
          data: {
            uploadData: filesWithUploadData
          }
        });
      }
    } else {
      const response = await userServices.grantPermission(mechanicId, purpose, req.body);
      if (response) {
        res.status(response.status).json(response);
      }
    }
  } catch (err) {
    console.error('Error in requestGrant:', err);
    res.status(err.status || 500).json({
      error: err.message || 'Internal server error',
      details: err.details || 'An unexpected error occurred'
    });
  }
};

const requestService = async (req, res) => {
  userServices.requestPermission(req.body)
    .then((response) => {
      if (response) {
        res.status(response.status).json(response)
      }
    })
    .catch((err) => {
      res.status(err.status).json({ error: err.message })
    })
}

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

const grantAccess = async (req, res) => {
  const { uniqueCode, dataId, purpose } = req.body;

  userServices.grantAccept(uniqueCode, dataId, purpose)
    .then((response) => {
      if (response) {
        res.status(response.status).json(response);
      }
    })
    .catch((err) => {
      res.status(err.status || 500).json({ error: err.message });
    });
};

const getGrantAccessData = async (req, res) => {
  userServices.fetchAccessData(req.body.uniqueCode, req.body.purpose)
    .then((fetchedAccessData) => {
      if (fetchedAccessData) {
        res.status(fetchedAccessData.status).json(fetchedAccessData)
      }
    })
    .catch((err) => {
      res.status(err.status || 500).json({ message: 'Cannot get all users', error: err.message })
    })
}

const getSpecialNotification = async (req, res) => {
  userServices.fetchSpecialNotification(req.body.uniqueCode)
    .then((fetchedUsers) => {
      if (fetchedUsers) {
        res.status(fetchedUsers.status).json(fetchedUsers)
      }
    })
    .catch((err) => {
      res.status(err.status || 500).json({ message: 'Cannot get all users', error: err.message })
    })
}

const deleteSpecialNotification = async (req, res) => {
  const { id } = req.params;

  userServices.deleteNotification(id)
    .then((response) => {
      if (response) {
        res.status(response.status).json(response)
      }
    })
    .catch((err) => {
      res.status(err.status).json({ error: err.message })
    })
}

const addPushToken = async (req, res) => {
  try {
    const { uniqueCode, pushToken, platform } = req.body;

    if (!uniqueCode || !pushToken) {
      return res.status(400).json({
        success: false,
        message: 'uniqueCode and pushToken are required'
      });
    }

    if (platform && !['ios', 'android'].includes(platform)) {
      return res.status(400).json({
        success: false,
        message: 'Platform must be either ios or android'
      });
    }

    const result = await userServices.insertPushToken(uniqueCode, pushToken, platform)

    console.log("push regirster result", result);


    if (result.success) {
      res.status(200).json({
        success: true,
        message: 'Push token registered successfully',
        data: result.data
      });
    } else {
      res.status(404).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    console.error('❌ Error registering push token:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

const removePushToken = async (req, res) => {
  try {
    const { uniqueCode, pushToken } = req.body;

    if (!uniqueCode || !pushToken) {
      return res.status(400).json({
        success: false,
        message: 'uniqueCode and pushToken are required'
      });
    }

    const result = await userServices.removePushToken(uniqueCode, pushToken);

    if (result.success) {
      res.status(200).json({
        success: true,
        message: 'Push token removed successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    console.error('❌ Error removing push token:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

const getUserPushTokens = async (req, res) => {
  try {
    const { uniqueCode } = req.body;

    if (!uniqueCode) {
      return res.status(400).json({
        success: false,
        message: 'uniqueCode is required'
      });
    }

    const result = await userServices.getUserPushTokens(uniqueCode);

    if (result.success) {
      res.status(200).json({
        success: true,
        data: result.data
      });
    } else {
      res.status(404).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    console.error('❌ Error getting push tokens:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

const verifyDocAuthUser = async (req, res) => {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({
      success: false,
      message: 'Email and password are required'
    });
  }

  try {
    const result = await userServices.verifyDocAuthUserCreds(password);
    res.status(result.status).json(result);
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: 'Authentication failed',
      error: err.message
    });
  }
}

const getSignKey = async (req, res) => {
  userServices.getAuthSignKey(req.body.password)
    .then((data) => {
      if (data) {
        res.status(data.status).json(data)
      }
    })
    .catch((err) => {
      res.status(err.status || 500).json({ message: 'Cannot get all users', error: err.message })
    })
}

// Activation endpoint
const activateSignature = async (req, res) => {
  try {
    const { activationKey, signType, deviceInfo, } = req.body;
    const { deviceFingerprint, userId } = deviceInfo;

    const result = await userServices.activateSignatureAccess(
      userId,
      activationKey,
      signType,
      deviceInfo,
      deviceFingerprint
    );

    res.status(result.status).json(result);
  } catch (err) {
    res.status(err.status || 500).json({
      message: 'Signature activation failed',
      error: err.message
    });
  }
};

// Verify device trust
const verifyDeviceTrust = async (req, res) => {
  try {
    const { signType, deviceInfo } = req.body;

    const { userId } = deviceInfo;

    const result = await userServices.verifyTrustedDevice(
      userId,
      signType,
      deviceInfo
    );

    res.status(result.status).json(result);
  } catch (err) {
    res.status(err.status || 500).json({
      message: 'Device verification failed',
      error: err.message
    });
  }
};

// Updated sign key getters with device verification
const getSignPmKey = async (req, res) => {
  try {
    const { deviceInfo } = req.body;
    const { userId } = deviceInfo

    const data = await userServices.getPmAuthSignKey(userId, deviceInfo);
    res.status(data.status).json(data);
  } catch (err) {
    res.status(err.status || 500).json({
      message: 'Cannot get PM sign key',
      error: err.message
    });
  }
};

// Similar updates for other sign key functions
const getSignAccountsKey = async (req, res) => {
  try {
    const { deviceInfo } = req.body;
    const { userId } = deviceInfo

    const data = await userServices.getAccountsAuthSignKey(userId, deviceInfo);
    res.status(data.status).json(data);
  } catch (err) {
    res.status(err.status || 500).json({
      message: 'Cannot get Accounts sign key',
      error: err.message
    });
  }
};

const getSignManagerKey = async (req, res) => {
  try {
    const { deviceInfo } = req.body;
    const { userId } = deviceInfo

    const data = await userServices.getManagerAuthSignKey(userId, deviceInfo);
    res.status(data.status).json(data);
  } catch (err) {
    res.status(err.status || 500).json({
      message: 'Cannot get Manager sign key',
      error: err.message
    });
  }
};

const getSignAuthorizedKey = async (req, res) => {
  try {
    const { deviceInfo } = req.body;
    const { userId } = deviceInfo

    const data = await userServices.getAuthorizedAuthSignKey(userId, deviceInfo);
    res.status(data.status).json(data);
  } catch (err) {
    res.status(err.status || 500).json({
      message: 'Cannot get Authorized sign key',
      error: err.message
    });
  }
};

const getSealKey = async (req, res) => {
  try {
    const { deviceInfo } = req.body;
    const { userId } = deviceInfo

    const data = await userServices.getAuthSealKey(userId, deviceInfo);
    res.status(data.status).json(data);
  } catch (err) {
    res.status(err.status || 500).json({
      message: 'Cannot get Seal key',
      error: err.message
    });
  }
};

const sendTestNotification = async (req, res) => {
  try {
    const { uniqueCode, title, message } = req.body;

    if (!uniqueCode) {
      return res.status(400).json({
        success: false,
        message: 'uniqueCode is required'
      });
    }

    const result = await userServices.sendNotificationToUser(
      uniqueCode,
      {
        title: title || 'Test Notification',
        body: message || 'This is a test notification',
        data: { type: 'test', timestamp: new Date().toISOString() }
      }
    );

    if (result.success) {
      res.status(200).json({
        success: true,
        message: 'Test notification sent successfully',
        data: result.data
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    console.error('❌ Error sending test notification:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

const getUserRoles = async (req, res) => {
  if (process.env.MECHANIC &&
    process.env.MAINTENANCE_HEAD &&
    process.env.OPERATOR &&
    process.env.CAMP_BOSS &&
    process.env.MECHANIC_HEAD) {
    res.json({
      status: 200,
      roles: {
        MECHANIC: process.env.MECHANIC,
        MAINTENANCE_HEAD: process.env.MAINTENANCE_HEAD,
        OPERATOR: process.env.OPERATOR,
        CAMP_BOSS: process.env.CAMP_BOSS,
        MECHANIC_HEAD: process.env.MECHANIC_HEAD,
        SUPER_ADMIN: process.env.SUPER_ADMIN,
        JALEEL_KA: process.env.JALEEL_KA,
        WORKSHOP_MANAGER: process.env.WORKSHOP_MANAGER,
        SUB_ADMIN: process.env.SUB_ADMIN,
        ASSISTANT_OFFICE_ADMIN: process.env.ASSISTANT_OFFICE_ADMIN,
        OFFICE_ADMIN: process.env.OFFICE_ADMIN,
        CEO: process.env.CEO,
        ACCOUNTANT: process.env.ACCOUNTANT,
        PURCHASE_MANAGER: process.env.PURCHASE_MANAGER,
        MD: process.env.MD,
        MANAGER: process.env.MANAGER,
      }
    })
  } else {
    // More specific error message
    const missingVars = [];
    if (!process.env.MECHANIC) missingVars.push('MECHANIC');
    if (!process.env.MAINTENANCE_HEAD) missingVars.push('MAINTENANCE_HEAD');
    if (!process.env.OPERATOR) missingVars.push('OPERATOR');
    if (!process.env.CAMP_BOSS) missingVars.push('CAMP_BOSS');
    if (!process.env.MECHANIC_HEAD) missingVars.push('MECHANIC_HEAD');
    if (!process.env.SUPER_ADMIN) missingVars.push('SUPER_ADMIN');
    if (!process.env.JALEEL_KA) missingVars.push('JALEEL_KA');
    if (!process.env.SUB_ADMIN) missingVars.push('SUB_ADMIN');
    if (!process.env.WORKSHOP_MANAGER) missingVars.push('WORKSHOP_MANAGER');
    if (!process.env.OFFICE_ADMIN) missingVars.push('OFFICE_ADMIN');
    if (!process.env.ASSISTANT_OFFICE_ADMIN) missingVars.push('ASSISTANT_OFFICE_ADMIN');
    if (!process.env.CEO) missingVars.push('CEO');
    if (!process.env.ACCOUNTANT) missingVars.push('ACCOUNTANT');
    if (!process.env.MD) missingVars.push('MD');
    if (!process.env.MANAGER) missingVars.push('MANAGER');

    res.status(500).json({
      message: 'Cannot get all roles',
      missingVariables: missingVars
    });
  }
}

// Get all user sessions
const getUserSessions = async (req, res) => {
  try {
    const userId = req.user.id; // Changed from req.user._id
    const currentSessionToken = req.headers.authorization?.split(' ')[1];

    const result = await userServices.getUserSessions(userId, currentSessionToken);
    console.log("result", result)
    res.status(result.status).json(result);
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sessions',
      error: err.message
    });
  }
};

// Logout specific session
const logoutSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id; // Changed from req.user._id
    const currentSessionToken = req.headers.authorization?.split(' ')[1];

    const result = await userServices.logoutSession(sessionId, userId, currentSessionToken);
    res.status(result.status).json(result);
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to logout session',
      error: err.message
    });
  }
};

// Block device
const blockDevice = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id; // Changed from req.user._id

    const result = await userServices.blockDevice(sessionId, userId);
    res.status(result.status).json(result);
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to block device',
      error: err.message
    });
  }
};

// Logout all other sessions
const logoutAllSessions = async (req, res) => {
  try {
    const userId = req.user.id; // Changed from req.user._id
    const currentSessionToken = req.headers.authorization?.split(' ')[1];

    const result = await userServices.logoutAllSessions(userId, currentSessionToken);
    res.status(result.status).json(result);
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to logout all sessions',
      error: err.message
    });
  }
};

const generateBiometricToken = async (req, res) => {
  try {
    const { uniqueCode, deviceInfo } = req.body;

    if (!uniqueCode || !deviceInfo) {
      return res.status(400).json({
        success: false,
        message: 'uniqueCode and deviceInfo are required'
      });
    }

    const result = await userServices.generateBiometricToken(uniqueCode, deviceInfo);

    if (result.success) {
      res.status(200).json({
        success: true,
        data: result.data
      });
    } else {
      res.status(404).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    console.error('❌ Error generating biometric token:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const biometricLogin = async (req, res) => {
  try {
    const { biometricToken, deviceInfo } = req.body;

    if (!biometricToken || !deviceInfo) {
      return res.status(400).json({
        success: false,
        message: 'biometricToken and deviceInfo are required'
      });
    }

    const result = await userServices.biometricLogin(biometricToken, deviceInfo);

    if (result.success) {
      res.status(200).json({
        success: true,
        authorized: true,
        message: 'Biometric login successful',
        data: result.data
      });
    } else {
      res.status(401).json({
        success: false,
        authorized: false,
        message: result.message
      });
    }
  } catch (error) {
    console.error('❌ Error in biometric login:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const revokeBiometricToken = async (req, res) => {
  try {
    const { uniqueCode, deviceInfo } = req.body;

    if (!uniqueCode) {
      return res.status(400).json({
        success: false,
        message: 'uniqueCode is required'
      });
    }

    const result = await userServices.revokeBiometricToken(uniqueCode, deviceInfo);

    if (result.success) {
      res.status(200).json({
        success: true,
        message: result.message
      });
    } else {
      res.status(404).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    console.error('❌ Error revoking biometric token:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const verifyToken = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      valid: true,
      message: 'Token is valid'
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Token is invalid',
      error: err.message
    });
  }
};

module.exports = {
  addUsers,
  getUsers,
  getAllUsers,
  updateUser,
  deleteUser,
  verifyUser,
  updateAuthMail,
  requestGrant,
  grantAccess,
  getGrantAccessData,
  getSpecialNotification,
  deleteSpecialNotification,
  verifyCEO,
  cleanupFiles,
  getFileType,
  requestService,
  addPushToken,
  removePushToken,
  getUserPushTokens,
  sendTestNotification,
  getUserRoles,
  verifyDocAuthUser,
  getSignKey,
  getAllUsers,
  getSignPmKey,
  getSignAccountsKey,
  getSignManagerKey,
  getSignAuthorizedKey,
  getSealKey,
  activateSignature,
  verifyDeviceTrust,
  changePassword,
  resetPassword,
  getUserSessions,
  logoutSession,
  blockDevice,
  logoutAllSessions,
  revokeBiometricToken,
  biometricLogin,
  generateBiometricToken,
  verifyToken
};