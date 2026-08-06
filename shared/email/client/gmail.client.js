// shared/gmail/gmail.client.js
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

const logger = require('../../logger/logger');
const { GMAIL_SCOPES } = require('../constants/email.constant');
const { getMimeType } = require('../helpers/email.helper');

// ─────────────────────────────────────────────────────────────────────────────
// Generic OAuth2 Gmail Client
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lifetime OAuth2 Gmail client — authenticates via a stored refresh token,
 * so no service-account key files are required.
 *
 * Configurable per account via `config`:
 *   refreshTokenEnv, clientIdEnv, clientSecretEnv, mailerEnv,
 *   fromName, encodeSubject
 */
class GmailClient {
  constructor(config) {
    this.config = config;
    this.oauth2Client = null;
    this.gmail = null;
    this.refreshToken = process.env[config.refreshTokenEnv];
  }

  // ── Setup ──────────────────────────────────────────────────────────────────

  async initialize() {
    const clientId = process.env[this.config.clientIdEnv]?.replace(/"/g, '');
    const clientSecret = process.env[this.config.clientSecretEnv]?.replace(
      /"/g,
      ''
    );

    if (!clientId || !clientSecret) {
      throw new Error('[Gmail] Missing Google OAuth credentials');
    }

    this.oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      `${process.env.BASE_URL}/oauth2callback`
    );

    if (!this.refreshToken) return false;

    this.oauth2Client.setCredentials({ refresh_token: this.refreshToken });
    this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
    return true;
  }

  getAuthUrl() {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: GMAIL_SCOPES,
    });
  }

  async getTokensFromCode(code) {
    const { tokens } = await this.oauth2Client.getToken(code);
    return tokens;
  }

  // ── Gmail API ──────────────────────────────────────────────────────────────

  async getSignature() {
    try {
      const result = await this.gmail.users.settings.sendAs.list({
        userId: 'me',
      });
      const defaultSendAs = result.data.sendAs?.find((s) => s.isDefault);
      return defaultSendAs?.signature ?? '';
    } catch {
      return '';
    }
  }

  _resolveAttachment(attachment) {
    try {
      if (typeof attachment === 'string') {
        if (!fs.existsSync(attachment)) {
          logger.warn(`[Gmail] Attachment not found: ${attachment}`);
          return null;
        }
        const filename = path.basename(attachment);
        return {
          fileContent: fs.readFileSync(attachment),
          filename,
          mimeType: getMimeType(filename),
        };
      }

      if (attachment.path) {
        if (!fs.existsSync(attachment.path)) {
          logger.warn(`[Gmail] Attachment not found: ${attachment.path}`);
          return null;
        }
        const filename = attachment.filename ?? path.basename(attachment.path);
        return {
          fileContent: fs.readFileSync(attachment.path),
          filename,
          mimeType: attachment.mimeType ?? getMimeType(filename),
        };
      }

      if (attachment.content) {
        return {
          fileContent: Buffer.isBuffer(attachment.content)
            ? attachment.content
            : Buffer.from(attachment.content),
          filename: attachment.filename ?? 'attachment',
          mimeType: attachment.mimeType ?? 'application/octet-stream',
        };
      }

      logger.warn('[Gmail] Invalid attachment format:', attachment);
      return null;
    } catch (error) {
      logger.warn(`[Gmail] Error resolving attachment: ${error.message}`);
      return null;
    }
  }

  /**
   * Plain or RFC 2047 base64-encoded subject header, per account config.
   */
  _buildSubjectHeader(subject) {
    return this.config.encodeSubject
      ? `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`
      : `Subject: ${subject}`;
  }

  _buildRawEmail(to, subject, htmlContent, textContent, attachments = [], cc = '') {
    const boundary = `boundary_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    const fromEmail = process.env[this.config.mailerEnv];

    const lines = [
      `From: "${this.config.fromName}" <${fromEmail}>`,
      `To: ${to}`,
      ...(cc ? [`Cc: ${cc}`] : []),
      this._buildSubjectHeader(subject),
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
      '--alt_boundary--',
    ];

    for (const attachment of attachments) {
      const resolved = this._resolveAttachment(attachment);
      if (!resolved) continue;

      const { fileContent, filename, mimeType } = resolved;
      lines.push(
        '',
        `--${boundary}`,
        `Content-Type: ${mimeType}; name="${filename}"`,
        'Content-Transfer-Encoding: base64',
        `Content-Disposition: attachment; filename="${filename}"`,
        '',
        fileContent.toString('base64')
      );
    }

    lines.push('', `--${boundary}--`);
    return lines.join('\n');
  }

  /**
   * Send an email via the Gmail API, with optional file attachments.
   * Automatically refreshes an expired access token and retries once.
   */
  async sendEmail(to, subject, htmlContent, textContent, attachments = [], cc = '') {
    if (!this.gmail) {
      const initialized = await this.initialize();
      if (!initialized)
        throw new Error(
          '[Gmail] Client not initialized — refresh token required'
        );
    }

    try {
      const raw = this._buildRawEmail(
        to,
        subject,
        htmlContent,
        textContent,
        attachments,
        cc
      );
      const encodedEmail = Buffer.from(raw)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const response = await this.gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw: encodedEmail },
      });

      return {
        success: true,
        messageId: response.data.id,
        method: 'Gmail API (OAuth2)',
        attachmentsCount: attachments.length,
      };
    } catch (error) {
      const isAuthError =
        error.message.includes('invalid_grant') ||
        error.message.includes('unauthorized');

      if (isAuthError) {
        await this.oauth2Client.refreshAccessToken();
        return this.sendEmail(to, subject, htmlContent, textContent, attachments, cc);
      }

      throw new Error(`[Gmail] Send failed: ${error.message}`);
    }
  }
}

module.exports = GmailClient;