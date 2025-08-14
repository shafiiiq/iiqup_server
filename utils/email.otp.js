// utils/email.otp.js (Updated)
const nodemailer = require('nodemailer');
const { createSecureOAuthTransporter } = require('../services/secure-oauth-service');
require('dotenv').config();

/**
 * Generate HTML template for OTP email
 */
const generateOTPTemplate = (otp, username = 'Valued Customer') => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Al Ansari - Your OTP Code</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap');
        
        body {
          font-family: 'Roboto', Arial, sans-serif;
          line-height: 1.6;
          margin: 0;
          padding: 0;
          background-color: #f7f7f7;
        }
        
        .container {
          max-width: 600px;
          margin: 20px auto;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }
        
        .content {
          padding: 30px;
          background-color: #ffffff;
        }
        
        .greeting {
          font-size: 22px;
          font-weight: 500;
          margin-bottom: 15px;
          color: #1a4e8e;
        }
        
        .otp-container {
          margin: 30px 0;
          padding: 20px;
          background: linear-gradient(to right, #f9f9f9, #f3f3f3);
          border-radius: 8px;
          text-align: center;
          border-left: 4px solid #1a4e8e;
        }
        
        .otp-code {
          font-size: 32px;
          font-weight: 700;
          letter-spacing: 8px;
          color: #1a4e8e;
          padding: 10px 0;
        }
        
        .timer {
          display: inline-block;
          margin-top: 10px;
          padding: 5px 15px;
          background-color: #ffe8e8;
          color: #d83030;
          border-radius: 15px;
          font-size: 14px;
        }
        
        .warning {
          margin-top: 25px;
          padding: 15px;
          background-color: #fff8e6;
          border-left: 4px solid #ffc107;
          border-radius: 4px;
        }
        
        .footer {
          padding: 20px;
          text-align: center;
          font-size: 13px;
          color: #777777;
          background-color: #fafafa;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="content">
          <div class="greeting">Hello, ${username}!</div>
          <p>Your One-Time Password for secure authentication:</p>
          
          <div class="otp-container">
            <div class="otp-code">${otp}</div>
            <div class="timer">Expires in 5 minutes</div>
          </div>
          
          <div class="warning">
            <strong>Security Notice:</strong> Never share this OTP with anyone.
          </div>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} Al Ansari. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

/**
 * Create Gmail App Password transporter
 */
const createGmailTransporter = () => {
  if (!process.env.GMAIL_APP_PASSWORD || !process.env.OTP_MAILER) {
    throw new Error('Missing GMAIL_APP_PASSWORD or OTP_MAILER');
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.OTP_MAILER.replace(/"/g, ''),
      pass: process.env.GMAIL_APP_PASSWORD
    }
  });
};

/**
 * Send OTP email with multiple methods
 */
const sendOTPEmail = async (email, otp, username = '') => {
  if (!email || !email.includes('@')) {
    throw new Error('Invalid email address');
  }

  if (!otp || otp.length < 4) {
    throw new Error('Invalid OTP');
  }

  const methods = [
    {
      name: 'Gmail App Password',
      create: createGmailTransporter,
      enabled: process.env.GMAIL_APP_PASSWORD && process.env.OTP_MAILER
    },
    {
      name: 'Secure OAuth2',
      create: createSecureOAuthTransporter,
      enabled: true // Always try if other methods fail
    }
  ];

  const errors = [];

  for (const method of methods) {
    if (!method.enabled) continue;

    try {
      const transporter = await method.create();
      await transporter.verify();

      const fromEmail = process.env.OTP_MAILER?.replace(/"/g, '') || 'noreply@alansari.com';

      const mailOptions = {
        from: `"Al Ansari" <${fromEmail}>`,
        to: email,
        subject: `Your One Time Password: ${otp}`,
        html: generateOTPTemplate(otp, username),
        text: `OTP: ${otp}. will expires in 5 minutes.`
      };

      const info = await transporter.sendMail(mailOptions);
      transporter.close();

      return {
        success: true,
        message: `OTP sent via ${method.name}`,
        messageId: info.messageId
      };

    } catch (error) {
      errors.push(`${method.name}: ${error.message}`);
    }
  }

  throw new Error(`All methods failed: ${errors.join('; ')}`);
};

module.exports = {
  sendOTPEmail,
  generateOTPTemplate
};