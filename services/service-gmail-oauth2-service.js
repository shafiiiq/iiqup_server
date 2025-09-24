// services/gmail-oauth2-service.js
const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

class GmailOAuth2Service {
  constructor() {
    this.oauth2Client = null;
    this.gmail = null;
    this.credentials = {
      clientId: process.env.SERVICE_GOOGLE_CLIENT_ID,
      clientSecret: process.env.SERVICE_GOOGLE_CLIENT_SECRET,
      redirectUri: process.env.SERVICE_GOOGLE_REDIRECT_URI || 'urn:ietf:wg:oauth:2.0:oob',
      refreshToken: process.env.SERVICE_GOOGLE_REFRESH_TOKEN
    };
    this.credentialsPath = path.join(process.cwd(), 'config', 'oauth2-credentials.json');
  }

  /**
   * Initialize OAuth2 client
   */
  async initialize() {
    try {
      this.oauth2Client = new google.auth.OAuth2(
        this.credentials.clientId,
        this.credentials.clientSecret,
        this.credentials.redirectUri
      );

      // Try to load stored credentials
      await this.loadStoredCredentials();
      
      // Set credentials if available
      if (this.credentials.refreshToken) {
        this.oauth2Client.setCredentials({
          refresh_token: this.credentials.refreshToken
        });
      }

      this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
      
      return true;
    } catch (error) {
      console.error('OAuth2 initialization failed:', error.message);
      return false;
    }
  }

  /**
   * Load stored credentials from file
   */
  async loadStoredCredentials() {
    try {
      const credentialsData = await fs.readFile(this.credentialsPath, 'utf8');
      const storedCreds = JSON.parse(credentialsData);
      
      // Update credentials with stored data
      Object.assign(this.credentials, storedCreds);
      
      console.log('✅ Stored credentials loaded successfully');
    } catch (error) {
      console.log('ℹ️ No stored credentials found, using environment variables');
    }
  }

  /**
   * Save credentials to file
   */
  async saveCredentials(credentials) {
    try {
      // Ensure config directory exists
      const configDir = path.dirname(this.credentialsPath);
      await fs.mkdir(configDir, { recursive: true });
      
      // Merge with existing credentials
      const updatedCreds = { ...this.credentials, ...credentials };
      
      await fs.writeFile(this.credentialsPath, JSON.stringify(updatedCreds, null, 2));
      console.log('✅ Credentials saved successfully');
      
      // Update instance credentials
      Object.assign(this.credentials, updatedCreds);
    } catch (error) {
      console.error('❌ Failed to save credentials:', error.message);
    }
  }

  /**
   * Get authorization URL for initial setup
   */
  getAuthUrl() {
    const scopes = [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.compose'
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent' // Force consent screen to get refresh token
    });
  }

  /**
   * Exchange authorization code for tokens
   */
  async getTokens(code) {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      
      // Save tokens
      await this.saveCredentials({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiryDate: tokens.expiry_date
      });
      
      this.oauth2Client.setCredentials(tokens);
      
      return {
        success: true,
        message: 'Tokens obtained successfully',
        tokens
      };
    } catch (error) {
      throw new Error(`Token exchange failed: ${error.message}`);
    }
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken() {
    try {
      const { credentials } = await this.oauth2Client.refreshAccessToken();
      
      // Update stored credentials
      await this.saveCredentials({
        accessToken: credentials.access_token,
        expiryDate: credentials.expiry_date
      });
      
      console.log('✅ Access token refreshed successfully');
      return credentials;
    } catch (error) {
      console.error('❌ Token refresh failed:', error.message);
      throw new Error(`Token refresh failed: ${error.message}`);
    }
  }

  /**
   * Check if access token is valid and refresh if needed
   */
  async ensureValidToken() {
    try {
      // Check if token is about to expire (within 5 minutes)
      const now = Date.now();
      const expiryBuffer = 5 * 60 * 1000; // 5 minutes in milliseconds
      
      const credentials = this.oauth2Client.credentials;
      
      if (!credentials.expiry_date || (credentials.expiry_date - now) < expiryBuffer) {
        console.log('🔄 Token expired or expiring soon, refreshing...');
        await this.refreshAccessToken();
      }
      
      return true;
    } catch (error) {
      console.error('❌ Token validation failed:', error.message);
      return false;
    }
  }

  /**
   * Create nodemailer transporter with OAuth2
   */
  async createTransporter() {
    try {
      if (!this.oauth2Client) {
        await this.initialize();
      }

      // Ensure token is valid
      await this.ensureValidToken();
      
      const accessToken = await this.oauth2Client.getAccessToken();
      
      return nodemailer.createTransporter({
        service: 'gmail',
        auth: {
          type: 'OAuth2',
          user: process.env.OTP_MAILER?.replace(/"/g, ''),
          clientId: this.credentials.clientId,
          clientSecret: this.credentials.clientSecret,
          refreshToken: this.credentials.refreshToken,
          accessToken: accessToken.token
        }
      });
    } catch (error) {
      throw new Error(`Transporter creation failed: ${error.message}`);
    }
  }

  /**
   * Send email using Gmail API directly
   */
  async sendEmailViaAPI(to, subject, htmlContent, textContent) {
    try {
      if (!this.gmail) {
        await this.initialize();
      }

      await this.ensureValidToken();

      const fromEmail = process.env.SERVICE_OTP_MAILER?.replace(/"/g, '');
      
      // Create email message
      const emailLines = [
        `From: "Al Ansari" <${fromEmail}>`,
        `To: ${to}`,
        `Subject: ${subject}`,
        'Content-Type: text/html; charset=utf-8',
        'MIME-Version: 1.0',
        '',
        htmlContent
      ];

      const email = emailLines.join('\r\n');
      const encodedEmail = Buffer.from(email).toString('base64url');

      const response = await this.gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedEmail
        }
      });

      return {
        success: true,
        messageId: response.data.id,
        method: 'Gmail API'
      };
    } catch (error) {
      throw new Error(`Gmail API send failed: ${error.message}`);
    }
  }

  /**
   * Test connection and authentication
   */
  async testConnection() {
    try {
      if (!this.gmail) {
        await this.initialize();
      }

      await this.ensureValidToken();
      
      // Test by getting user profile
      const profile = await this.gmail.users.getProfile({ userId: 'me' });
      
      return {
        success: true,
        email: profile.data.emailAddress,
        messagesTotal: profile.data.messagesTotal
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Service Account method for enterprise use
class GmailServiceAccountService {
  constructor() {
    this.serviceAccountPath = process.env.SERVICE_GOOGLE_SERVICE_ACCOUNT_PATH;
    this.delegatedUser = process.env.SERVICE_GOOGLE_DELEGATED_USER; // The user to impersonate
    this.gmail = null;
  }

  /**
   * Initialize service account authentication
   */
  async initialize() {
    try {
      if (!this.serviceAccountPath) {
        throw new Error('Service account key file path not provided');
      }

      const auth = new google.auth.GoogleAuth({
        keyFile: this.serviceAccountPath,
        scopes: [
          'https://www.googleapis.com/auth/gmail.send',
          'https://www.googleapis.com/auth/gmail.compose'
        ],
        subject: this.delegatedUser // For domain-wide delegation
      });

      this.gmail = google.gmail({ version: 'v1', auth });
      
      return true;
    } catch (error) {
      console.error('Service Account initialization failed:', error.message);
      return false;
    }
  }

  /**
   * Send email using service account
   */
  async sendEmail(to, subject, htmlContent) {
    try {
      if (!this.gmail) {
        await this.initialize();
      }

      const fromEmail = this.delegatedUser || process.env.OTP_MAILER?.replace(/"/g, '');
      
      const emailLines = [
        `From: "Al Ansari" <${fromEmail}>`,
        `To: ${to}`,
        `Subject: ${subject}`,
        'Content-Type: text/html; charset=utf-8',
        'MIME-Version: 1.0',
        '',
        htmlContent
      ];

      const email = emailLines.join('\r\n');
      const encodedEmail = Buffer.from(email).toString('base64url');

      const response = await this.gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedEmail
        }
      });

      return {
        success: true,
        messageId: response.data.id,
        method: 'Service Account'
      };
    } catch (error) {
      throw new Error(`Service Account send failed: ${error.message}`);
    }
  }
}

module.exports = {
  GmailOAuth2Service,
  GmailServiceAccountService
};