const Mechanic = require('../models/mechanic.model');
const Operator = require('../models/operator.model');
const OTP = require('../models/otp.model');
const User = require('../models/user.model');
const emailService = require('../utils/email.otp');
const { generateToken, generateTokens } = require('../utils/jwt');

/**
 * Generate and send an OTP to the provided email
 * @param {string} email - The email to send OTP to
 * @returns {Promise} - Promise with the result of the operation
 */
const generateAndSendOTP = async (email) => {
  try {
    // Validate email format
    if (!email || !email.match(/^\S+@\S+\.\S+$/)) {
      return {
        status: 400,
        success: false,
        message: 'Valid email address is required'
      };
    }

    // Check if user exists with this email
    const user = await User.findOne({ authMail: email });
    if (!user) {
      return {
        status: 404,
        success: false,
        message: 'No user found with this email address'
      };
    }

    // Generate a random 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Set expiration time (5 minutes from now)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 5);

    // Save OTP to database (update if exists, create if not)
    await OTP.findOneAndUpdate(
      { email },
      {
        email,
        otp,
        expiresAt,
        verified: false
      },
      { upsert: true, new: true }
    );

    // Send OTP via email
    await emailService.sendOTPEmail(email, otp, user.name);

    return {
      status: 200,
      success: true,
      message: 'OTP sent successfully to your email',
      data: {
        email,
        // In development mode, you might want to return the OTP for testing
        // Remove in production
        otp: process.env.NODE_ENV === 'development' ? otp : undefined
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
 * @returns {Promise} - Promise with the result of the operation
 */
const verifyOTP = async (email, otp, type, qatarId = null) => {
  try {
    // Find the OTP record
    const otpRecord = await OTP.findOne({ email });

    if (!otpRecord) {
      return {
        status: 404,
        success: false,
        message: 'No OTP found for this email address'
      };
    }

    // Check if OTP is expired
    if (otpRecord.expiresAt < new Date()) {
      return {
        status: 400,
        success: false,
        message: 'OTP has expired. Please request a new one.'
      };
    }

    // Check if OTP matches
    if (otpRecord.otp !== otp) {
      return {
        status: 400,
        success: false,
        message: 'Invalid OTP'
      };
    }

    // Mark OTP as verified
    otpRecord.verified = true;
    await otpRecord.save();

    // Find user to return some basic info
    let user
    if (type === 'mechanic') {
      user = await Mechanic.findOne({ authMail: email }).select('_id name email role uniqueCode userType');
    } else if (type === 'operator') {
      user = await Operator.findOne({ qatarId: qatarId }).select('_id name uniqueCode userType equipmentNumber');
    } else {
      user = await User.findOne({ authMail: email }).select('_id name email role uniqueCode userType');
    }

    const _auth_tokens = generateTokens({
      _id: user._id,  // This gets mapped to 'id' inside generateToken
      email: type === 'operator' ? qatarId : user.email,
      role: user.role, // Use user.role instead of user.userType
      uniqueCode: user.uniqueCode
    });


    return {
      status: 200,
      success: true,
      message: 'OTP verified successfully',
      authorized: true,
      data: {
        user: user ? {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          userType: user.userType,
          uniqueCode: user.uniqueCode,
          equipmentNumber: user.equipmentNumber ? user.equipmentNumber : null,
          auth0token: _auth_tokens.accessToken,
          refresh_token: _auth_tokens.refreshToken
        } : null
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
 * @param {string} otp - The verified OTP
 * @param {string} newPassword - New password to set
 * @returns {Promise} - Promise with the result of the operation
 */
const resetPasswordWithOTP = async (email, otp, newPassword) => {
  try {
    // First verify the OTP
    const verificationResult = await verifyOTP(email, otp);

    if (!verificationResult.success) {
      return verificationResult; // Return the error from OTP verification
    }

    // If OTP verification was successful, reset the password
    const bcrypt = require('bcrypt');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update user password
    const updatedUser = await User.findOneAndUpdate(
      { email },
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

    return {
      status: 200,
      success: true,
      message: 'Password reset successfully',
      data: {
        _id: updatedUser._id,
        email: updatedUser.email
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