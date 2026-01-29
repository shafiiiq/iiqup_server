const Mechanic = require('../models/mechanic.model');
const Operator = require('../models/operator.model');
const OTP = require('../models/otp.model');
const User = require('../models/user.model');
const emailService = require('../utils/email.otp');
const { generateToken, generateTokens } = require('../utils/jwt');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

// Configuration for security
const OTP_SALT_ROUNDS = 12; // Higher = more secure but slower
const MAX_OTP_ATTEMPTS = 5; // Maximum verification attempts
const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 5;

/**
 * Generate a cryptographically secure random OTP
 * @returns {string} - Random OTP
 */
const generateSecureOTP = () => {
  // Use crypto for cryptographically secure random numbers
  const buffer = crypto.randomBytes(4);
  const num = buffer.readUInt32BE(0);
  // Generate a 6-digit OTP
  const otp = (num % 900000 + 100000).toString();
  return otp;
};

/**
 * Hash OTP using bcrypt
 * @param {string} otp - Plain text OTP
 * @returns {Promise<string>} - Hashed OTP
 */
const hashOTP = async (otp) => {
  const salt = await bcrypt.genSalt(OTP_SALT_ROUNDS);
  const hashedOTP = await bcrypt.hash(otp, salt);
  return hashedOTP;
};

/**
 * Verify OTP against hashed version
 * @param {string} plainOTP - Plain text OTP from user
 * @param {string} hashedOTP - Hashed OTP from database
 * @returns {Promise<boolean>} - True if OTP matches
 */
const verifyOTPHash = async (plainOTP, hashedOTP) => {
  return await bcrypt.compare(plainOTP, hashedOTP);
};

/**
 * Generate and send an OTP to the provided email
 * @param {string} email - The email to send OTP to
 * @param {boolean} demo_opr - Demo operator flag
 * @param {string} name - User name
 * @returns {Promise} - Promise with the result of the operation
 */
const generateAndSendOTP = async (email, demo_opr = false, name) => {
  try {
    // Validate email format
    if (!email || !email.match(/^\S+@\S+\.\S+$/)) {
      return {
        status: 400, 
        success: false,
        message: 'Valid email address is required'
      };
    }

    let user;

    // Check if user exists with this email
    user = await User.findOne({ authMail: email });

    if (!user) {
      user = await Mechanic.findOne({ authMail: email });
      if (!user) {
        return {
          status: 404, 
          success: false,
          message: 'No user found with this email address'
        };
      }
    }

    // Generate a cryptographically secure OTP
    const otp = generateSecureOTP();  

    // Hash the OTP before storing
    const hashedOTP = await hashOTP(otp);

    // Set expiration time (5 minutes from now)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + OTP_EXPIRY_MINUTES);

    // Save hashed OTP to database
    await OTP.findOneAndUpdate(
      { email },
      {
        email,
        otp: hashedOTP, // Store hashed OTP
        expiresAt,
        verified: false,
        attempts: 0, // Reset attempts counter
        createdAt: new Date()
      },
      { upsert: true, new: true }
    );

    // Send plain OTP via email (only send plain text via email)
    if (demo_opr) {
      await emailService.sendOTPEmail(email, otp, name, true);
    } else {
      await emailService.sendOTPEmail(email, otp, user.name);
    }

    // Only return OTP in development or for demo accounts
    const isDemoAccount = process.env.DEMO_OFFICE == user.email || 
                          process.env.DEMO_MECHANIC == user.email || 
                          demo_opr;
    const isDevelopment = process.env.NODE_ENV === 'development';

    return {
      status: 200,
      success: true,
      message: 'OTP sent successfully to your email',
      // Only expose OTP for demo/development
      otp: (isDemoAccount || isDevelopment) ? otp : null,
      data: {
        email,
        expiresAt,
        // Security note: Never return OTP in production
        ...(isDevelopment && { otp })
      }
    };
  } catch (error) {
    console.error('Error generating OTP:', error);
    return {
      status: 500,
      success: false,
      message: 'Failed to generate OTP',
      error: error.message
    };
  }
};

/**
 * Verify an OTP submitted by the user
 * @param {string} email - The email address
 * @param {string} otp - The OTP to verify
 * @param {string} type - User type (mechanic, operator, office)
 * @param {string} qatarId - Qatar ID for operators
 * @returns {Promise} - Promise with the result of the operation
 */
const verifyOTP = async (email, otp, type, qatarId = null) => {
  try {
    // Input validation
    if (!otp || otp.length !== OTP_LENGTH) {
      return {
        status: 400,
        success: false,
        message: 'Invalid OTP format'
      };
    }

    // Find the OTP record
    const otpRecord = await OTP.findOne({ email });

    if (!otpRecord) {
      return {
        status: 404,
        success: false,
        message: 'Invalid OTP'
      };
    }

    // Check if OTP is expired
    if (otpRecord.expiresAt < new Date()) {
      // Clean up expired OTP
      await OTP.deleteOne({ email });
      return {
        status: 400,
        success: false,
        message: 'OTP has expired. Please request a new one.'
      };
    }

    // Check if OTP is already verified
    if (otpRecord.verified) {
      return {
        status: 400,
        success: false,
        message: 'OTP has already been used'
      };
    }

    // Check attempt limit
    if (otpRecord.attempts >= MAX_OTP_ATTEMPTS) {
      // Delete OTP after max attempts
      await OTP.deleteOne({ email });
      return {
        status: 429,
        success: false,
        message: 'Maximum verification attempts exceeded. Please request a new OTP.'
      };
    }

    // Verify OTP using bcrypt
    const isOTPValid = await verifyOTPHash(otp, otpRecord.otp);

    if (!isOTPValid) {
      // Increment attempts
      otpRecord.attempts = (otpRecord.attempts || 0) + 1;
      await otpRecord.save();

      const remainingAttempts = MAX_OTP_ATTEMPTS - otpRecord.attempts;
      
      return {
        status: 400,
        success: false,
        message: `Invalid OTP. ${remainingAttempts} attempt(s) remaining.`
      };
    }

    // Mark OTP as verified
    otpRecord.verified = true;
    await otpRecord.save();

    // Find user to return some basic info
    let user;
    if (type === 'mechanic') {
      user = await Mechanic.findOne({ authMail: email }).select('_id name email role uniqueCode userType');
    } else if (type === 'operator') {
      user = await Operator.findOne({ qatarId: qatarId }).select('_id name uniqueCode userType equipmentNumber qatarId');
    } else {
      user = await User.findOne({ authMail: email }).select('_id name email role uniqueCode userType');
    }

    if (!user) {
      return {
        status: 404,
        success: false,
        message: 'User not found'
      };
    }

    // Generate authentication tokens
    const _auth_tokens = generateTokens({
      _id: user._id,
      email: type === 'operator' ? qatarId : user.email,
      role: user.role,
      uniqueCode: user.uniqueCode
    });

    // Clean up verified OTP after successful verification
    await OTP.deleteOne({ email });

    return {
      status: 200,
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
          auth0token: _auth_tokens.accessToken,
          refresh_token: _auth_tokens.refreshToken
        }
      }
    };
  } catch (error) {
    console.error('Error verifying OTP:', error);
    return {
      status: 500,
      success: false,
      message: 'Failed to verify OTP',
      error: error.message
    };
  }
};

/**
 * Reset password using verified OTP
 * @param {string} email - User's email
 * @param {string} otp - The OTP to verify
 * @param {string} newPassword - New password to set
 * @returns {Promise} - Promise with the result of the operation
 */
const resetPasswordWithOTP = async (email, otp, newPassword) => {
  try {
    // Verify the OTP first
    const otpRecord = await OTP.findOne({ email });

    if (!otpRecord) {
      return {
        status: 404,
        success: false,
        message: 'No OTP found for this email address'
      };
    }

    // Check expiration
    if (otpRecord.expiresAt < new Date()) {
      await OTP.deleteOne({ email });
      return {
        status: 400,
        success: false,
        message: 'OTP has expired. Please request a new one.'
      };
    }

    // Check if already verified
    if (otpRecord.verified) {
      return {
        status: 400,
        success: false,
        message: 'OTP has already been used'
      };
    }

    // Check attempt limit
    if (otpRecord.attempts >= MAX_OTP_ATTEMPTS) {
      await OTP.deleteOne({ email });
      return {
        status: 429,
        success: false,
        message: 'Maximum verification attempts exceeded. Please request a new OTP.'
      };
    }

    // Verify OTP
    const isOTPValid = await verifyOTPHash(otp, otpRecord.otp);

    if (!isOTPValid) {
      otpRecord.attempts = (otpRecord.attempts || 0) + 1;
      await otpRecord.save();

      const remainingAttempts = MAX_OTP_ATTEMPTS - otpRecord.attempts;
      return {
        status: 400,
        success: false,
        message: `Invalid OTP. ${remainingAttempts} attempt(s) remaining.`
      };
    }

    // Hash the new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update user password
    const updatedUser = await User.findOneAndUpdate(
      { authMail: email },
      {
        password: hashedPassword,
        updatedAt: new Date()
      },
      { new: true }
    ).select('-password');

    if (!updatedUser) {
      return {
        status: 404,
        success: false,
        message: 'User not found'
      };
    }

    // Clean up OTP after successful password reset
    await OTP.deleteOne({ email });

    return {
      status: 200,
      success: true,
      message: 'Password reset successfully',
      data: {
        _id: updatedUser._id,
        email: updatedUser.authMail
      }
    };
  } catch (error) {
    console.error('Error resetting password:', error);
    return {
      status: 500,
      success: false,
      message: 'Failed to reset password',
      error: error.message
    };
  }
};

module.exports = {
  generateAndSendOTP,
  verifyOTP,
  resetPasswordWithOTP
};