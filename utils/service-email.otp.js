// services/oauth2-gmail-api.js - LIFETIME SOLUTION (No Service Account Keys)
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

/**
 * OAuth2 Gmail API Client (LIFETIME - Uses stored refresh token)
 */
class OAuth2GmailClient {
  constructor() {
    this.oauth2Client = null;
    this.gmail = null;
    this.refreshToken = process.env.SERVICE_GMAIL_REFRESH_TOKEN;
  }

  /**
   * Initialize OAuth2 client
   */
  async initialize() {
    try {

      console.log(process.env.SERVICE_GOOGLE_CLIENT_ID);
      
      // Use your existing environment variables
      const clientId = process.env.SERVICE_GOOGLE_CLIENT_ID?.replace(/"/g, '');
      const clientSecret = process.env.SERVICE_GOOGLE_CLEINT_SECRET?.replace(/"/g, '');
      
      if (!clientId || !clientSecret) {
        throw new Error('Missing Google OAuth credentials');
      }

      // Create OAuth2 client
      this.oauth2Client = new google.auth.OAuth2(
        clientId,
        clientSecret,
        'http://localhost:3000/oauth2callback' // Redirect URI
      );

      // If we have a refresh token, use it
      if (this.refreshToken) {
        this.oauth2Client.setCredentials({
          refresh_token: this.refreshToken
        });
        
        // Create Gmail API instance
        this.gmail = google.gmail({
          version: 'v1',
          auth: this.oauth2Client
        });
        
        return true;
      }

      return false; // Need to get refresh token first
      
    } catch (error) {
      throw new Error(`OAuth2 initialization failed: ${error.message}`);
    }
  }

  /**
   * Get authorization URL (run once to get refresh token)
   */
  getAuthUrl() {
    const scopes = ['https://www.googleapis.com/auth/gmail.send'];
    
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline', // Important: gets refresh token
      prompt: 'consent', // Forces consent screen to get refresh token
      scope: scopes
    });
  }

  /**
   * Exchange authorization code for tokens (run once)
   */
  async getTokensFromCode(code) {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      
      console.log('🎉 SUCCESS! Add this to your .env file:');
      console.log(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token}`);
      
      return tokens;
    } catch (error) {
      throw new Error(`Token exchange failed: ${error.message}`);
    }
  }

  /**
   * Get MIME type based on file extension
   */
  getMimeType(filename) {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.txt': 'text/plain',
      '.csv': 'text/csv',
      '.zip': 'application/zip'
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Send email via Gmail API with optional attachments
   */
  async sendEmail(to, subject, htmlContent, textContent, attachments = []) {
    try {
      if (!this.gmail) {
        const initialized = await this.initialize();
        if (!initialized) {
          throw new Error('Gmail client not initialized - need refresh token');
        }
      }

      const boundary = `boundary_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create email headers
      const emailLines = [
        `From: "SERVICE AL ANSARI TRANSPORT" <${process.env.SERVICE_OTP_MAILER}>`,
        `To: ${to}`,
        `Subject: ${subject}`,
        'MIME-Version: 1.0',
        `Content-Type: multipart/mixed; boundary="${boundary}"`,
        '',
        `--${boundary}`,
        'Content-Type: multipart/alternative; boundary="alt_boundary"',
        '',
        '--alt_boundary',
        'Content-Type: text/plain; charset=utf-8',
        '',
        textContent,
        '',
        '--alt_boundary',
        'Content-Type: text/html; charset=utf-8',
        '',
        htmlContent,
        '',
        '--alt_boundary--'
      ];

      // Add attachments if provided
      if (attachments && attachments.length > 0) {
        for (const attachment of attachments) {
          try {
            let fileContent;
            let filename;
            let mimeType;

            // Handle different attachment formats
            if (typeof attachment === 'string') {
              // File path string
              if (!fs.existsSync(attachment)) {
                console.warn(`Attachment file not found: ${attachment}`);
                continue;
              }
              fileContent = fs.readFileSync(attachment);
              filename = path.basename(attachment);
              mimeType = this.getMimeType(filename);
            } else if (attachment.path) {
              // Object with path
              if (!fs.existsSync(attachment.path)) {
                console.warn(`Attachment file not found: ${attachment.path}`);
                continue;
              }
              fileContent = fs.readFileSync(attachment.path);
              filename = attachment.filename || path.basename(attachment.path);
              mimeType = attachment.mimeType || this.getMimeType(filename);
            } else if (attachment.content) {
              // Object with content buffer/string
              fileContent = Buffer.isBuffer(attachment.content) 
                ? attachment.content 
                : Buffer.from(attachment.content);
              filename = attachment.filename || 'attachment';
              mimeType = attachment.mimeType || 'application/octet-stream';
            } else {
              console.warn('Invalid attachment format:', attachment);
              continue;
            }

            // Add attachment to email
            emailLines.push(
              '',
              `--${boundary}`,
              `Content-Type: ${mimeType}; name="${filename}"`,
              'Content-Transfer-Encoding: base64',
              `Content-Disposition: attachment; filename="${filename}"`,
              '',
              fileContent.toString('base64')
            );

          } catch (attachmentError) {
            console.warn(`Error processing attachment: ${attachmentError.message}`);
            continue;
          }
        }
      }

      // Close the email
      emailLines.push('', `--${boundary}--`);

      const email = emailLines.join('\n');
      
      // Encode email in base64url
      const encodedEmail = Buffer.from(email)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      // Send email
      const response = await this.gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedEmail
        }
      });

      return {
        success: true,
        messageId: response.data.id,
        method: 'Gmail API (OAuth2)',
        attachmentsCount: attachments ? attachments.length : 0
      };

    } catch (error) {
      // If token expired, try to refresh
      if (error.message.includes('invalid_grant') || error.message.includes('unauthorized')) {
        try {
          await this.oauth2Client.refreshAccessToken();
          // Retry sending
          return await this.sendEmail(to, subject, htmlContent, textContent, attachments);
        } catch (refreshError) {
          throw new Error(`Token refresh failed: ${refreshError.message}`);
        }
      }
      throw new Error(`Gmail API send failed: ${error.message}`);
    }
  }
}

// Global instance
const gmailClient = new OAuth2GmailClient();

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
        
        .header {
          background: linear-gradient(135deg, #1a4e8e 0%, #2d5aa0 100%);
          padding: 30px;
          text-align: center;
          color: white;
        }
        
        .logo {
          font-size: 28px;
          font-weight: 700;
          margin-bottom: 5px;
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
          text-align: center;
          padding: 25px;
          background: linear-gradient(to right, #f9f9f9, #f3f3f3);
          border-radius: 12px;
          border-left: 4px solid #1a4e8e;
        }
        
        .otp-label {
          font-size: 16px;
          color: #666;
          margin-bottom: 10px;
          font-weight: 500;
        }
        
        .otp-code {
          font-size: 36px;
          font-weight: 700;
          color: #1a4e8e;
          letter-spacing: 8px;
          margin: 10px 0;
          font-family: 'Courier New', monospace;
        }
        
        .otp-validity {
          font-size: 14px;
          color: #e74c3c;
          font-weight: 500;
        }
        
        .message {
          margin: 20px 0;
          font-size: 16px;
          color: #555;
        }
        
        .security-notice {
          margin: 25px 0;
          padding: 15px;
          background-color: #fff3cd;
          border-left: 4px solid #ffc107;
          border-radius: 4px;
        }
        
        .security-notice strong {
          color: #856404;
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
        <div class="header">
          <div class="logo">Al Ansari</div>
          <div>Verification Code</div>
        </div>
        <div class="content">
          <div class="greeting">Hello, ${username}!</div>
          
          <div class="message">
            You've requested a one-time password for account verification. Please use the code below:
          </div>
          
          <div class="otp-container">
            <div class="otp-label">Your Verification Code</div>
            <div class="otp-code">${otp}</div>
            <div class="otp-validity">⏰ Valid for 5 minutes only</div>
          </div>
          
          <div class="security-notice">
            <strong>Security Notice:</strong> Never share this code with anyone. Al Ansari will never ask for your OTP via phone or email.
          </div>
        </div>
        <div class="footer">
          <p>If you didn't request this code, please ignore this email.</p>
          <p>&copy; ${new Date().getFullYear()} Al Ansari. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

/**
 * Generate HTML template for Backcharge email
 */
const generateBackchargeTemplate = (recipientName = 'Valued Customer') => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Al Ansari - Backcharge Documents</title>
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
        
        .message-container {
          margin: 30px 0;
          padding: 20px;
          background: linear-gradient(to right, #f9f9f9, #f3f3f3);
          border-radius: 8px;
          border-left: 4px solid #1a4e8e;
        }
        
        .message-text {
          font-size: 16px;
          color: #333;
          margin-bottom: 15px;
        }
        
        .contact-info {
          display: inline-block;
          margin-top: 10px;
          padding: 10px 20px;
          background-color: #e8f4f8;
          color: #1a4e8e;
          border-radius: 5px;
          font-size: 14px;
          font-weight: 500;
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
          <div class="greeting">Hello, ${recipientName}!</div>
          
          <div class="message-container">
            <div class="message-text">
              Please find the attached backcharge and sign and forward the signed documents.
            </div>
            
            <div class="contact-info">
              For more details contact Workshop Manager (Contact No: 51700481)
            </div>
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
 * Send OTP email using OAuth2 Gmail API with optional attachments (MAIN FUNCTION)
 */
const sendOTPEmail = async (email, otp, username = '', attachments = []) => {
  if (!email || !email.includes('@')) {
    throw new Error('Invalid email address');
  }

  if (!otp || otp.length < 4) {
    throw new Error('Invalid OTP');
  }

  const subject = `Your One Time Password: ${otp}`;
  const htmlContent = generateOTPTemplate(otp, username);
  const textContent = `Your OTP: ${otp}. This code will expire in 5 minutes.`;

  return await gmailClient.sendEmail(email, subject, htmlContent, textContent, attachments);
};

/**
 * Send Backcharge email with attachments
 */
const sendBackchargeEmail = async (email, recipientName = '', attachments = []) => {
  if (!email || !email.includes('@')) {
    throw new Error('Invalid email address');
  }

  const subject = 'Al Ansari - Backcharge Documents for Signature';
  const htmlContent = generateBackchargeTemplate(recipientName);
  const textContent = 'Please find the attached backcharge documents. Sign and forward the signed documents. For more details contact Workshop Manager (Contact No: 51700481)';

  return await gmailClient.sendEmail(email, subject, htmlContent, textContent, attachments);
};

/**
 * Helper function to get authorization URL (run once for setup)
 */
const getAuthorizationUrl = async () => {
  await gmailClient.initialize();
  return gmailClient.getAuthUrl();
};

/**
 * Helper function to exchange code for tokens (run once for setup)
 */
const exchangeCodeForTokens = async (code) => {
  await gmailClient.initialize();
  return await gmailClient.getTokensFromCode(code);
};

module.exports = {
  sendOTPEmail,
  sendBackchargeEmail,
  getAuthorizationUrl,
  exchangeCodeForTokens,
  generateOTPTemplate,
  generateBackchargeTemplate
};