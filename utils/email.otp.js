const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const OAuth2 = google.auth.OAuth2;
require('dotenv').config();

// Create OAuth2 client
const createOAuth2Client = () => {
  const oauth2Client = new OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URL // Redirect URL
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.GMAIL_REFRESH_TOKEN
  });

  return oauth2Client;
};

// Get access token
const getAccessToken = async () => {
  try {
    const oauth2Client = createOAuth2Client();
    const { token } = await oauth2Client.getAccessToken();
    return token;
  } catch (error) {
    console.error('Error getting access token:', error);
    throw error;
  }
};

// Email configuration using OAuth2
const createTransporter = async () => { 
  try {
    const accessToken = await getAccessToken();

    console.log('Raw OTP_MAILER:', JSON.stringify(process.env.OTP_MAILER));
    console.log('Cleaned OTP_MAILER:', process.env.OTP_MAILER.replace(/"/g, ''));

    const emailConfig = {
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: process.env.OTP_MAILER.replace(/"/g, ''),
        clientId: process.env.GMAIL_CLIENT_ID,
        clientSecret: process.env.GMAIL_CLIENT_SECRET,
        refreshToken: process.env.GMAIL_REFRESH_TOKEN,
        accessToken: accessToken
      },
      debug: process.env.NODE_ENV !== 'production' // Debug mode
    };

    return nodemailer.createTransport(emailConfig);
  } catch (error) {
    console.error('Failed to create email transporter:', error);
    throw error;
  }
};

/**
 * Generate HTML template for OTP email
 * @param {string} otp - The OTP code
 * @param {string} username - The user's name (optional)
 * @returns {string} - HTML email template
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
          color: #333333;
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
        
        .header {
          background: linear-gradient(135deg, #1a4e8e 0%, #0f3c6e 100%);
          padding: 25px 20px;
          text-align: center;
        }
        
        .logo {
          max-width: 180px;
          margin: 0 auto;
          display: block;
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
        
        .otp-title {
          font-size: 16px;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #555;
          margin-bottom: 10px;
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
        
        p {
          margin: 15px 0;
          font-size: 16px;
        }
        
        .warning {
          margin-top: 25px;
          padding: 15px;
          background-color: #fff8e6;
          border-left: 4px solid #ffc107;
          border-radius: 4px;
        }
        
        .warning-title {
          color: #e6a400;
          font-weight: 700;
          margin: 0 0 5px 0;
        }
        
        .warning-text {
          color: #705400;
          margin: 0;
        }
        
        .divider {
          height: 1px;
          background-color: #eeeeee;
          margin: 25px 0;
        }
        
        .footer {
          padding: 20px;
          text-align: center;
          font-size: 13px;
          color: #777777;
          background-color: #fafafa;
          border-top: 1px solid #eeeeee;
        }
        
        .social-links {
          margin: 15px 0;
        }
        
        .social-links a {
          display: inline-block;
          margin: 0 8px;
          color: #1a4e8e;
          text-decoration: none;
        }
        
        .help-text {
          margin-top: 15px;
          font-size: 14px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <img src="${process.env.BASE_URL || 'https://yourdomain.com'}/public/assets/images/logo.png" alt="Al Ansari Exchange" class="logo">
        </div>
        <div class="content">
          <div class="greeting">Hello, ${username}!</div>
          <p>Thank you for using Al Ansari services. For security purposes, we need to verify your identity.</p>
          
          <div class="otp-container">
            <div class="otp-title">Your One-Time Password</div>
            <div class="otp-code">${otp}</div>
            <div class="timer">Expires in 5 minutes</div>
          </div>
          
          <p>Please enter this code in the verification page to complete your authentication process.</p>
          
          <div class="warning">
            <div class="warning-title">Security Notice</div>
            <div class="warning-text">Never share this OTP with anyone. Al Ansari representatives will never ask for your OTP via phone, SMS, or email.</div>
          </div>
          
          <div class="divider"></div>
          
          <p>If you didn't request this code, please contact our customer support immediately.</p>
          
          <div class="help-text">Need assistance? Contact our 24/7 customer service at <strong>+971 7132 0950</strong></div>
        </div>
        <div class="footer">
          <div class="social-links">
            <a href="#">Facebook</a> • 
            <a href="#">Twitter</a> • 
            <a href="#">Instagram</a> • 
            <a href="#">LinkedIn</a>
          </div>
          <p>&copy; ${new Date().getFullYear()} Al Ansari. All rights reserved.</p>
          <p>This is an automated message, please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// Export the template generator function
module.exports = generateOTPTemplate;

/**
 * Send OTP via email
 * @param {string} email - Recipient email address
 * @param {string} otp - The OTP code to send
 * @param {string} username - The user's name (optional)
 * @returns {Promise} - Promise with the result of the operation
 */
const sendOTPEmail = async (email, otp, username = '') => {
  try {
    // Get transporter with OAuth credentials
    const transporter = await createTransporter();

    // Email options
    const mailOptions = {
      from: `"Al Ansari" <adminatnewo@gmail.com>`,
      to: email,
      subject: 'Your One-Time Password (OTP)',
      html: generateOTPTemplate(otp, username),
      // Adding extra headers for deliverability
      headers: {
        'X-Priority': '1',
        'X-MSMail-Priority': 'High',
        'Importance': 'High'
      }
    };

    // Send email
    const info = await transporter.sendMail(mailOptions);
    console.log('=== EMAIL SENT SUCCESSFULLY ===');
    console.log('Message ID:', info.messageId);
    console.log('Response:', info.response);
    console.log('Accepted recipients:', info.accepted);
    console.log('Rejected recipients:', info.rejected);
    console.log('===============================');

    return {
      success: true,
      message: 'OTP email sent successfully',
      messageId: info.messageId,
      response: info.response
    };
  } catch (error) {
    console.error('=== EMAIL SENDING FAILED ===');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);

    // Log more details if available
    if (error.command) console.error('Error command:', error.command);
    if (error.responseCode) console.error('Error response code:', error.responseCode);
    if (error.response) console.error('Error response:', error.response);
    console.error('============================');

    throw {
      success: false,
      message: 'Failed to send OTP email',
      error: error.message,
      details: {
        code: error.code,
        command: error.command,
        responseCode: error.responseCode
      }
    };
  }
};

/**
 * Test the email sending functionality
 * Can be used to verify setup before implementation
 */
const testEmailService = async () => {
  try {
    console.log('Testing email service...');
    const testOTP = '123456';
    const testEmail = 'test@example.com'; // Replace with your test email
    const result = await sendOTPEmail(testEmail, testOTP, 'Test User');
    console.log('Test email result:', result);
    return result;
  } catch (error) {
    console.error('Test email failed:', error);
    return error;
  }
};

module.exports = {
  sendOTPEmail,
  testEmailService
};