// gmail/mobilization.gmail.js
const { google } = require('googleapis');
const fs         = require('fs');
const path       = require('path');

require('dotenv').config();

// ─────────────────────────────────────────────────────────────────────────────
// Constants & Helpers
// ─────────────────────────────────────────────────────────────────────────────

const { GMAIL_SCOPES }                   = require('../constants/email.constants');
const { loadImageAsBase64, getMimeType, formatTime} = require('../helpers/email.helper');

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const MONTH_NAMES = ['', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const ACTION_LABEL = {
  mobilized:      'MOBILIZATION',
  demobilized:    'DEMOBILIZATION',
  status_changed: 'STATUS CHANGE',
  one_day_mob:    'MOBILIZATION',
  add_shifts:     'ADDITIONAL SHIFTS ADDED',
};

const ACTION_SUBJECT = (machine, regNo, site, clientCompany) => ({
  mobilized:      `Mobilized - ${machine} (${regNo})${clientCompany ? ` - ${clientCompany}` : site ? ` - ${site}` : ''}`,
  demobilized:    `Demobilized - ${machine} (${regNo})${site ? ` - ${site}` : ''}`,
  status_changed: `Status Changed - ${machine} (${regNo})`,
  one_day_mob:    `Mobilization - ${machine} (${regNo})${clientCompany ? ` - ${clientCompany}` : site ? ` - ${site}` : ''}`,
  add_shifts:     `Additional Shifts Added - ${machine} (${regNo})${site ? ` - ${site}` : ''}`,
});

// ─────────────────────────────────────────────────────────────────────────────
// OAuth2 Gmail Client
// ─────────────────────────────────────────────────────────────────────────────

class OAuth2GmailClient {
  constructor() {
    this.oauth2Client = null;
    this.gmail        = null;
    this.refreshToken = process.env.OPERATIONS_GMAIL_REFRESH_TOKEN;
  }

  async initialize() {
    const clientId     = process.env.OPERATIONS_GOOGLE_CLIENT_ID?.replace(/"/g, '');
    const clientSecret = process.env.OPERATIONS_GOOGLE_CLEINT_SECRET?.replace(/"/g, '');

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
      `From: "SALIH K. BASHEER" <${process.env.OPERATIONS_MAILER}>`,
      `To: ${to}`,
      ...(cc ? [`Cc: ${cc}`] : []),
      `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
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
      const raw          = this._buildRawEmail(to, subject, htmlContent, textContent, attachments, cc);
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

const generateMobilizationTemplate = (recipientName = 'Valued Customer', data = {}) => {
  const {
    action         = 'mobilized',
    regNo          = '',
    machine        = '',
    site           = '',
    deployType     = 'site',
    clientCompany  = '',
    operators      = [],
    withOperator   = false,
    month          = '',
    year           = '',
    time           = '',
    date           = '',
    previousStatus = '',
    newStatus      = '',
    hired          = false,
    hiredFrom      = '',
    rentRate       = null,
    location       = [],
    remarks        = '',
    allOperators   = [],
    demobDate    = '',
    demobMonth   = '',
    demobYear    = '',
    demobTime    = '',
    demobRemarks = '',
  } = data;

  const formatDate = (d) => d
    ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
    : 'N/A';

  const signatureLogo = loadImageAsBase64('signature-logo.png');
  const sigLogo       = loadImageAsBase64('sig-logo.png');
  const sigFacebook   = loadImageAsBase64('sig-facebook.png');
  const sigInstagram  = loadImageAsBase64('sig-instagram.png');
  const sigLinkedin   = loadImageAsBase64('sig-linkedin.png');

  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family:Arial,sans-serif;color:#333;">
      <p>Dear ${recipientName},</p>
      <p>This is to inform you that an equipment <strong>${ACTION_LABEL[action] ?? action}</strong> event has been recorded in the system. Please find the details below.</p>

      <table cellpadding="8" cellspacing="0" border="1" style="border-collapse:collapse;width:100%;max-width:560px;margin:16px 0;border-color:#ddd;">
        <tr style="background:#f5f5f5;">
          <td colspan="2" style="font-weight:bold;font-size:14px;padding:10px 12px;">Equipment Details</td>
        </tr>
        <tr>
          <td style="width:180px;color:#666;">Machine</td>
          <td><strong>${machine}</strong></td>
        </tr>
        <tr>
          <td style="color:#666;">Registration No.</td>
          <td><strong>${regNo}</strong></td>
        </tr>
        ${hiredFrom ? `
        <tr>
          <td style="color:#666;">Hired From</td>
          <td>${hiredFrom}</td>
        </tr>` : ''}
        ${action === 'mobilized' && deployType === 'company' ? `
        <tr>
          <td style="color:#666;">Leased to Company</td>
          <td><strong>${clientCompany}</strong></td>
        </tr>` : ''}
        ${action === 'mobilized' && deployType !== 'company' ? `
        <tr>
          <td style="color:#666;">Deployed to Site</td>
          <td><strong>${site}</strong></td>
        </tr>` : ''}
        ${action === 'demobilized' ? `
        <tr>
          <td style="color:#666;">Removed from Site</td>
          <td>${site || 'N/A'}</td>
        </tr>` : ''}
        ${withOperator && operators?.filter(op => op.operatorName)?.length ? `
        <tr style="background:#f5f5f5;">
          <td colspan="2" style="font-weight:bold;font-size:14px;padding:10px 12px;">Operators</td>
        </tr>
        ${(() => {
          const filled = operators.filter(op => op.operatorName);
          const isDayNight =
            filled.length === 2 &&
            filled[0]?.shiftName === 'Day Shift' &&
            filled[1]?.shiftName === 'Night Shift';

          if (isDayNight) {
            return `
            <tr>
              <td style="color:#666;">Day Shift Operator</td>
              <td><strong>${filled[0].operatorName}</strong> &nbsp;<span style="color:#888;">Day Shift${filled[0].shiftStart ? ' · ' + formatTime(filled[0].shiftStart) + (filled[0].shiftEnd ? ' – ' + formatTime(filled[0].shiftEnd) : '') : ''}</span></td>
            </tr>
            <tr>
              <td style="color:#666;">Night Shift Operator</td>
              <td><strong>${filled[1].operatorName}</strong> &nbsp;<span style="color:#888;">Night Shift${filled[1].shiftStart ? ' · ' + formatTime(filled[1].shiftStart) + (filled[1].shiftEnd ? ' – ' + formatTime(filled[1].shiftEnd) : '') : ''}</span></td>
            </tr>`;
          }

          // All other cases — numbered list, ignore shiftName label
        return filled.map((op, i) => `
          <tr>
            <td style="color:#666;">${filled.length > 1 ? `Operator ${i + 1}` : 'Operator'}</td>
            <td><strong>${op.operatorName}</strong>${op.shiftName ? ` &nbsp;<span style="color:#888;">${op.shiftName}</span>` : op.shiftStart ? ` &nbsp;<span style="color:#888;">${formatTime(op.shiftStart)}${op.shiftEnd ? ' – ' + formatTime(op.shiftEnd) : ''}</span>` : ''}</td>
          </tr>`).join('');
        })()}` : ''}
        ${action === 'add_shifts' ? `
        <tr style="background:#f5f5f5;">
          <td colspan="2" style="font-weight:bold;font-size:14px;padding:10px 12px;">Newly Added Shifts</td>
        </tr>
        ${operators.filter(op => op.operatorName).map((op, i) => `
        <tr>
          <td style="color:#666;">New Operator ${operators.filter(o => o.operatorName).length > 1 ? i + 1 : ''}</td>
          <td><strong>${op.operatorName}</strong>${op.shiftName ? ` &nbsp;<span style="color:#888;">${op.shiftName}</span>` : op.shiftStart ? ` &nbsp;<span style="color:#888;">${formatTime(op.shiftStart)}${op.shiftEnd ? ' – ' + formatTime(op.shiftEnd) : ''}</span>` : ''}</td>
        </tr>`).join('')}
        ${allOperators.length ? `
        <tr style="background:#f5f5f5;">
          <td colspan="2" style="font-weight:bold;font-size:14px;padding:10px 12px;">All Active Operators After Update</td>
        </tr>
        ${allOperators.filter(op => op.operatorName).map((op, i) => `
        <tr>
          <td style="color:#666;">Operator ${allOperators.filter(o => o.operatorName).length > 1 ? i + 1 : ''}</td>
          <td><strong>${op.operatorName}</strong>${op.shiftName ? ` &nbsp;<span style="color:#888;">${op.shiftName}</span>` : ''}</td>
        </tr>`).join('')}` : ''}` : ''}
        ${action === 'status_changed' ? `
        <tr>
          <td style="color:#666;">Previous Status</td>
          <td>${previousStatus}</td>
        </tr>
        <tr>
          <td style="color:#666;">New Status</td>
          <td><strong>${newStatus}</strong></td>
        </tr>` : ''}
        <tr style="background:#f5f5f5;">
          <td colspan="2" style="font-weight:bold;font-size:14px;padding:10px 12px;">${action === 'demobilized' ? 'Demobilization Details' : 'Mobilization Details'}</td>
        </tr>
        <tr>
          <td style="color:#666;">Date</td>
          <td>${formatDate(date)}</td>
        </tr>
        <tr>
          <td style="color:#666;">Month / Year</td>
          <td>${MONTH_NAMES[month] ?? month} ${year}</td>
        </tr>
        <tr>
          <td style="color:#666;">Time</td>
          <td>${time}</td>
        </tr>
        ${action === 'one_day_mob' ? `
        <tr style="background:#f5f5f5;">
          <td colspan="2" style="font-weight:bold;font-size:14px;padding:10px 12px;">Demobilization Details</td>
        </tr>
        <tr>
          <td style="color:#666;">Demob Date</td>
          <td>${formatDate(demobDate)}</td>
        </tr>
        <tr>
          <td style="color:#666;">Demob Month / Year</td>
          <td>${MONTH_NAMES[demobMonth] ?? demobMonth} ${demobYear}</td>
        </tr>
        <tr>
          <td style="color:#666;">Demob Time</td>
          <td>${demobTime}</td>        
        </tr>
        ${demobRemarks ? `
        <tr>
          <td style="color:#666;">Demob Remarks</td>
          <td>${demobRemarks}</td>
        </tr>` : ''}` : ''}
        ${remarks ? `
        <tr>
          <td style="color:#666;">Remarks</td>
          <td>${remarks}</td>
        </tr>` : ''}
        ${location?.length ? `
        <tr>
          <td style="color:#666;">Location</td>
          <td>${location[location.length - 1]}</td>
        </tr>` : ''}
        ${rentRate ? `
        <tr style="background:#f5f5f5;">
          <td colspan="2" style="font-weight:bold;font-size:14px;padding:10px 12px;">${hired ? 'Hire Details' : 'Working Details'}</td>
        </tr>
        <tr>
          <td style="color:#666;">Basis</td>
          <td>${rentRate.basis ? rentRate.basis.charAt(0).toUpperCase() + rentRate.basis.slice(1) : 'N/A'}</td>
        </tr>
        <tr>
          <td style="color:#666;">Rate</td>
          <td><strong>${rentRate.rate ? `${rentRate.rate} ${rentRate.currency || 'QAR'}` : 'N/A'}</strong></td>
        </tr>` : ''}
      </table>

      <br/>
      <p>
        Thanks &amp; Regards,<br/><br/>
        <strong style="font-family:tahoma,sans-serif;color:#666;">SALIH K. B</strong><br/>
        <span style="font-family:tahoma,sans-serif;color:#666;">Operations Supervisor</span><br/>
        <span style="font-family:tahoma,sans-serif;color:#666;">Mob: +974-51700493</span><br/><br/>
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

const alertMobilizationViaEmail = async (data = {}) => {
  const toList  = JSON.parse(process.env.MOBILIZATION_TO || '[]');
  const to      = toList.join(', ');
  const ccList  = JSON.parse(process.env.MOBILIZATION_CC || '[]');
  const cc      = ccList.join(', ');
  const subject = ACTION_SUBJECT(data.machine, data.regNo, data.site, data.clientCompany)[data.action] ?? `Equipment Update – ${data.machine}`;

  const htmlContent = generateMobilizationTemplate('Team', data);
  const textContent = `Equipment ${data.action}: ${data.machine} (${data.regNo}). Site: ${data.site || 'N/A'}. Date: ${data.date}. Time: ${data.time}. Remarks: ${data.remarks || 'None'}.`;

  return gmailClient.sendEmail(to, subject, htmlContent, textContent, [], cc);
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
  alertMobilizationViaEmail,
  getAuthorizationUrl,
  exchangeCodeForTokens,
  generateMobilizationTemplate,
};