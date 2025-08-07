// Updated users.controllers.js with circular dependency fix
const userServices = require('../services/user-services')
// Remove this import that's causing circular dependency:
// const { grantAccess } = require('../controllers/users.controllers');

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
  const { email, password, type } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email and password are required'
    });
  }

  try {
    const result = await userServices.verifyUserCredentials(email, password, type);
    res.status(result.status).json(result);
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: 'Authentication failed',
      error: err.message
    });
  }
}

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
    let purpose = 'overtime'

    if (purpose === 'overtime') {
      let overtimeData;
      try {
        overtimeData = JSON.parse(req.body.overtimeData);
      } catch (error) {
        if (req.files && req.files.length > 0) {
          cleanupFiles(req.files);
        }
        return res.status(400).json({
          error: 'Invalid overtime data format',
          details: error.message
        });
      }

      const { date, regNo, times, workDetails } = overtimeData;
      if (!date || !regNo || !times || !workDetails) {
        if (req.files && req.files.length > 0) {
          cleanupFiles(req.files);
        }
        return res.status(400).json({
          error: 'Missing required fields: date, regNo, times, and workDetails are required'
        });
      }

      if (!Array.isArray(times) || times.length === 0) {
        if (req.files && req.files.length > 0) {
          cleanupFiles(req.files);
        }
        return res.status(400).json({
          error: 'Times must be a non-empty array'
        });
      }

      for (let i = 0; i < times.length; i++) {
        const time = times[i];
        if (!time.in || !time.out) {
          if (req.files && req.files.length > 0) {
            cleanupFiles(req.files);
          }
          return res.status(400).json({
            error: `Time entry ${i + 1} is missing 'in' or 'out' time`
          });
        }
      }

      const tempMediaFiles = [];
      if (req.files && req.files.length > 0) {
        req.files.forEach(file => {
          const mediaFile = {
            fileName: file.filename,
            originalName: file.originalname,
            filePath: file.path,
            fileSize: file.size,
            mimeType: file.mimetype,
            fieldName: file.fieldname,
            uploadDate: new Date(),
            type: getFileType(file.mimetype),
            url: `/uploads/overtime/${file.filename}`
          };
          tempMediaFiles.push(mediaFile);
        });
      }

      const tempOvertimeData = {
        ...overtimeData,
        mediaFiles: tempMediaFiles,
        totalFiles: tempMediaFiles.length
      };

      const response = await userServices.grantPermission(mechanicId, purpose, tempOvertimeData, req.files);

      if (response) {
        res.status(response.status).json(response);
      }
    } else {
      const response = await userServices.grantPermission(mechanicId, purpose, req.body);
      if (response) {
        res.status(response.status).json(response);
      }
    }
  } catch (err) {
    console.error('Error in requestGrant:', err);

    if (req.files && req.files.length > 0) {
      cleanupFiles(req.files);
    }

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
        console.log(`Cleaned up file: ${file.filename}`);
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

module.exports = {
  addUsers,
  getUsers,
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
  
  // Push notification functions
  addPushToken,
  removePushToken,
  getUserPushTokens,
  sendTestNotification
};