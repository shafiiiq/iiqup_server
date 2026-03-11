// gmail/lpo-gmail.js
const { google } = require('googleapis');
const fs         = require('fs');
const path       = require('path');

require('dotenv').config();

// ─────────────────────────────────────────────────────────────────────────────
// Constants & Helpers
// ─────────────────────────────────────────────────────────────────────────────

const { GMAIL_SCOPES }                  = require('../constants/email.constants');
const { loadImageAsBase64, getMimeType } = require('../helpers/email.helper');

// ─────────────────────────────────────────────────────────────────────────────
// OAuth2 Gmail Client
// ─────────────────────────────────────────────────────────────────────────────

class OAuth2GmailClient {
  constructor() {
    this.oauth2Client = null;
    this.gmail        = null;
    this.refreshToken = process.env.SERVICE_GMAIL_REFRESH_TOKEN;
  }

  async initialize() {
    const clientId     = process.env.SERVICE_GOOGLE_CLIENT_ID?.replace(/"/g, '');
    const clientSecret = process.env.SERVICE_GOOGLE_CLEINT_SECRET?.replace(/"/g, '');

    if (!clientId || !clientSecret) {
      throw new Error('[Gmail] Missing Google OAuth credentials');
    }

    this.oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      `${process.env.BASE_URL}/oauth2callback`,
    );

    if (!this.refreshToken) return false;

    this.oauth2Client.setCredentials({ refresh_token: this.refreshToken });
    this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
    return true;
  }

  getAuthUrl() {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt:      'consent',
      scope:       GMAIL_SCOPES,
    });
  }

  async getTokensFromCode(code) {
    const { tokens } = await this.oauth2Client.getToken(code);
    return tokens;
  }

  async getSignature() {
    try {
      const result        = await this.gmail.users.settings.sendAs.list({ userId: 'me' });
      const defaultSendAs = result.data.sendAs?.find(s => s.isDefault);
      return defaultSendAs?.signature ?? '';
    } catch {
      return '';
    }
  }

  _resolveAttachment(attachment) {
    try {
      if (typeof attachment === 'string') {
        if (!fs.existsSync(attachment)) {
          console.warn(`[Gmail] Attachment not found: ${attachment}`);
          return null;
        }
        const filename = path.basename(attachment);
        return { fileContent: fs.readFileSync(attachment), filename, mimeType: getMimeType(filename) };
      }

      if (attachment.path) {
        if (!fs.existsSync(attachment.path)) {
          console.warn(`[Gmail] Attachment not found: ${attachment.path}`);
          return null;
        }
        const filename = attachment.filename ?? path.basename(attachment.path);
        return { fileContent: fs.readFileSync(attachment.path), filename, mimeType: attachment.mimeType ?? getMimeType(filename) };
      }

      if (attachment.content) {
        return {
          fileContent: Buffer.isBuffer(attachment.content) ? attachment.content : Buffer.from(attachment.content),
          filename:    attachment.filename ?? 'attachment',
          mimeType:    attachment.mimeType ?? 'application/octet-stream',
        };
      }

      console.warn('[Gmail] Invalid attachment format:', attachment);
      return null;
    } catch (error) {
      console.warn(`[Gmail] Error resolving attachment: ${error.message}`);
      return null;
    }
  }

  _buildRawEmail(to, subject, htmlContent, textContent, attachments = [], cc = '') {
    const boundary = `boundary_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

    const lines = [
      `From: "SERVICE AL ANSARI TRANSPORT" <${process.env.SERVICE_OTP_MAILER}>`,
      `To: ${to}`,
      ...(cc ? [`Cc: ${cc}`] : []),
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
        fileContent.toString('base64'),
      );
    }

    lines.push('', `--${boundary}--`);
    return lines.join('\n');
  }

  async sendEmail(to, subject, htmlContent, textContent, attachments = [], cc = '') {
    if (!this.gmail) {
      const initialized = await this.initialize();
      if (!initialized) throw new Error('[Gmail] Client not initialized — refresh token required');
    }

    try {
      const raw = this._buildRawEmail(to, subject, htmlContent, textContent, attachments, cc);
      const encodedEmail = Buffer.from(raw).toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const response = await this.gmail.users.messages.send({
        userId:      'me',
        requestBody: { raw: encodedEmail },
      });

      return {
        success:          true,
        messageId:        response.data.id,
        method:           'Gmail API (OAuth2)',
        attachmentsCount: attachments.length,
      };
    } catch (error) {
      const isAuthError = error.message.includes('invalid_grant') || error.message.includes('unauthorized');

      if (isAuthError) {
        await this.oauth2Client.refreshAccessToken();
        return this.sendEmail(to, subject, htmlContent, textContent, attachments, cc);
      }

      throw new Error(`[Gmail] Send failed: ${error.message}`);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Singleton Instance
// ─────────────────────────────────────────────────────────────────────────────

const gmailClient = new OAuth2GmailClient();

// ─────────────────────────────────────────────────────────────────────────────
// Email Templates
// ─────────────────────────────────────────────────────────────────────────────

const generateLPOTemplate = () => {
  const signatureLogo = loadImageAsBase64('signature-logo.png');
  const sigLogo       = loadImageAsBase64('sig-logo.png');
  const sigFacebook   = loadImageAsBase64('sig-facebook.png');
  const sigInstagram  = loadImageAsBase64('sig-instagram.png');
  const sigLinkedin   = loadImageAsBase64('sig-linkedin.png');

  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body>
      <p>Dear Sir,</p>
      <p><strong>Please find the attached LPO for your reference.</strong></p>
      <p><strong>If you need any further details, please don't hesitate to contact our Purchase Manager Mr. Abdul Malik.00974-51700494.</strong></p>
      <br/>
      <p>
        Thanks &amp; Regards,<br/><br/>
        <strong style="font-family:tahoma,sans-serif;color:#666;">FIROZ KHAN .M.A.</strong><br/>
        <span style="font-family:tahoma,sans-serif;color:#666;">Workshop Manager</span><br/>
        <span style="font-family:tahoma,sans-serif;color:#666;">Mob: +974 51700481</span><br/><br/>
        <strong style="font-family:tahoma,sans-serif;color:#444;font-size:18px;">AL ANSARI TRANSPORT &amp; ENTERPRISES W.L.L</strong><br/>
        <span style="font-family:tahoma,sans-serif;color:#444;">T +974 44505 700/800 | F +974 44505 900 | P.O BOX: 1265 | Doha, Qatar</span><br/>
        <a href="http://www.ansarigroup.co">www.ansarigroup.co</a>
      </p>

      ${signatureLogo ? `<img src="${signatureLogo}" width="200" style="display:block;" alt="Signature" />` : ''}

      <table cellpadding="0" cellspacing="0" border="0" style="margin-top:10px;">
        <tr>
          <td style="padding-right:8px;">${sigLogo      ? `<img src="${sigLogo}"      width="72" height="32" alt="Logo" />`                                                                                                                          : ''}</td>
          <td style="padding-right:8px;">${sigFacebook  ? `<a href="https://www.facebook.com/profile.php?id=100095544335543"                   target="_blank"><img src="${sigFacebook}"  width="27" height="27" alt="Facebook"  /></a>` : ''}</td>
          <td style="padding-right:8px;">${sigInstagram ? `<a href="https://www.instagram.com/al_ansari_transport"                             target="_blank"><img src="${sigInstagram}" width="27" height="27" alt="Instagram" /></a>` : ''}</td>
          <td>                           ${sigLinkedin  ? `<a href="https://www.linkedin.com/in/al-ansari-transport-and-enterprises-455b53253/" target="_blank"><img src="${sigLinkedin}"  width="27" height="27" alt="LinkedIn"  /></a>` : ''}</td>
        </tr>
      </table>
    </body>
    </html>
  `;
};

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

// Replace the current function body:
const sendLPOViaEmail = async (toList = [], client = '', recipientName = '', attachments = [], equipment = '') => {
  if (!toList.length) throw new Error('[Gmail] No recipient email provided');

  const to     = toList.join(', ');
  const ccList = JSON.parse(process.env.LPO_CC || '[]'); 
  const cc     = ccList.join(', ');

  const subject     = `M/S ${client} - MR. ${recipientName} LPO for ${equipment}`;
  const htmlContent = generateLPOTemplate();
  const textContent = `Please find the attached LPO for your reference...`;

  return gmailClient.sendEmail(to, subject, htmlContent, textContent, attachments, cc);
};

const getAuthorizationUrl = async () => {
  await gmailClient.initialize();
  return gmailClient.getAuthUrl();
};

const exchangeCodeForTokens = async (code) => {
  await gmailClient.initialize();
  return gmailClient.getTokensFromCode(code);
};

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  sendLPOViaEmail,
  getAuthorizationUrl,
  exchangeCodeForTokens,
  generateLPOTemplate,
};