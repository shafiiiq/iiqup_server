// features/lpo/lpo.gmail.js
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

const generateLPOTemplate = () => `
  <!DOCTYPE html>
  <html>
  <head><meta charset="utf-8"></head>
  <body>
    <p>Dear Sir,</p>
    <p><strong>Please find the attached LPO for your reference.</strong></p>
    <p><strong>If you need any further details, please don't hesitate to contact our Purchase Manager Mr. Abdul Malik.00974-51700494.</strong></p>
    ${buildEmailFooter(SIGN_OFF)}
  </body>
  </html>
`;

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

const sendLPOViaEmail = async (
  toList = [],
  client = '',
  recipientName = '',
  attachments = [],
  equipment = ''
) => {
  if (!toList.length) throw new Error('[Gmail] No recipient email provided');

  const to = toList.join(', ');
  const ccList = JSON.parse(process.env.LPO_CC || '[]');
  const cc = ccList.join(', ');

  const subject = `M/S ${client} - MR. ${recipientName} LPO for ${equipment}`;
  const htmlContent = generateLPOTemplate();
  const textContent = `Please find the attached LPO for your reference...`;

  return serviceGmailClient.sendEmail(
    to,
    subject,
    htmlContent,
    textContent,
    attachments,
    cc
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
  sendLPOViaEmail,
  getAuthorizationUrl,
  exchangeCodeForTokens,
  generateLPOTemplate,
};