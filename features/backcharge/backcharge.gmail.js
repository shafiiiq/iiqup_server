// features/backcharge/backcharge.gmail.js
const { serviceGmailClient, buildEmailFooter } = require('../../shared/email');

// ─────────────────────────────────────────────────────────────────────────────
// Sender Identity
// ─────────────────────────────────────────────────────────────────────────────

const SIGN_OFF = {
  name: 'FIROZ KHAN .M.A.',
  title: 'Workshop Manager',
  mobile: '+974 51700481',
};

// ─────────────────────────────────────────────────────────────────────────────
// Email Template
// ─────────────────────────────────────────────────────────────────────────────

const generateBackchargeTemplate = (recipientName = 'Sir', equipment = '') => `
  <!DOCTYPE html>
  <html>
  <head><meta charset="utf-8"></head>
  <body>
    <p>Dear ${recipientName},</p>
    <p>Please find the attached backcharge document for <strong>${equipment}</strong>.</p>
    <p>Kindly sign and forward the signed documents at your earliest convenience.</p>
    <p>For more details, please contact the Workshop Manager at <strong>51700481</strong>.</p>
    ${buildEmailFooter(SIGN_OFF)}
  </body>
  </html>
`;

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

const sendBackchargeViaEmail = async (
  email,
  supplierName = '',
  recipientName = '',
  attachments = [],
  equipment = ''
) => {
  if (!email?.includes('@')) throw new Error('[Gmail] Invalid email address');

  const subject = `M/S ${supplierName} - MR. ${recipientName} Backcharge for ${equipment}`;
  const htmlContent = generateBackchargeTemplate(recipientName, equipment);
  const textContent =
    'Please find the attached backcharge documents. Sign and forward the signed documents. For more details contact Workshop Manager (Contact No: 51700481)';

  return serviceGmailClient.sendEmail(
    email,
    subject,
    htmlContent,
    textContent,
    attachments
  );
};

const getAuthorizationUrl = async () => {
  await serviceGmailClient.initialize();
  return serviceGmailClient.getAuthUrl();
};

const exchangeCodeForTokens = async (code) => {
  await serviceGmailClient.initialize();
  return serviceGmailClient.getTokensFromCode(code);
};

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  sendBackchargeViaEmail,
  getAuthorizationUrl,
  exchangeCodeForTokens,
  generateBackchargeTemplate,
};